-- Run after the Admin account-security and profile-image migrations.
-- Admin and customer profiles are separate records, even when one Auth identity
-- uses the same email/password for both application areas. This migration does
-- not copy customer photos, alter customer profiles, or delete Auth identities.

do $$
begin
  if to_regclass('public.admin_invitations') is null
     or to_regclass('public.admin_audit_log') is null then
    raise exception 'Apply the earlier Admin invitation and account-security migrations before isolate_admin_profiles.';
  end if;
end;
$$;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Administrator',
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;
revoke all on public.admin_profiles from public, anon, authenticated;
grant all on public.admin_profiles to service_role;
grant select on public.admin_profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.admin_profiles to authenticated;

-- Preserve existing staff access and names once. Profile images deliberately
-- start unset and all subsequent Admin changes remain in admin_profiles.
insert into public.admin_profiles (user_id, full_name, phone, is_active, created_at)
select
  u.id,
  coalesce(nullif(trim(p.full_name), ''), 'Administrator'),
  p.phone,
  coalesce(p.is_active, true),
  coalesce(p.created_at, u.created_at, now())
from auth.users u
left join public.profiles p on p.id = u.id
where exists (
  select 1 from public.user_roles ur
  where ur.user_id = u.id
    and ur.role::text = any(array[
      'super_admin', 'product_inventory_manager', 'order_delivery_manager',
      'customer_support', 'finance_manager', 'content_promotion_manager'
    ])
)
on conflict (user_id) do nothing;

drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = required_role
      and case
        when required_role::text = any(array[
          'super_admin', 'product_inventory_manager', 'order_delivery_manager',
          'customer_support', 'finance_manager', 'content_promotion_manager'
        ]) then exists (
          select 1 from public.admin_profiles ap
          where ap.user_id = ur.user_id and ap.is_active
        )
        else exists (
          select 1 from public.profiles p
          where p.id = ur.user_id and p.is_active
        )
      end
  );
$$;

revoke all on function private.has_role(public.app_role) from public;
grant execute on function private.has_role(public.app_role) to authenticated;

drop policy if exists "admins_read_own_profile_or_super_admin" on public.admin_profiles;
create policy "admins_read_own_profile_or_super_admin"
on public.admin_profiles for select
to authenticated
using (user_id = (select auth.uid()) or private.has_role('super_admin'));

drop policy if exists "admins_update_own_profile" on public.admin_profiles;
create policy "admins_update_own_profile"
on public.admin_profiles for update
to authenticated
using (
  user_id = (select auth.uid())
  and is_active
  and (
    private.has_role('super_admin') or private.has_role('product_inventory_manager')
    or private.has_role('order_delivery_manager') or private.has_role('customer_support')
    or private.has_role('finance_manager') or private.has_role('content_promotion_manager')
  )
)
with check (user_id = (select auth.uid()) and is_active);

drop policy if exists "roles_select_own_or_admin" on public.user_roles;
create policy "roles_select_own_or_admin"
on public.user_roles for select
to authenticated
using (
  (user_id = (select auth.uid()) and private.has_role(role))
  or private.has_role('super_admin')
);

drop policy if exists "roles_super_admin_insert" on public.user_roles;
drop policy if exists "roles_super_admin_update" on public.user_roles;
drop policy if exists "roles_super_admin_delete" on public.user_roles;
revoke insert, update, delete on public.user_roles from authenticated;

