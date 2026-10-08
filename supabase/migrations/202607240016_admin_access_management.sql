-- Dedicated admin access management.
-- Run after 202607160001_initial_marketplace.sql.

create or replace function public.admin_user_directory()
returns table (
  user_id uuid,
  email text,
  full_name text,
  is_active boolean,
  roles text[],
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

  return query
  select
    p.id,
    coalesce(p.email, ''),
    p.full_name,
    p.is_active,
    coalesce(
      array_agg(ur.role::text order by ur.role::text) filter (where ur.role is not null),
      array[]::text[]
    ),
    p.created_at
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  group by p.id, p.email, p.full_name, p.is_active, p.created_at
  order by
    case when exists (
      select 1 from public.user_roles ar
      where ar.user_id = p.id and ar.role = 'super_admin'
    ) then 0 else 1 end,
    lower(coalesce(p.full_name, p.email, ''));
end;
$$;

create or replace function public.set_admin_roles(
  target_user_id uuid,
  requested_roles text[]
)
returns void
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
  requested_role text;
begin
  if not private.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'The selected khetE account does not exist.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(requested_roles, array[]::text[])) role_name
    where not (role_name = any(allowed_roles))
  ) then
    raise exception 'One or more requested roles are not administration roles.';
  end if;

  delete from public.user_roles
  where user_id = target_user_id
    and role::text = any(allowed_roles);

  foreach requested_role in array coalesce(requested_roles, array[]::text[])
  loop
    insert into public.user_roles (user_id, role, assigned_by)
    values (target_user_id, requested_role::public.app_role, auth.uid())
    on conflict (user_id, role) do update
      set assigned_by = excluded.assigned_by,
          assigned_at = now();
  end loop;

  if not exists (
    select 1 from public.user_roles where role = 'super_admin'
  ) then
    raise exception 'At least one Super Admin must remain active.';
  end if;
end;
$$;

revoke all on function public.admin_user_directory() from public;
revoke all on function public.set_admin_roles(uuid, text[]) from public;
grant execute on function public.admin_user_directory() to authenticated;
grant execute on function public.set_admin_roles(uuid, text[]) to authenticated;
