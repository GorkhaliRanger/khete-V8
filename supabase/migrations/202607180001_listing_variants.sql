-- Purchasable options that share one marketplace listing.
-- Example: Carp Hatchlings can contain Rohu, Naini and Common Carp, each with
-- its own price, unit and available stock.

create table if not exists public.listing_variants (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ne text,
  sku text,
  price numeric(14, 2) not null check (price >= 0),
  compare_at_price numeric(14, 2) check (compare_at_price is null or compare_at_price >= price),
  unit_label text,
  stock_quantity numeric(14, 3) not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, name_en)
);

create index if not exists listing_variants_listing_id_idx
  on public.listing_variants (listing_id, sort_order, name_en);

drop trigger if exists set_listing_variants_updated_at on public.listing_variants;
create trigger set_listing_variants_updated_at
before update on public.listing_variants
for each row execute function public.set_updated_at();

alter table public.listing_variants enable row level security;

drop policy if exists "Public can read active listing variants" on public.listing_variants;
create policy "Public can read active listing variants"
on public.listing_variants for select
using (
  (is_active and exists (
    select 1 from public.listings
    where listings.id = listing_variants.listing_id
      and listings.status = 'active'
      and listings.available = true
      and listings.published_at is not null
      and listings.published_at <= now()
  ))
  or private.can_manage_catalog()
);

drop policy if exists "Catalogue managers can insert listing variants" on public.listing_variants;
create policy "Catalogue managers can insert listing variants"
on public.listing_variants for insert to authenticated
with check (private.can_manage_catalog());

drop policy if exists "Catalogue managers can update listing variants" on public.listing_variants;
create policy "Catalogue managers can update listing variants"
on public.listing_variants for update to authenticated
using (private.can_manage_catalog())
with check (private.can_manage_catalog());

drop policy if exists "Catalogue managers can delete listing variants" on public.listing_variants;
create policy "Catalogue managers can delete listing variants"
on public.listing_variants for delete to authenticated
using (private.can_manage_catalog());

grant select on public.listing_variants to anon;
grant select, insert, update, delete on public.listing_variants to authenticated;
