-- Persistent customer wishlists for products and individual listing variants.
-- Guest wishlists remain in the browser and are merged after account login.

create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  variant_id uuid,
  item_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_key),
  constraint wishlist_item_key_shape check (
    (variant_id is null and item_key = listing_id::text)
    or
    (variant_id is not null and item_key = listing_id::text || ':' || variant_id::text)
  )
);

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (user_id, created_at desc);

alter table public.wishlist_items enable row level security;

drop policy if exists "Customers can read their wishlist" on public.wishlist_items;
create policy "Customers can read their wishlist"
on public.wishlist_items for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Customers can add to their wishlist" on public.wishlist_items;
create policy "Customers can add to their wishlist"
on public.wishlist_items for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Customers can remove from their wishlist" on public.wishlist_items;
create policy "Customers can remove from their wishlist"
on public.wishlist_items for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, delete on public.wishlist_items to authenticated;
