-- Admin invitations with email OTP verification.
-- Run after 202607240016_admin_access_management.sql.

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  phone text not null,
  roles text[] not null default array[]::text[],
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_invitations_one_pending_email
on public.admin_invitations (lower(email))
where status = 'pending';

alter table public.admin_invitations enable row level security;
revoke all on public.admin_invitations from anon, authenticated;

create or replace function public.create_admin_invitation(
  invited_email text,
  invited_full_name text,
  invited_phone text,
  requested_roles text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  allowed_roles constant text[] := array[
    'super_admin',
    'product_inventory_manager',
    'order_delivery_manager',
    'customer_support',
    'finance_manager',
    'content_promotion_manager'
  ];
  invitation_id uuid;
begin
  if not private.has_role('super_admin') then
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
    where not (role_name = any(allowed_roles))
  ) then
    raise exception 'One or more requested roles are invalid.';
  end if;

  insert into public.admin_invitations (email, full_name, phone, roles, invited_by)
  values (lower(trim(invited_email)), trim(invited_full_name), trim(invited_phone), requested_roles, auth.uid())
  on conflict (lower(email)) where status = 'pending'
  do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    roles = excluded.roles,
    invited_by = auth.uid(),
    expires_at = now() + interval '24 hours',
    updated_at = now()
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create or replace function public.admin_invitation_directory()
returns table (
  id uuid,
  email text,
  full_name text,
  phone text,
  roles text[],
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;
  update public.admin_invitations
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at <= now();

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
set search_path = public, private
as $$
declare
  account_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invitation public.admin_invitations%rowtype;
  requested_role text;
begin
  if auth.uid() is null or account_email = '' then
    raise exception 'Sign in with the invited email before activating authority.';
  end if;

  select * into invitation
  from public.admin_invitations
  where lower(email) = account_email
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if invitation.id is null then
    raise exception 'No active administrator invitation was found for this email.';
  end if;

  insert into public.profiles (id, email, full_name, phone, account_type, is_active)
  values (auth.uid(), account_email, invitation.full_name, invitation.phone, 'team_member', true)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    account_type = 'team_member',
    is_active = true,
    updated_at = now();

  foreach requested_role in array invitation.roles
  loop
    insert into public.user_roles (user_id, role, assigned_by)
    values (auth.uid(), requested_role::public.app_role, invitation.invited_by)
    on conflict (user_id, role) do update
      set assigned_by = excluded.assigned_by,
          assigned_at = now();
  end loop;

  update public.admin_invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = invitation.id;
end;
$$;

revoke all on function public.create_admin_invitation(text, text, text, text[]) from public;
revoke all on function public.admin_invitation_directory() from public;
revoke all on function public.accept_admin_invitation() from public;
grant execute on function public.create_admin_invitation(text, text, text, text[]) to authenticated;
grant execute on function public.admin_invitation_directory() to authenticated;
grant execute on function public.accept_admin_invitation() to authenticated;
