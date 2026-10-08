-- khetE marketplace: idempotent promotions access repair.
-- Run this file if /admin/promotions detects the admin role but cannot load.
-- It can also install the promotions foundation when the earlier migration
-- was interrupted.

alter type public.app_role
  add value if not exists 'content_promotion_manager';

do $$
begin
  create type public.promotion_target as enum (
    'listing',
    'category',
    'deals'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ne text,
  eyebrow_en text,
  eyebrow_ne text,
  description_en text,
  description_ne text,
  button_label_en text not null default 'Explore offer',
  button_label_ne text,
  target_type public.promotion_target not null default 'deals',
  target_listing_id uuid references public.listings(id) on delete set null,
  target_category_id uuid references public.categories(id) on delete set null,
  banner_storage_path text,
  theme text not null default 'green'
    check (theme in ('green', 'gold', 'sand', 'blue', 'plum')),
  show_on_homepage boolean not null default true,
  show_on_deals_page boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_date_order check (
    ends_at is null or ends_at > starts_at
  ),
  constraint promotion_target_shape check (
    (target_type = 'listing' and target_listing_id is not null and target_category_id is null)
    or (target_type = 'category' and target_category_id is not null and target_listing_id is null)
    or (target_type = 'deals' and target_listing_id is null and target_category_id is null)
  )
);

create index if not exists promotions_schedule_idx
  on public.promotions (is_active, starts_at, ends_at, sort_order);
create index if not exists promotions_listing_idx
  on public.promotions (target_listing_id)
  where target_listing_id is not null;
create index if not exists promotions_category_idx
  on public.promotions (target_category_id)
  where target_category_id is not null;

drop trigger if exists promotions_set_updated_at on public.promotions;
create trigger promotions_set_updated_at
before update on public.promotions
for each row execute function public.set_updated_at();

create or replace function private.can_manage_promotions()
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
      and role::text in ('super_admin', 'content_promotion_manager')
  );
$$;

grant execute on function private.can_manage_promotions() to anon, authenticated;

alter table public.promotions enable row level security;

drop policy if exists "promotions_public_or_manager_read" on public.promotions;
create policy "promotions_public_or_manager_read"
on public.promotions for select
to anon, authenticated
using (
  (
    is_active
    and starts_at <= now()
    and (ends_at is null or ends_at >= now())
  )
  or private.can_manage_promotions()
);

drop policy if exists "promotions_manager_insert" on public.promotions;
create policy "promotions_manager_insert"
on public.promotions for insert
to authenticated
with check (private.can_manage_promotions());

drop policy if exists "promotions_manager_update" on public.promotions;
create policy "promotions_manager_update"
on public.promotions for update
to authenticated
using (private.can_manage_promotions())
with check (private.can_manage_promotions());

drop policy if exists "promotions_manager_delete" on public.promotions;
create policy "promotions_manager_delete"
on public.promotions for delete
to authenticated
using (private.can_manage_promotions());

grant select on public.promotions to anon;
grant select, insert, update, delete on public.promotions to authenticated;

drop policy if exists "marketplace_media_catalog_insert" on storage.objects;
create policy "marketplace_media_catalog_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'marketplace-media'
  and (private.can_manage_catalog() or private.can_manage_promotions())
);

drop policy if exists "marketplace_media_catalog_update" on storage.objects;
create policy "marketplace_media_catalog_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'marketplace-media'
  and (private.can_manage_catalog() or private.can_manage_promotions())
)
with check (
  bucket_id = 'marketplace-media'
  and (private.can_manage_catalog() or private.can_manage_promotions())
);

drop policy if exists "marketplace_media_catalog_delete" on storage.objects;
create policy "marketplace_media_catalog_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'marketplace-media'
  and (private.can_manage_catalog() or private.can_manage_promotions())
);
