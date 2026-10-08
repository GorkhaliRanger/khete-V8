-- khetE marketplace: authentication profiles, roles, category tree and listings.
-- Run this migration once against the Supabase project.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

do $$
begin
  create type public.account_type as enum (
    'customer',
    'farmer',
    'independent_business',
    'team_member'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.app_role as enum (
    'customer',
    'farmer',
    'independent_business',
    'super_admin',
    'product_inventory_manager',
    'order_delivery_manager',
    'customer_support',
    'finance_manager',
    'content_promotion_manager'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.listing_kind as enum (
    'product',
    'produce',
    'service',
    'rental',
    'livestock'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.listing_status as enum (
    'draft',
    'active',
    'inactive',
    'archived'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text,
  account_type public.account_type not null default 'customer',
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ne')),
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  level smallint not null default 0 check (level between 0 and 2),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_ne text,
  description_en text,
  description_ne text,
  icon_name text,
  image_url text,
  banner_url text,
  seo_title text,
  seo_description text,
  show_on_homepage boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_parent_shape check (
    (level = 0 and parent_id is null)
    or (level > 0 and parent_id is not null)
  )
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  kind public.listing_kind not null,
  status public.listing_status not null default 'draft',
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_ne text,
  short_description_en text,
  short_description_ne text,
  description_en text,
  description_ne text,
  specifications jsonb not null default '[]'::jsonb check (jsonb_typeof(specifications) = 'array'),
  search_keywords text[] not null default '{}',
  sku text unique,
  base_price numeric(14, 2) check (base_price is null or base_price >= 0),
  compare_at_price numeric(14, 2) check (compare_at_price is null or compare_at_price >= 0),
  price_label text,
  unit_label text,
  available boolean not null default true,
  stock_managed boolean not null default true,
  featured boolean not null default false,
  districts text[] not null default '{}',
  search_document tsvector,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_compare_price check (
    compare_at_price is null
    or base_price is null
    or compare_at_price >= base_price
  )
);

create table if not exists public.inventory (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  quantity numeric(14, 3) not null default 0 check (quantity >= 0),
  reserved_quantity numeric(14, 3) not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold numeric(14, 3) not null default 0 check (low_stock_threshold >= 0),
  allow_backorder boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint inventory_reservation_limit check (
    allow_backorder or reserved_quantity <= quantity
  )
);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  alt_text_en text,
  alt_text_ne text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (listing_id, storage_path)
);

create unique index if not exists listing_one_primary_image_idx
  on public.listing_images (listing_id)
  where is_primary;

create index if not exists categories_parent_sort_idx
  on public.categories (parent_id, sort_order, name_en);

create index if not exists categories_active_level_idx
  on public.categories (is_active, level, sort_order);

create index if not exists listings_category_status_idx
  on public.listings (category_id, status, published_at desc);

create index if not exists listings_kind_status_idx
  on public.listings (kind, status, published_at desc);

create index if not exists listings_search_document_idx
  on public.listings using gin (search_document);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_listing_search_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_document := to_tsvector(
    'simple',
    concat_ws(
      ' ',
      new.name_en,
      new.name_ne,
      new.short_description_en,
      new.short_description_ne,
      new.description_en,
      new.description_ne,
      array_to_string(new.search_keywords, ' '),
      new.sku
    )
  );
  return new;
end;
$$;

create or replace function public.validate_category_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_level smallint;
begin
  if new.level = 0 then
    if new.parent_id is not null then
      raise exception 'A parent category cannot have a parent_id.';
    end if;
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent.';
  end if;

  select level into parent_level
  from public.categories
  where id = new.parent_id;

  if parent_level is null then
    raise exception 'The selected parent category does not exist.';
  end if;

  if new.level <> parent_level + 1 then
    raise exception 'Category level must be exactly one level below its parent.';
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create or replace function private.has_role(required_role public.app_role)
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
      and role = required_role
  );
$$;

create or replace function private.can_manage_catalog()
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
      and role in ('super_admin', 'product_inventory_manager')
  );
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists categories_validate_parent on public.categories;
create trigger categories_validate_parent
before insert or update of parent_id, level on public.categories
for each row execute function public.validate_category_parent();

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

drop trigger if exists listings_set_search_document on public.listings;
create trigger listings_set_search_document
before insert or update of name_en, name_ne, short_description_en,
  short_description_ne, description_en, description_ne, search_keywords, sku
