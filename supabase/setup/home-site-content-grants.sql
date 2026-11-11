-- The public home and story tickers read site_content through the Data API.
-- Editors use the separate Admin session and the active Admin role helper.
begin;

do $$
begin
  if to_regclass('public.site_content') is null then
    raise exception 'public.site_content must exist before applying site-content-grants.sql';
  end if;
  if to_regprocedure('private.can_manage_site_content()') is null then
    raise exception 'private.can_manage_site_content() must exist before applying site-content-grants.sql';
  end if;
end;
$$;

alter table public.site_content enable row level security;

-- Existing broad table privileges do not match the public-read/admin-edit intent.
revoke all on table public.site_content from public, anon, authenticated;
grant select on table public.site_content to anon, authenticated;
grant insert, update on table public.site_content to authenticated;

drop policy if exists "Admin manage site content" on public.site_content;
drop policy if exists "Public read access to site content" on public.site_content;
drop policy if exists site_content_public_read on public.site_content;
drop policy if exists site_content_admin_insert on public.site_content;
drop policy if exists site_content_admin_update on public.site_content;

create policy site_content_public_read on public.site_content
  for select to anon, authenticated using (true);

create policy site_content_admin_insert on public.site_content
  for insert to authenticated
  with check ((select private.can_manage_site_content()));

create policy site_content_admin_update on public.site_content
  for update to authenticated
  using ((select private.can_manage_site_content()))
  with check ((select private.can_manage_site_content()));

commit;
