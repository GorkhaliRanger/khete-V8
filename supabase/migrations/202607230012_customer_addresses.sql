-- Private customer address book for checkout delivery profiles.
-- Run after the initial marketplace migration.

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone text not null,
  email text not null,
  district text not null,
  municipality text not null,
  ward text not null,
  area text not null,
  street_address text not null,
  delivery_note text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_address_label_length check (char_length(trim(label)) between 1 and 40),
  constraint customer_address_name_length check (char_length(trim(full_name)) between 2 and 120),
  constraint customer_address_phone_format check (phone ~ '^(\+977[ -]?)?9[678][0-9]{8}$'),
  constraint customer_address_email_shape check (
    char_length(trim(email)) between 5 and 254
    and position('@' in email) > 1
  ),
  constraint customer_address_district_length check (char_length(trim(district)) between 2 and 80),
  constraint customer_address_municipality_length check (char_length(trim(municipality)) between 2 and 120),
  constraint customer_address_ward_shape check (ward ~ '^[1-9][0-9]?$'),
  constraint customer_address_area_length check (char_length(trim(area)) between 2 and 160),
  constraint customer_address_street_length check (char_length(trim(street_address)) between 3 and 500),
  constraint customer_address_note_length check (
    delivery_note is null or char_length(delivery_note) <= 500
  )
);

create index if not exists customer_addresses_user_updated_idx
  on public.customer_addresses (user_id, is_default desc, updated_at desc);

create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (user_id)
  where is_default;

create or replace function public.prepare_customer_address_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.customer_addresses
    where user_id = new.user_id
      and id <> new.id
  ) then
    new.is_default := true;
  elsif new.is_default then
    update public.customer_addresses
    set is_default = false
    where user_id = new.user_id
      and id <> new.id
      and is_default;
  end if;

  return new;
end;
$$;

create or replace function public.restore_customer_address_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_default then
    update public.customer_addresses
    set is_default = true
    where id = (
      select id
      from public.customer_addresses
      where user_id = old.user_id
      order by updated_at desc, created_at desc
      limit 1
    );
  end if;

  return old;
end;
$$;

drop trigger if exists customer_addresses_prepare_default on public.customer_addresses;
create trigger customer_addresses_prepare_default
before insert or update of is_default, user_id on public.customer_addresses
for each row execute function public.prepare_customer_address_default();

drop trigger if exists customer_addresses_restore_default on public.customer_addresses;
create trigger customer_addresses_restore_default
after delete on public.customer_addresses
for each row execute function public.restore_customer_address_default();

drop trigger if exists customer_addresses_set_updated_at on public.customer_addresses;
create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row execute function public.set_updated_at();

alter table public.customer_addresses enable row level security;

drop policy if exists "Customers can read their own addresses" on public.customer_addresses;
create policy "Customers can read their own addresses"
on public.customer_addresses for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Customers can create their own addresses" on public.customer_addresses;
create policy "Customers can create their own addresses"
on public.customer_addresses for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Customers can update their own addresses" on public.customer_addresses;
create policy "Customers can update their own addresses"
on public.customer_addresses for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Customers can delete their own addresses" on public.customer_addresses;
create policy "Customers can delete their own addresses"
on public.customer_addresses for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.customer_addresses to authenticated;