-- Internal trigger supports the trusted first-Super-Admin SQL bootstrap and
-- guarded role-assignment RPCs without granting clients profile INSERT access.
create or replace function private.initialize_admin_profile_from_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role::text = any(array[
    'super_admin', 'product_inventory_manager', 'order_delivery_manager',
    'customer_support', 'finance_manager', 'content_promotion_manager'
  ]) then
    insert into public.admin_profiles (user_id)
    values (new.user_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.initialize_admin_profile_from_role() from public, anon, authenticated;
drop trigger if exists user_roles_initialize_admin_profile on public.user_roles;
create trigger user_roles_initialize_admin_profile
after insert or update of user_id, role on public.user_roles
for each row execute function private.initialize_admin_profile_from_role();

-- Existing policy helpers must also respect Admin-only deactivation. These
-- private helpers retain their existing execution grants and role groupings.
create or replace function private.can_manage_catalog()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('product_inventory_manager'); $$;

create or replace function private.can_manage_promotions()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('content_promotion_manager'); $$;

create or replace function private.can_manage_orders()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('order_delivery_manager')
  or private.has_role('customer_support') or private.has_role('finance_manager'); $$;

create or replace function private.can_manage_support()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('customer_support')
  or private.has_role('order_delivery_manager'); $$;

create or replace function private.can_manage_professional_network()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('content_promotion_manager')
  or private.has_role('customer_support'); $$;

create or replace function private.can_manage_professional_finance()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('finance_manager')
  or private.has_role('order_delivery_manager'); $$;

create or replace function private.can_manage_professional_service_requests()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('content_promotion_manager')
  or private.has_role('customer_support') or private.has_role('finance_manager')
  or private.has_role('order_delivery_manager'); $$;

create or replace function private.can_manage_site_content()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('content_promotion_manager'); $$;

create or replace function private.can_moderate_marketplace_reviews()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('product_inventory_manager')
  or private.has_role('customer_support') or private.has_role('content_promotion_manager'); $$;

create or replace function private.can_manage_certificates()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('product_inventory_manager')
  or private.has_role('customer_support') or private.has_role('content_promotion_manager'); $$;

create or replace function private.can_manage_home_highlights()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_role('super_admin') or private.has_role('product_inventory_manager')
  or private.has_role('content_promotion_manager'); $$;

create or replace function public.admin_user_directory()
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  is_active boolean,
  roles text[],
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;

  return query
  select ap.user_id, coalesce(u.email::text, ''), ap.full_name, coalesce(ap.phone, ''),
    ap.is_active,
    array_agg(ur.role::text order by ur.role::text),
    ap.created_at
  from public.admin_profiles ap
  join auth.users u on u.id = ap.user_id
  join public.user_roles ur on ur.user_id = ap.user_id
    and ur.role::text = any(array[
      'super_admin', 'product_inventory_manager', 'order_delivery_manager',
      'customer_support', 'finance_manager', 'content_promotion_manager'
    ])
  group by ap.user_id, u.email, ap.full_name, ap.phone, ap.is_active, ap.created_at
  order by
    case when bool_or(ur.role = 'super_admin') then 0 else 1 end,
    lower(coalesce(nullif(ap.full_name, ''), u.email, ''));
end;
$$;

create or replace function public.update_admin_account(
  target_user_id uuid,
  requested_full_name text,
  requested_phone text,
  requested_is_active boolean,
  requested_roles text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_roles constant text[] := array[
    'product_inventory_manager', 'order_delivery_manager', 'customer_support',
    'finance_manager', 'content_promotion_manager'
  ];
  requested_role text;
begin
  if (select auth.uid()) is null or not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;
  if target_user_id = (select auth.uid()) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = target_user_id and ur.role = 'super_admin'
  ) then
    raise exception 'Super Admin accounts are protected and cannot be changed here.';
  end if;
  if not exists (
    select 1 from public.admin_profiles ap
    where ap.user_id = target_user_id
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = target_user_id and ur.role::text = any(allowed_roles)
      )
  ) then
    raise exception 'The selected administrator does not exist.';
  end if;
  if nullif(trim(requested_full_name), '') is null then
    raise exception 'The administrator name is required.';
  end if;
  if requested_is_active is null then
    raise exception 'An active status is required.';
  end if;
  if coalesce(array_length(requested_roles, 1), 0) = 0 then
    raise exception 'Select at least one administration role.';
  end if;
  if exists (
    select 1 from unnest(requested_roles) role_name
    where role_name is null or not (role_name = any(allowed_roles))
  ) then
    raise exception 'One or more requested roles cannot be assigned.';
  end if;

  update public.admin_profiles ap
  set full_name = trim(requested_full_name),
      phone = nullif(trim(coalesce(requested_phone, '')), ''),
      is_active = requested_is_active,
      updated_at = now()
  where ap.user_id = target_user_id;

  if not requested_is_active then
    update public.admin_invitations ai
    set status = 'cancelled', updated_at = now()
    where ai.status = 'pending'
      and lower(ai.email) = (select lower(u.email) from auth.users u where u.id = target_user_id);
  end if;

  delete from public.user_roles ur
  where ur.user_id = target_user_id and ur.role::text = any(allowed_roles);

  foreach requested_role in array requested_roles loop
    insert into public.user_roles (user_id, role, assigned_by)
    values (target_user_id, requested_role::public.app_role, (select auth.uid()))
    on conflict (user_id, role) do update
      set assigned_by = excluded.assigned_by, assigned_at = now();
  end loop;

  insert into public.admin_audit_log (actor_user_id, target_user_id, action, details)
  values ((select auth.uid()), target_user_id, 'admin_account_updated',
    jsonb_build_object('full_name', trim(requested_full_name),
      'phone', nullif(trim(coalesce(requested_phone, '')), ''),
      'is_active', requested_is_active, 'roles', requested_roles));
