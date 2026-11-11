-- Forward-only, application-level audit for changes made by active Admin users.
-- The event table is append-only to API users. Actor and time come from Postgres,
-- never from browser-supplied created_by/updated_by columns.

create table if not exists public.admin_activity_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null,
  actor_email text not null,
  actor_name text not null,
  actor_roles text[] not null,
  area text not null,
  entity_table text not null,
  entity_key jsonb not null,
  entity_label text,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields text[] not null default array[]::text[],
  safe_changes jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default clock_timestamp()
);

create index if not exists admin_activity_events_actor_idx
  on public.admin_activity_events (actor_user_id, id desc);
create index if not exists admin_activity_events_area_idx
  on public.admin_activity_events (area, id desc);
create index if not exists admin_activity_events_entity_idx
  on public.admin_activity_events (entity_table, id desc);

alter table public.admin_activity_events enable row level security;
revoke all on public.admin_activity_events from public, anon, authenticated;
grant select on public.admin_activity_events to authenticated;

drop policy if exists admin_activity_super_admin_read on public.admin_activity_events;
create policy admin_activity_super_admin_read
on public.admin_activity_events for select to authenticated
using ((select private.has_role('super_admin')));

-- Existing account-management RPCs run SECURITY DEFINER and continue writing
-- their established log. Remove browser/API INSERT access so that table cannot
-- be populated with fabricated actions or arbitrary details by an Admin client.
revoke insert on public.admin_audit_log from authenticated;
drop policy if exists "admin_audit_super_admin_insert" on public.admin_audit_log;

-- Call only after the Auth password-reset email request succeeded. This records
-- the request, not proof of email delivery. The caller cannot supply an actor,
-- action or details. A Super Admin cannot reset another Super Admin here.
create or replace function public.record_admin_password_reset(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_email text;
begin
  if (select auth.uid()) is null or not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;
  if target_user_id = (select auth.uid()) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = target_user_id and ur.role = 'super_admin'
  ) then
    raise exception 'Super Admin password reset is protected.';
  end if;
  select u.email::text into target_email
  from auth.users u
  join public.admin_profiles ap on ap.user_id = u.id
  where u.id = target_user_id
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = u.id and ur.role::text = any(array[
        'product_inventory_manager', 'order_delivery_manager',
        'customer_support', 'finance_manager', 'content_promotion_manager'
      ])
    );
  if target_email is null then
    raise exception 'The selected administrator does not exist.';
  end if;
  insert into public.admin_audit_log (actor_user_id, target_user_id, action, details)
  values ((select auth.uid()), target_user_id, 'admin_password_reset_requested',
    jsonb_build_object('email', target_email));
end;
$$;
revoke all on function public.record_admin_password_reset(uuid) from public, anon;
grant execute on function public.record_admin_password_reset(uuid) to authenticated;

-- One trusted trigger covers configured Admin-managed tables. Full row bodies,
-- contact details, notes, documents and tokens never enter the activity table.
-- Column names show *what* changed; safe_changes contains values only for the
-- small, explicit field list attached to each trigger.
create or replace function private.capture_admin_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_mail text;
  actor_display text;
  actor_authority text[];
  before_row jsonb := '{}'::jsonb;
  after_row jsonb := '{}'::jsonb;
  identity_row jsonb;
  identity_json jsonb := '{}'::jsonb;
  safe_json jsonb := '{}'::jsonb;
  field_names text[] := array[]::text[];
  id_field text;
  field_name text;
  safe_field text;
  previous_safe jsonb;
  current_safe jsonb;
  excluded_fields constant text[] := array[
    'id', 'user_id', 'created_at', 'updated_at', 'created_by',
    'updated_by', 'assigned_at', 'recorded_at', 'search_document'
  ];
