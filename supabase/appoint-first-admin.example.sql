-- Run the complete file once in Supabase SQL Editor after replacing the email.
-- It promotes an existing confirmed account; it does not create a new user.
-- The first result must return one SUPER ADMIN row. Zero rows means the exact
-- email address does not exist in Authentication > Users for this project.

with target_user as (
  select id, email
  from auth.users
  where lower(email) = lower('replace-with-your-admin-email@example.com')
), promotion as (
  insert into public.user_roles (user_id, role)
  select id, 'super_admin'::public.app_role
  from target_user
  on conflict (user_id, role) do update set role = excluded.role
  returning user_id, role, assigned_at
)
select target_user.email, promotion.role, promotion.assigned_at
from promotion
join target_user on target_user.id = promotion.user_id;

-- Verification: it is normal for the account to retain its Customer role too.
-- At least one row below must say super_admin.
select u.email, r.role, r.assigned_at
from public.user_roles r
join auth.users u on u.id = r.user_id
where lower(u.email) = lower('replace-with-your-admin-email@example.com')
order by r.role;