end;
$$;

create or replace function public.set_admin_roles(target_user_id uuid, requested_roles text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_roles constant text[] := array[
    'product_inventory_manager', 'order_delivery_manager', 'customer_support',
    'finance_manager', 'content_promotion_manager'
  ];
  requested_role text;
begin
  if (select auth.uid()) is null or not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;
  if target_user_id = (select auth.uid()) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = target_user_id and ur.role = 'super_admin'
  ) then
    raise exception 'Super Admin accounts are protected and cannot be changed here.';
  end if;
  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'The selected account does not exist.';
  end if;
  if coalesce(array_length(requested_roles, 1), 0) = 0 then
    raise exception 'Select at least one administration role.';
  end if;
  if exists (
    select 1 from unnest(requested_roles) role_name
    where role_name is null or not (role_name = any(allowed_roles))
  ) then
    raise exception 'One or more requested roles cannot be assigned.';
  end if;

  insert into public.admin_profiles (user_id) values (target_user_id)
  on conflict (user_id) do nothing;

  delete from public.user_roles ur
  where ur.user_id = target_user_id and ur.role::text = any(allowed_roles);
  foreach requested_role in array requested_roles loop
    insert into public.user_roles (user_id, role, assigned_by)
    values (target_user_id, requested_role::public.app_role, (select auth.uid()))
    on conflict (user_id, role) do update
      set assigned_by = excluded.assigned_by, assigned_at = now();
  end loop;

  insert into public.admin_audit_log (actor_user_id, target_user_id, action, details)
  values ((select auth.uid()), target_user_id, 'admin_roles_updated',
    jsonb_build_object('roles', requested_roles));
end;
$$;

create or replace function public.create_admin_invitation(
  invited_email text,
  invited_full_name text,
  invited_phone text,
  requested_roles text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_roles constant text[] := array[
    'product_inventory_manager', 'order_delivery_manager', 'customer_support',
    'finance_manager', 'content_promotion_manager'
  ];
  invitation_id uuid;
begin
  if (select auth.uid()) is null or not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;
  if nullif(trim(invited_email), '') is null
     or nullif(trim(invited_full_name), '') is null
     or nullif(trim(invited_phone), '') is null then
    raise exception 'Name, email and phone number are required.';
  end if;
  if coalesce(array_length(requested_roles, 1), 0) = 0 then
    raise exception 'Select at least one administration role.';
  end if;
  if exists (
    select 1 from unnest(requested_roles) role_name
    where role_name is null or not (role_name = any(allowed_roles))
  ) then
    raise exception 'One or more requested roles cannot be assigned.';
  end if;
  if exists (
    select 1 from auth.users u
    join public.user_roles ur on ur.user_id = u.id and ur.role = 'super_admin'
    where lower(u.email) = lower(trim(invited_email))
  ) then
    raise exception 'Super Admin accounts are protected and cannot be invited or changed here.';
  end if;

  insert into public.admin_invitations (email, full_name, phone, roles, invited_by)
  values (lower(trim(invited_email)), trim(invited_full_name), trim(invited_phone), requested_roles, (select auth.uid()))
  on conflict (lower(email)) where status = 'pending'
  do update set full_name = excluded.full_name, phone = excluded.phone,
    roles = excluded.roles, invited_by = (select auth.uid()),
    expires_at = now() + interval '24 hours', updated_at = now()
  returning id into invitation_id;

  insert into public.admin_audit_log (actor_user_id, action, details)
  values ((select auth.uid()), 'admin_invitation_created',
    jsonb_build_object('email', lower(trim(invited_email)), 'roles', requested_roles));
  return invitation_id;
end;
$$;

create or replace function public.admin_invitation_directory()
returns table (
  id uuid, email text, full_name text, phone text, roles text[],
  status text, expires_at timestamptz, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;
  update public.admin_invitations ai
  set status = 'expired', updated_at = now()
  where ai.status = 'pending' and ai.expires_at <= now();

  return query
  select ai.id, ai.email, ai.full_name, ai.phone, ai.roles, ai.status, ai.expires_at, ai.created_at
  from public.admin_invitations ai
  where ai.status = 'pending'
  order by ai.created_at desc;
end;
$$;

create or replace function public.accept_admin_invitation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  allowed_roles constant text[] := array[
    'product_inventory_manager', 'order_delivery_manager', 'customer_support',
    'finance_manager', 'content_promotion_manager'
  ];
  invitation public.admin_invitations%rowtype;
  requested_role text;
begin
  if (select auth.uid()) is null or account_email = '' then
    raise exception 'Sign in with the invited email before activating authority.';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = (select auth.uid()) and lower(u.email) = account_email
      and u.email_confirmed_at is not null
  ) then
    raise exception 'Verify the invited email before activating authority.';
  end if;
  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'super_admin'
  ) then
    raise exception 'Super Admin accounts are protected and cannot be changed by an invitation.';
  end if;

  select * into invitation
  from public.admin_invitations ai
  where lower(ai.email) = account_email and ai.status = 'pending'
    and ai.expires_at > now()
  order by ai.created_at desc limit 1 for update;
  if invitation.id is null then
    raise exception 'No active administrator invitation was found for this email.';
  end if;
  if coalesce(array_length(invitation.roles, 1), 0) = 0 or exists (
    select 1 from unnest(invitation.roles) role_name
    where role_name is null or not (role_name = any(allowed_roles))
  ) then
    raise exception 'This invitation contains an invalid or protected role and must be replaced.';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    join public.admin_profiles ap on ap.user_id = ur.user_id and ap.is_active
    where ur.user_id = invitation.invited_by and ur.role = 'super_admin'
  ) then
    raise exception 'The invitation issuer is no longer an active Super Admin.';
  end if;

  insert into public.admin_profiles (user_id, full_name, phone, is_active)
  values ((select auth.uid()), invitation.full_name, invitation.phone, true)
  on conflict (user_id) do update set full_name = excluded.full_name,
    phone = excluded.phone, is_active = true, updated_at = now();

  foreach requested_role in array invitation.roles loop
    insert into public.user_roles (user_id, role, assigned_by)
    values ((select auth.uid()), requested_role::public.app_role, invitation.invited_by)
    on conflict (user_id, role) do update
      set assigned_by = excluded.assigned_by, assigned_at = now();
  end loop;

  update public.admin_invitations ai
  set status = 'accepted', accepted_by = (select auth.uid()),
    accepted_at = now(), updated_at = now()
  where ai.id = invitation.id;

  insert into public.admin_audit_log (actor_user_id, target_user_id, action, details)
  values (invitation.invited_by, (select auth.uid()), 'admin_invitation_accepted',
    jsonb_build_object('email', account_email, 'roles', invitation.roles));
