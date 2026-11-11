-- Permit verified, separately identifiable Admin accounts to receive Super Admin
-- authority. Existing Super Admin accounts remain protected by the existing
-- update_admin_account, set_admin_roles and delete_admin_account functions.
-- Run after 20261109111341_isolate_admin_profiles.sql.
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
    'super_admin', 'product_inventory_manager', 'order_delivery_manager',
    'customer_support', 'finance_manager', 'content_promotion_manager'
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
  if 'super_admin' = any(requested_roles)
     and requested_roles <> array['super_admin']::text[] then
    raise exception 'Assign Super Admin as the only role; it includes all administration areas.';
  end if;
  if exists (
    select 1 from auth.users u
    join public.user_roles ur on ur.user_id = u.id and ur.role = 'super_admin'
    where lower(u.email) = lower(trim(invited_email))
  ) then
    raise exception 'Super Admin accounts are protected and cannot be invited or changed here.';
  end if;
  if 'super_admin' = any(requested_roles) and exists (
    select 1 from auth.users u
    join public.user_roles ur on ur.user_id = u.id
      and ur.role::text = any(array[
        'product_inventory_manager', 'order_delivery_manager',
        'customer_support', 'finance_manager', 'content_promotion_manager'
      ])
    where lower(u.email) = lower(trim(invited_email))
  ) then
    raise exception 'This email already belongs to an administrator. Use Promote to Super Admin instead.';
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
    jsonb_build_object('invitation_id', invitation_id,
      'email', lower(trim(invited_email)), 'roles', requested_roles));
  return invitation_id;
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
    'super_admin', 'product_inventory_manager', 'order_delivery_manager',
    'customer_support', 'finance_manager', 'content_promotion_manager'
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
    raise exception 'This invitation contains an invalid role and must be replaced.';
  end if;
  if 'super_admin' = any(invitation.roles)
     and invitation.roles <> array['super_admin']::text[] then
    raise exception 'A Super Admin invitation cannot contain departmental roles.';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    join public.admin_profiles ap on ap.user_id = ur.user_id and ap.is_active
    where ur.user_id = invitation.invited_by and ur.role = 'super_admin'
  ) then
    raise exception 'The invitation issuer is no longer an active Super Admin.';
  end if;
  if 'super_admin' = any(invitation.roles) and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = any(array[
        'product_inventory_manager', 'order_delivery_manager',
        'customer_support', 'finance_manager', 'content_promotion_manager'
      ])
  ) then
    raise exception 'This administrator already has departmental access. Use Promote to Super Admin instead.';
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

  -- The invitee performed the acceptance; the issuer is retained separately.
  insert into public.admin_audit_log (actor_user_id, target_user_id, action, details)
  values ((select auth.uid()), (select auth.uid()), 'admin_invitation_accepted',
    jsonb_build_object('invitation_id', invitation.id,
      'invited_by', invitation.invited_by, 'email', account_email,
      'roles', invitation.roles));
end;
$$;

-- Promotion is deliberately separate from ordinary profile edits. The target
-- must already be a verified, active departmental Admin. Existing Super Admins
-- cannot be changed by this function, and a grant is never self-service.
create or replace function public.grant_super_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_roles text[];
begin
  if (select auth.uid()) is null or not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;
  if target_user_id is null or target_user_id = (select auth.uid()) then
    raise exception 'Choose another active administrator account.';
  end if;

  -- Lock the target profile so concurrent grants cannot produce duplicate
  -- accountability records for the same promotion.
  perform 1 from public.admin_profiles ap
  where ap.user_id = target_user_id and ap.is_active
  for update;
  if not found then
    raise exception 'The selected administrator is not active.';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = target_user_id and u.email_confirmed_at is not null
  ) then
    raise exception 'The selected administrator must verify their email first.';
  end if;
  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = target_user_id and ur.role = 'super_admin'
  ) then
    raise exception 'This administrator already has protected Super Admin authority.';
  end if;

  select array_agg(ur.role::text order by ur.role::text) into prior_roles
  from public.user_roles ur
  where ur.user_id = target_user_id and ur.role::text = any(array[
    'product_inventory_manager', 'order_delivery_manager', 'customer_support',
    'finance_manager', 'content_promotion_manager'
  ]);
  if coalesce(array_length(prior_roles, 1), 0) = 0 then
    raise exception 'Only an existing departmental administrator can be promoted.';
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (target_user_id, 'super_admin'::public.app_role, (select auth.uid()));

  insert into public.admin_audit_log (actor_user_id, target_user_id, action, details)
  values ((select auth.uid()), target_user_id, 'admin_super_admin_granted',
    jsonb_build_object('previous_roles', prior_roles));
end;
$$;

revoke all on function public.create_admin_invitation(text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.accept_admin_invitation() from public, anon, authenticated;
revoke all on function public.grant_super_admin(uuid) from public, anon, authenticated;
grant execute on function public.create_admin_invitation(text, text, text, text[]) to authenticated;
grant execute on function public.accept_admin_invitation() to authenticated;
grant execute on function public.grant_super_admin(uuid) to authenticated;