begin
  if actor_id is null then return null; end if;

  select coalesce(u.email::text, ''), coalesce(ap.full_name, 'Administrator'),
    array_agg(distinct ur.role::text order by ur.role::text)
  into actor_mail, actor_display, actor_authority
  from auth.users u
  join public.admin_profiles ap on ap.user_id = u.id and ap.is_active
  join public.user_roles ur on ur.user_id = u.id
  where u.id = actor_id
    and ur.role::text = any(array[
      'super_admin', 'product_inventory_manager', 'order_delivery_manager',
      'customer_support', 'finance_manager', 'content_promotion_manager'
    ])
  group by u.id, u.email, ap.full_name;
  if actor_authority is null then return null; end if;

  if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
  identity_row := case when tg_op = 'DELETE' then before_row else after_row end;

  foreach id_field in array string_to_array(tg_argv[1], ',') loop
    if not (identity_row ? id_field) then
      raise exception 'Admin activity key % is absent from %.%', id_field, tg_table_schema, tg_table_name;
    end if;
    identity_json := identity_json || jsonb_build_object(id_field, identity_row -> id_field);
  end loop;

  if tg_op = 'UPDATE' then
    for field_name in
      select key from jsonb_object_keys(before_row || after_row) as field(key)
    loop
      if field_name <> all(excluded_fields)
         and (before_row -> field_name) is distinct from (after_row -> field_name) then
        field_names := array_append(field_names, field_name);
      end if;
    end loop;
    if cardinality(field_names) = 0 then return null; end if;
  else
    field_names := string_to_array(coalesce(tg_argv[2], ''), ',');
  end if;

  foreach safe_field in array string_to_array(coalesce(tg_argv[2], ''), ',') loop
    if safe_field = '' then continue; end if;
    if tg_op = 'UPDATE'
       and (before_row -> safe_field) is not distinct from (after_row -> safe_field) then
      continue;
    end if;
    previous_safe := before_row -> safe_field;
    current_safe := after_row -> safe_field;
    if jsonb_typeof(previous_safe) = 'string' then
      previous_safe := to_jsonb(left(before_row ->> safe_field, 180));
    end if;
    if jsonb_typeof(current_safe) = 'string' then
      current_safe := to_jsonb(left(after_row ->> safe_field, 180));
    end if;
    safe_json := safe_json || jsonb_build_object(safe_field,
      jsonb_build_object('before', case when tg_op = 'INSERT' then null else previous_safe end,
                         'after', case when tg_op = 'DELETE' then null else current_safe end));
  end loop;

  insert into public.admin_activity_events (
    actor_user_id, actor_email, actor_name, actor_roles, area,
    entity_table, entity_key, entity_label, operation, changed_fields, safe_changes
  ) values (
    actor_id, actor_mail, actor_display, actor_authority, tg_argv[0],
    tg_table_name, identity_json,
    case when coalesce(tg_argv[3], '') = '' then null
      else left(identity_row ->> tg_argv[3], 180) end,
    tg_op, field_names, safe_json
  );
  return null;
end;
$$;
revoke all on function private.capture_admin_activity() from public, anon, authenticated;

-- Fixed table/column list: safe value fields are reviewed one table at a time.
-- Optional tables absent on a partial deployment are skipped and reported in
-- the activation check; rerun this block after those features are installed.
do $$
declare
  item record;
  configured_column text;
  target_table regclass;