end;
$$;

create or replace function public.delete_admin_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_roles text[];
begin
  if (select auth.uid()) is null or not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;
  if target_user_id = (select auth.uid()) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = target_user_id and ur.role = 'super_admin'
  ) then
    raise exception 'Super Admin accounts are protected and cannot be deleted.';
  end if;

  select array_agg(ur.role::text) into target_roles
  from public.user_roles ur
  where ur.user_id = target_user_id and ur.role::text = any(array[
    'product_inventory_manager', 'order_delivery_manager', 'customer_support',
    'finance_manager', 'content_promotion_manager'
  ]);
  if coalesce(array_length(target_roles, 1), 0) = 0 then
    raise exception 'The selected administrator does not exist.';
  end if;

  delete from public.user_roles ur
  where ur.user_id = target_user_id and ur.role::text = any(target_roles);
  delete from public.admin_profiles ap where ap.user_id = target_user_id;
  update public.admin_invitations ai
  set status = 'cancelled', updated_at = now()
  where ai.status = 'pending'
    and lower(ai.email) = (select lower(u.email) from auth.users u where u.id = target_user_id);

  insert into public.admin_audit_log (actor_user_id, target_user_id, action, details)
  values ((select auth.uid()), target_user_id, 'admin_account_deleted',
    jsonb_build_object('roles_removed', target_roles, 'customer_account_preserved', true));
end;
$$;

revoke all on function public.admin_user_directory() from public;
revoke all on function public.update_admin_account(uuid, text, text, boolean, text[]) from public;
revoke all on function public.set_admin_roles(uuid, text[]) from public;
revoke all on function public.create_admin_invitation(text, text, text, text[]) from public;
revoke all on function public.admin_invitation_directory() from public;
revoke all on function public.accept_admin_invitation() from public;
revoke all on function public.delete_admin_account(uuid) from public;
grant execute on function public.admin_user_directory() to authenticated;
grant execute on function public.update_admin_account(uuid, text, text, boolean, text[]) to authenticated;
grant execute on function public.set_admin_roles(uuid, text[]) to authenticated;
grant execute on function public.create_admin_invitation(text, text, text, text[]) to authenticated;
grant execute on function public.admin_invitation_directory() to authenticated;
grant execute on function public.accept_admin_invitation() to authenticated;
grant execute on function public.delete_admin_account(uuid) to authenticated;
