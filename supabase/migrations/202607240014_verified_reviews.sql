-- khetE marketplace: verified product and professional-service reviews.
--
-- Run after:
--   202607220001_orders.sql
--   202607230007_professional_network.sql
--   202607230010_professional_service_requests.sql
--
-- A customer can review only a delivered order item or a completed
-- professional-service request. Public visitors see only published reviews.

do $$
begin
  create type public.marketplace_review_kind as enum (
    'product',
    'professional_service'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.marketplace_review_status as enum (
    'pending',
    'published',
    'rejected',
    'withdrawn'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  kind public.marketplace_review_kind not null,
  listing_id uuid references public.listings(id) on delete cascade,
  variant_id uuid references public.listing_variants(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete restrict,
  profile_id uuid references public.professional_profiles(id) on delete cascade,
  offering_id uuid references public.professional_offerings(id) on delete set null,
  service_request_id uuid references public.professional_service_requests(id) on delete restrict,
  reviewer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text not null,
  status public.marketplace_review_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_review_title_length
    check (title is null or char_length(title) between 2 and 100),
  constraint marketplace_review_body_length
    check (char_length(body) between 10 and 1200),
  constraint marketplace_review_reviewer_name_length
    check (char_length(reviewer_name) between 2 and 120),
  constraint marketplace_review_admin_note_length
    check (admin_note is null or char_length(admin_note) <= 1000),
  constraint marketplace_review_source_shape check (
    (
      kind = 'product'
      and listing_id is not null
      and order_item_id is not null
      and profile_id is null
      and offering_id is null
      and service_request_id is null
    )
    or
    (
      kind = 'professional_service'
      and listing_id is null
      and variant_id is null
      and order_item_id is null
      and profile_id is not null
      and offering_id is not null
      and service_request_id is not null
    )
  )
);

create unique index if not exists marketplace_reviews_order_item_unique
  on public.marketplace_reviews (order_item_id)
  where order_item_id is not null;

create unique index if not exists marketplace_reviews_service_request_unique
  on public.marketplace_reviews (service_request_id)
  where service_request_id is not null;

create index if not exists marketplace_reviews_listing_public_idx
  on public.marketplace_reviews (listing_id, status, published_at desc)
  where listing_id is not null;

create index if not exists marketplace_reviews_profile_public_idx
  on public.marketplace_reviews (profile_id, status, published_at desc)
  where profile_id is not null;

create index if not exists marketplace_reviews_customer_created_idx
  on public.marketplace_reviews (customer_id, created_at desc);

create index if not exists marketplace_reviews_moderation_idx
  on public.marketplace_reviews (status, created_at asc);

drop trigger if exists marketplace_reviews_set_updated_at
  on public.marketplace_reviews;
create trigger marketplace_reviews_set_updated_at
before update on public.marketplace_reviews
for each row execute function public.set_updated_at();

create or replace function private.can_moderate_marketplace_reviews()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in (
        'super_admin',
        'product_inventory_manager',
        'customer_support',
        'content_promotion_manager'
      )
  );
$$;

grant execute on function private.can_moderate_marketplace_reviews()
  to authenticated;

alter table public.marketplace_reviews enable row level security;

drop policy if exists "published_reviews_are_public"
  on public.marketplace_reviews;
create policy "published_reviews_are_public"
on public.marketplace_reviews for select to anon, authenticated
using (status = 'published');

drop policy if exists "customers_read_own_reviews"
  on public.marketplace_reviews;
create policy "customers_read_own_reviews"
on public.marketplace_reviews for select to authenticated
using (customer_id = auth.uid());

drop policy if exists "review_moderators_read_all"
  on public.marketplace_reviews;
create policy "review_moderators_read_all"
on public.marketplace_reviews for select to authenticated
using (private.can_moderate_marketplace_reviews());

grant select (
  id,
  kind,
  listing_id,
  variant_id,
  profile_id,
  offering_id,
  reviewer_name,
  rating,
  title,
  body,
  status,
  published_at,
  created_at,
  updated_at
) on public.marketplace_reviews to anon;
grant select on public.marketplace_reviews to authenticated;

create or replace function public.get_my_review_opportunities()
returns table (
  source_type text,
  source_id uuid,
  target_type text,
  target_id uuid,
  target_name text,
  secondary_name text,
  reference_number text,
  completed_at timestamptz,
  existing_review_id uuid,
  existing_status text,
  existing_rating integer,
  existing_title text,
  existing_body text,
  existing_admin_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select opportunities.*
  from (
    select
      'order_item'::text as source_type,
      item.id as source_id,
      'listing'::text as target_type,
      item.listing_id as target_id,
      item.listing_name as target_name,
      item.variant_name as secondary_name,
      orders.order_number as reference_number,
      orders.delivered_at as completed_at,
      review.id as existing_review_id,
      review.status::text as existing_status,
      review.rating::integer as existing_rating,
      review.title as existing_title,
      review.body as existing_body,
      review.admin_note as existing_admin_note
    from public.order_items item
    join public.orders orders on orders.id = item.order_id
    left join public.marketplace_reviews review on review.order_item_id = item.id
    where auth.uid() is not null
      and orders.customer_id = auth.uid()
      and orders.status = 'delivered'
      and item.listing_id is not null

    union all

    select
      'service_request'::text as source_type,
      request.id as source_id,
      'professional'::text as target_type,
      request.profile_id as target_id,
      profile.name as target_name,
      offering.title as secondary_name,
      request.request_number as reference_number,
      request.completed_at as completed_at,
      review.id as existing_review_id,
      review.status::text as existing_status,
      review.rating::integer as existing_rating,
      review.title as existing_title,
      review.body as existing_body,
      review.admin_note as existing_admin_note
    from public.professional_service_requests request
    join public.professional_profiles profile on profile.id = request.profile_id
    join public.professional_offerings offering on offering.id = request.offering_id
    left join public.marketplace_reviews review
      on review.service_request_id = request.id
    where auth.uid() is not null
      and request.customer_id = auth.uid()
      and request.status = 'completed'
  ) as opportunities
  order by opportunities.completed_at desc nulls last;
$$;

grant execute on function public.get_my_review_opportunities()
  to authenticated;

create or replace function public.submit_marketplace_review(
  p_source_type text,
  p_source_id uuid,
  p_rating integer,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := trim(coalesce(p_body, ''));
  v_reviewer_name text;
  v_existing_id uuid;
  v_item record;
  v_request record;
begin
  if v_customer_id is null then
    raise exception 'Log in before submitting a review.';
  end if;

  if p_rating not between 1 and 5 then
    raise exception 'Choose a rating from 1 to 5.';
  end if;

  if v_title is not null and char_length(v_title) not between 2 and 100 then
    raise exception 'The review title must contain 2 to 100 characters.';
  end if;

  if char_length(v_body) not between 10 and 1200 then
    raise exception 'The review must contain 10 to 1200 characters.';
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Verified customer')
  into v_reviewer_name
  from public.profiles
  where id = v_customer_id;

  v_reviewer_name := coalesce(v_reviewer_name, 'Verified customer');

  if p_source_type = 'order_item' then
    select
      item.id as order_item_id,
      item.listing_id,
      item.variant_id
    into v_item
    from public.order_items item
    join public.orders orders on orders.id = item.order_id
    where item.id = p_source_id
      and orders.customer_id = v_customer_id
      and orders.status = 'delivered'
      and item.listing_id is not null
    for update of item;

    if not found then
      raise exception 'Only a delivered product can be reviewed.';
    end if;

    select id into v_existing_id
    from public.marketplace_reviews
    where order_item_id = v_item.order_item_id
    for update;

    if v_existing_id is null then
      insert into public.marketplace_reviews (
        customer_id,
        kind,
        listing_id,
        variant_id,
        order_item_id,
        reviewer_name,
        rating,
        title,
        body
      ) values (
        v_customer_id,
        'product',
        v_item.listing_id,
        v_item.variant_id,
        v_item.order_item_id,
        v_reviewer_name,
        p_rating,
        v_title,
        v_body
      )
      returning id into v_existing_id;
    else
      update public.marketplace_reviews
      set reviewer_name = v_reviewer_name,
          rating = p_rating,
          title = v_title,
          body = v_body,
          status = 'pending',
          admin_note = null,
          reviewed_by = null,
          reviewed_at = null,
          published_at = null
      where id = v_existing_id
        and customer_id = v_customer_id;
    end if;

  elsif p_source_type = 'service_request' then
    select
      request.id as service_request_id,
      request.profile_id,
      request.offering_id
    into v_request
    from public.professional_service_requests request
    where request.id = p_source_id
      and request.customer_id = v_customer_id
      and request.status = 'completed'
    for update;

    if not found then
      raise exception 'Only a completed professional service can be reviewed.';
    end if;

    select id into v_existing_id
    from public.marketplace_reviews
    where service_request_id = v_request.service_request_id
    for update;

    if v_existing_id is null then
      insert into public.marketplace_reviews (
        customer_id,
        kind,
        profile_id,
        offering_id,
        service_request_id,
        reviewer_name,
        rating,
        title,
        body
      ) values (
        v_customer_id,
        'professional_service',
        v_request.profile_id,
        v_request.offering_id,
        v_request.service_request_id,
        v_reviewer_name,
        p_rating,
        v_title,
        v_body
      )
      returning id into v_existing_id;
    else
      update public.marketplace_reviews
      set reviewer_name = v_reviewer_name,
          rating = p_rating,
          title = v_title,
          body = v_body,
          status = 'pending',
          admin_note = null,
          reviewed_by = null,
          reviewed_at = null,
          published_at = null
      where id = v_existing_id
        and customer_id = v_customer_id;
    end if;

  else
    raise exception 'The review source is not supported.';
  end if;

  return v_existing_id;
end;
$$;

grant execute on function public.submit_marketplace_review(
  text,
  uuid,
  integer,
  text,
  text
) to authenticated;

create or replace function public.withdraw_marketplace_review(
  p_review_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Log in before changing a review.';
  end if;

  update public.marketplace_reviews
  set status = 'withdrawn',
      published_at = null,
      reviewed_by = null,
      reviewed_at = null
  where id = p_review_id
    and customer_id = auth.uid();

  if not found then
    raise exception 'The selected review was not found.';
  end if;
end;
$$;

grant execute on function public.withdraw_marketplace_review(uuid)
  to authenticated;

create or replace function public.moderate_marketplace_review(
  p_review_id uuid,
  p_status text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.marketplace_review_status;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
begin
  if not private.can_moderate_marketplace_reviews() then
    raise exception 'This account cannot moderate reviews.';
  end if;

  if p_status not in ('published', 'rejected') then
    raise exception 'Choose Published or Rejected.';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'The moderation note is too long.';
  end if;

  v_status := p_status::public.marketplace_review_status;

  update public.marketplace_reviews
  set status = v_status,
      admin_note = v_note,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      published_at = case when v_status = 'published' then now() else null end
  where id = p_review_id
    and status <> 'withdrawn';

  if not found then
    raise exception 'The review is unavailable or has been withdrawn.';
  end if;
end;
$$;

grant execute on function public.moderate_marketplace_review(
  uuid,
  text,
  text
) to authenticated;
