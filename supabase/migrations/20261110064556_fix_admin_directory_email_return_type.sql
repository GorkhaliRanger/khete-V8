-- Correct the live auth.users.email varchar return to the RPC's declared text type.
-- Keep the existing protected Super Admin checks, Admin-only records and grants.

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

notify pgrst, 'reload schema';

