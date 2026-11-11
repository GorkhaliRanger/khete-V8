-- Only request metadata is stored here. Passwords, recovery tokens and PKCE
-- verifiers are never stored in this table.
create table if not exists public.admin_password_change_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint admin_password_request_expiration check (expires_at > created_at and expires_at <= created_at + interval '16 minutes')
);

create index if not exists admin_password_change_requests_owner_expiry
on public.admin_password_change_requests (user_id, expires_at);

alter table public.admin_password_change_requests enable row level security;
revoke all on public.admin_password_change_requests from public, anon, authenticated;
grant all on public.admin_password_change_requests to service_role;
grant select on public.admin_password_change_requests to authenticated;
grant insert (id, user_id, expires_at) on public.admin_password_change_requests to authenticated;
grant update (consumed_at) on public.admin_password_change_requests to authenticated;

drop policy if exists "admins_read_own_password_request" on public.admin_password_change_requests;
create policy "admins_read_own_password_request" on public.admin_password_change_requests
for select to authenticated
using (user_id = (select auth.uid()) and exists (
  select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active
));

drop policy if exists "admins_create_own_password_request" on public.admin_password_change_requests;
create policy "admins_create_own_password_request" on public.admin_password_change_requests
for insert to authenticated
with check (
  user_id = (select auth.uid()) and consumed_at is null
  and expires_at > now() and expires_at <= now() + interval '16 minutes'
  and exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active)
  and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid())
    and r.role::text = any(array['super_admin','product_inventory_manager','order_delivery_manager','customer_support','finance_manager','content_promotion_manager']))
);

drop policy if exists "admins_consume_own_password_request_once" on public.admin_password_change_requests;
create policy "admins_consume_own_password_request_once" on public.admin_password_change_requests
for update to authenticated
using (
  user_id = (select auth.uid()) and consumed_at is null and expires_at > now()
  and exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.is_active)
)
with check (user_id = (select auth.uid()) and consumed_at is not null);

create or replace function public.consume_admin_password_change_request(request_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed uuid;
begin
  update public.admin_password_change_requests
  set consumed_at = now()
  where id = request_id and user_id = (select auth.uid())
    and consumed_at is null and expires_at > now()
  returning id into changed;
  return changed is not null;
end;
$$;

revoke all on function public.consume_admin_password_change_request(uuid) from public, anon;
grant execute on function public.consume_admin_password_change_request(uuid) to authenticated;
notify pgrst, 'reload schema';