on public.listings
for each row execute function public.set_listing_search_document();

drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at
before update on public.inventory
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.can_manage_catalog() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.inventory enable row level security;
alter table public.listing_images enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or private.has_role('super_admin'));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "roles_select_own_or_admin" on public.user_roles;
create policy "roles_select_own_or_admin"
on public.user_roles for select
to authenticated
using (user_id = auth.uid() or private.has_role('super_admin'));

drop policy if exists "roles_super_admin_insert" on public.user_roles;
create policy "roles_super_admin_insert"
on public.user_roles for insert
to authenticated
with check (private.has_role('super_admin'));

drop policy if exists "roles_super_admin_update" on public.user_roles;
create policy "roles_super_admin_update"
on public.user_roles for update
to authenticated
using (private.has_role('super_admin'))
with check (private.has_role('super_admin'));

drop policy if exists "roles_super_admin_delete" on public.user_roles;
create policy "roles_super_admin_delete"
on public.user_roles for delete
to authenticated
using (private.has_role('super_admin'));

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read"
on public.categories for select
to anon, authenticated
using (is_active or private.can_manage_catalog());

drop policy if exists "categories_catalog_insert" on public.categories;
create policy "categories_catalog_insert"
on public.categories for insert
to authenticated
with check (private.can_manage_catalog());

drop policy if exists "categories_catalog_update" on public.categories;
create policy "categories_catalog_update"
on public.categories for update
to authenticated
using (private.can_manage_catalog())
with check (private.can_manage_catalog());

drop policy if exists "categories_catalog_delete" on public.categories;
create policy "categories_catalog_delete"
on public.categories for delete
to authenticated
using (private.can_manage_catalog());

drop policy if exists "listings_public_read" on public.listings;
create policy "listings_public_read"
on public.listings for select
to anon, authenticated
using (
  (status = 'active' and published_at is not null and published_at <= now())
  or private.can_manage_catalog()
);

drop policy if exists "listings_catalog_insert" on public.listings;
create policy "listings_catalog_insert"
on public.listings for insert
to authenticated
with check (private.can_manage_catalog());

drop policy if exists "listings_catalog_update" on public.listings;
create policy "listings_catalog_update"
on public.listings for update
to authenticated
using (private.can_manage_catalog())
with check (private.can_manage_catalog());

drop policy if exists "listings_catalog_delete" on public.listings;
create policy "listings_catalog_delete"
on public.listings for delete
to authenticated
using (private.can_manage_catalog());

drop policy if exists "inventory_catalog_read" on public.inventory;
create policy "inventory_catalog_read"
on public.inventory for select
to authenticated
using (private.can_manage_catalog());

drop policy if exists "inventory_catalog_insert" on public.inventory;
create policy "inventory_catalog_insert"
on public.inventory for insert
to authenticated
with check (private.can_manage_catalog());

drop policy if exists "inventory_catalog_update" on public.inventory;
create policy "inventory_catalog_update"
on public.inventory for update
to authenticated
using (private.can_manage_catalog())
with check (private.can_manage_catalog());

drop policy if exists "inventory_catalog_delete" on public.inventory;
create policy "inventory_catalog_delete"
on public.inventory for delete
to authenticated
using (private.can_manage_catalog());

drop policy if exists "listing_images_public_read" on public.listing_images;
create policy "listing_images_public_read"
on public.listing_images for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings
    where listings.id = listing_images.listing_id
      and listings.status = 'active'
      and listings.published_at is not null
      and listings.published_at <= now()
  )
  or private.can_manage_catalog()
);

drop policy if exists "listing_images_catalog_insert" on public.listing_images;
create policy "listing_images_catalog_insert"
on public.listing_images for insert
to authenticated
with check (private.can_manage_catalog());

drop policy if exists "listing_images_catalog_update" on public.listing_images;
create policy "listing_images_catalog_update"
on public.listing_images for update
to authenticated
using (private.can_manage_catalog())
with check (private.can_manage_catalog());

drop policy if exists "listing_images_catalog_delete" on public.listing_images;
create policy "listing_images_catalog_delete"
on public.listing_images for delete
to authenticated
using (private.can_manage_catalog());

grant select on public.profiles to authenticated;
grant update (full_name, phone, preferred_language, avatar_url)
  on public.profiles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select on public.categories, public.listings, public.listing_images to anon;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert, update, delete on public.inventory to authenticated;
grant select, insert, update, delete on public.listing_images to authenticated;
