-- Homepage highlighted listings: lets admins hand-pick which listings appear in the
-- "khetE's Deals", "Featured Products" and "khetE's Most Popular" sections on the homepage.

create table if not exists public.home_highlights (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('deals', 'featured', 'popular')),
  listing_id uuid not null references public.listings(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (section, listing_id)
);

create index if not exists home_highlights_section_position_idx
  on public.home_highlights (section, position);

create or replace function private.can_manage_home_highlights()
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
        'content_promotion_manager'
      )
  );
$$;

grant execute on function private.can_manage_home_highlights()
  to authenticated;

alter table public.home_highlights enable row level security;

drop policy if exists "home_highlights_are_public"
  on public.home_highlights;
create policy "home_highlights_are_public"
on public.home_highlights for select to anon, authenticated
using (true);

drop policy if exists "home_highlights_admin_insert"
  on public.home_highlights;
create policy "home_highlights_admin_insert"
on public.home_highlights for insert to authenticated
with check (private.can_manage_home_highlights());

drop policy if exists "home_highlights_admin_update"
  on public.home_highlights;
create policy "home_highlights_admin_update"
on public.home_highlights for update to authenticated
using (private.can_manage_home_highlights())
with check (private.can_manage_home_highlights());

drop policy if exists "home_highlights_admin_delete"
  on public.home_highlights;
create policy "home_highlights_admin_delete"
on public.home_highlights for delete to authenticated
using (private.can_manage_home_highlights());