begin
  for item in
    select * from (values
      ('admin_profiles', 'team', 'user_id', 'full_name,is_active', 'full_name', 'insert or update or delete'),
      ('admin_invitations', 'team', 'id', 'email,status,roles,expires_at', 'email', 'insert or update or delete'),
      ('user_roles', 'team', 'user_id,role', 'role', 'role', 'insert or update or delete'),
      ('admin_audit_log', 'team', 'id', 'action,target_user_id', 'action', 'insert'),
      ('categories', 'catalog', 'id', 'name_en,slug,level,parent_id,is_active,show_on_homepage,sort_order', 'name_en', 'insert or update or delete'),
      ('listings', 'catalog', 'id', 'name_en,sku,status,base_price,compare_at_price,available,stock_managed,featured,offer_type,offer_value', 'name_en', 'insert or update or delete'),
      ('listing_variants', 'catalog', 'id', 'name_en,sku,price,stock_quantity,is_active,sort_order,offer_type,offer_value', 'name_en', 'insert or update or delete'),
      ('inventory', 'catalog', 'listing_id', 'quantity,reserved_quantity,low_stock_threshold,allow_backorder', '', 'insert or update or delete'),
      ('listing_images', 'catalog', 'id', 'is_primary,sort_order', '', 'insert or update or delete'),
      ('promotions', 'promotions', 'id', 'title_en,is_active,starts_at,ends_at,sort_order,show_on_homepage,show_on_deals_page', 'title_en', 'insert or update or delete'),
      ('home_highlights', 'homepage', 'id', 'section,listing_id,position,badge,headline', 'headline', 'insert or update or delete'),
      ('site_content', 'content', 'key', 'key', 'key', 'insert or update or delete'),
      ('site_policy_documents', 'content', 'id', 'policy_key,title_en,status,version', 'title_en', 'insert or update or delete'),
      ('professional_applications', 'network', 'id', 'status,role,reviewed_at', 'application_number', 'update'),
      ('professional_profiles', 'network', 'id', 'name,role,status,featured,sort_order', 'name', 'insert or update or delete'),
      ('professional_account_links', 'network', 'profile_id', 'profile_id', '', 'insert or update or delete'),
      ('professional_offerings', 'finance', 'id', 'title,kind,price,status', 'title', 'insert or update or delete'),
      ('professional_earnings', 'finance', 'id', 'title,gross_amount,net_amount,activity_status,earning_status,paid_at', 'title', 'insert or update or delete'),
      ('certificates', 'certificates', 'id', 'title,status,is_public,verified_at', 'title', 'insert or update or delete'),
      ('certificate_subjects', 'certificates', 'id', 'display_name,is_public', 'display_name', 'insert or update or delete'),
      ('certificate_links', 'certificates', 'id', 'certificate_id,subject_id,listing_id,professional_profile_id,professional_offering_id', '', 'insert or update or delete'),
      ('orders', 'orders', 'id', 'status,payment_status,delivery_fee,total,estimated_delivery_date', 'order_number', 'update'),
      ('order_status_history', 'orders', 'id', 'status,payment_status', '', 'insert'),
      ('order_documents', 'orders', 'id', 'document_type,status,subtotal,delivery_fee,total', 'document_number', 'insert or update or delete'),
      ('support_tickets', 'support', 'id', 'status,priority,assigned_to', 'ticket_number', 'update'),
      ('support_messages', 'support', 'id', 'sender_kind,is_internal', '', 'insert or update or delete'),
      ('support_attachments', 'support', 'id', 'mime_type,size_bytes', '', 'insert or update or delete'),
      ('marketplace_reviews', 'reviews', 'id', 'status', '', 'update')
    ) as config(table_name, area, key_columns, safe_columns, label_column, operations)
  loop
    target_table := to_regclass(format('public.%I', item.table_name));
    if target_table is null then
      raise notice 'Admin activity table public.% is absent; trigger skipped.', item.table_name;
      continue;
    end if;
    foreach configured_column in array string_to_array(
      item.key_columns || ',' || item.safe_columns || ',' || item.label_column, ','
    ) loop
      if configured_column = '' then continue; end if;
      perform 1 from pg_attribute a
      where a.attrelid = target_table and a.attname = configured_column
        and a.attnum > 0 and not a.attisdropped;
      if not found then
        raise exception 'Admin activity config for public.% references missing column %.',
          item.table_name, configured_column;
      end if;
    end loop;
    execute format('drop trigger if exists admin_activity_capture on public.%I', item.table_name);
    execute format(
      'create trigger admin_activity_capture after %s on public.%I for each row execute function private.capture_admin_activity(%L,%L,%L,%L)',
      item.operations, item.table_name, item.area, item.key_columns, item.safe_columns, item.label_column
    );
  end loop;
end;
$$;

-- RLS is evaluated as the requesting user because this function is INVOKER.
-- It caps each page and supports cursor paging without exposing an unbounded
-- history download through the Admin interface.
create or replace function public.admin_activity_feed(
  p_search text default null,
  p_area text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_before_id bigint default null,
  p_limit integer default 50
)
returns setof public.admin_activity_events
language sql
stable
security invoker
set search_path = ''
as $$
  select event.*
  from public.admin_activity_events event
  where (p_area is null or event.area = p_area)
    and (p_from is null or event.recorded_at >= p_from)
    and (p_to is null or event.recorded_at < p_to)
    and (p_before_id is null or event.id < p_before_id)
    and (nullif(trim(p_search), '') is null or
      event.actor_name ilike '%' || trim(p_search) || '%' or
      event.actor_email ilike '%' || trim(p_search) || '%' or
      event.entity_label ilike '%' || trim(p_search) || '%' or
      event.entity_table ilike '%' || trim(p_search) || '%' or
      event.entity_key::text ilike '%' || trim(p_search) || '%')
  order by event.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
revoke all on function public.admin_activity_feed(text,text,timestamptz,timestamptz,bigint,integer) from public, anon;
grant execute on function public.admin_activity_feed(text,text,timestamptz,timestamptz,bigint,integer) to authenticated;

