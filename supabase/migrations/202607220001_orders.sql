-- khetE marketplace: secure checkout, customer orders and admin fulfilment.
-- Run after the initial marketplace and listing-variants migrations.

do $$
begin
  create type public.order_status as enum (
    'pending_payment',
    'payment_review',
    'confirmed',
    'processing',
    'ready_for_dispatch',
    'dispatched',
    'delivered',
    'cancelled',
    'returned',
    'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum (
    'unpaid',
    'pending',
    'paid',
    'failed',
    'partially_refunded',
    'refunded'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'KHE-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  customer_id uuid not null references auth.users(id) on delete restrict,
  status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'unpaid',
  payment_method text not null default 'pending_gateway'
    check (payment_method in ('pending_gateway', 'esewa', 'khalti', 'bank_card')),
  currency text not null default 'NPR' check (currency = 'NPR'),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(14, 2) not null default 0 check (delivery_fee >= 0),
  discount_total numeric(14, 2) not null default 0 check (discount_total >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  district text not null,
  municipality text not null,
  ward text not null,
  area text not null,
  street_address text not null,
  delivery_note text,
  tracking_reference text,
  estimated_delivery_date date,
  placed_at timestamptz not null default now(),
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  variant_id uuid references public.listing_variants(id) on delete set null,
  listing_name text not null,
  variant_name text,
  sku text,
  unit_label text,
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  quantity numeric(14, 3) not null check (quantity > 0),
  line_total numeric(14, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  payment_status public.payment_status not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists orders_customer_created_idx
  on public.orders (customer_id, created_at desc);
create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);
create index if not exists order_items_order_idx
  on public.order_items (order_id);
create index if not exists order_history_order_created_idx
  on public.order_status_history (order_id, created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function private.can_manage_orders()
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
        'order_delivery_manager',
        'customer_support',
        'finance_manager'
      )
  );
$$;

grant execute on function private.can_manage_orders() to authenticated;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

drop policy if exists "customers_or_managers_read_orders" on public.orders;
create policy "customers_or_managers_read_orders"
on public.orders for select to authenticated
using (customer_id = auth.uid() or private.can_manage_orders());

drop policy if exists "customers_or_managers_read_order_items" on public.order_items;
create policy "customers_or_managers_read_order_items"
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (orders.customer_id = auth.uid() or private.can_manage_orders())
  )
);

drop policy if exists "customers_or_managers_read_order_history" on public.order_status_history;
create policy "customers_or_managers_read_order_history"
on public.order_status_history for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_status_history.order_id
      and (orders.customer_id = auth.uid() or private.can_manage_orders())
  )
);

grant select on public.orders, public.order_items, public.order_status_history to authenticated;

create or replace function public.create_marketplace_order(
  p_contact jsonb,
  p_items jsonb
)
returns table (
  order_id uuid,
  order_number text,
  order_status public.order_status,
  order_total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item jsonb;
  v_listing public.listings%rowtype;
  v_variant public.listing_variants%rowtype;
  v_inventory public.inventory%rowtype;
  v_listing_id uuid;
  v_variant_id uuid;
  v_quantity numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_line_total numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
  v_customer_name text := nullif(trim(p_contact ->> 'full_name'), '');
  v_customer_email text := nullif(trim(p_contact ->> 'email'), '');
  v_customer_phone text := nullif(trim(p_contact ->> 'phone'), '');
  v_district text := nullif(trim(p_contact ->> 'district'), '');
  v_municipality text := nullif(trim(p_contact ->> 'municipality'), '');
  v_ward text := nullif(trim(p_contact ->> 'ward'), '');
  v_area text := nullif(trim(p_contact ->> 'area'), '');
  v_street_address text := nullif(trim(p_contact ->> 'address'), '');
begin
  if v_user_id is null then
    raise exception 'Sign in before submitting an order.';
  end if;

  if v_customer_name is null or v_customer_email is null or v_customer_phone is null
    or v_district is null or v_municipality is null or v_ward is null
    or v_area is null or v_street_address is null then
    raise exception 'Complete every required contact and delivery field.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 50 then
    raise exception 'An order must contain between 1 and 50 items.';
  end if;

  insert into public.orders (
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    district,
    municipality,
    ward,
    area,
    street_address,
    delivery_note
  ) values (
    v_user_id,
    v_customer_name,
    v_customer_email,
    v_customer_phone,
    v_district,
    v_municipality,
    v_ward,
    v_area,
    v_street_address,
    nullif(trim(p_contact ->> 'delivery_note'), '')
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_listing_id := (v_item ->> 'listing_id')::uuid;
      v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
      v_quantity := (v_item ->> 'quantity')::numeric;
    exception when others then
      raise exception 'An order item contains an invalid listing, variant or quantity.';
    end;

    if v_quantity is null or v_quantity <= 0 or trunc(v_quantity) <> v_quantity then
      raise exception 'Order quantities must be positive whole numbers.';
    end if;

    select * into v_listing
    from public.listings
    where id = v_listing_id
    for update;

    if not found then
      raise exception 'A selected listing no longer exists.';
    end if;

    if v_listing.status <> 'active'
      or not v_listing.available
      or v_listing.published_at is null
      or v_listing.published_at > now() then
      raise exception 'The listing "%" is not currently available.', v_listing.name_en;
    end if;

    if v_variant_id is not null then
      select * into v_variant
      from public.listing_variants
      where id = v_variant_id and listing_id = v_listing_id
      for update;

      if not found or not v_variant.is_active then
        raise exception 'A selected option for "%" is no longer available.', v_listing.name_en;
      end if;

      if v_variant.stock_quantity < v_quantity then
        raise exception 'Only % unit(s) of "% — %" remain.',
          v_variant.stock_quantity, v_listing.name_en, v_variant.name_en;
      end if;

      v_unit_price := v_variant.price;
      update public.listing_variants
      set stock_quantity = stock_quantity - v_quantity
      where id = v_variant.id;
    else
      if v_listing.base_price is null then
        raise exception '"%" requires a quotation and cannot be ordered online yet.', v_listing.name_en;
      end if;
      v_unit_price := v_listing.base_price;

      if v_listing.stock_managed then
        select * into v_inventory
        from public.inventory
        where listing_id = v_listing.id
        for update;

        if not found then
          raise exception 'Inventory is not configured for "%".', v_listing.name_en;
        end if;

        if not v_inventory.allow_backorder
          and (v_inventory.quantity - v_inventory.reserved_quantity) < v_quantity then
          raise exception 'There is not enough stock for "%".', v_listing.name_en;
        end if;

        update public.inventory
        set reserved_quantity = reserved_quantity + v_quantity,
            updated_by = v_user_id
        where listing_id = v_listing.id;
      end if;
    end if;

    v_line_total := round(v_unit_price * v_quantity, 2);
    v_subtotal := v_subtotal + v_line_total;

    insert into public.order_items (
      order_id,
      listing_id,
      variant_id,
      listing_name,
      variant_name,
      sku,
      unit_label,
      unit_price,
      quantity,
      line_total
    ) values (
      v_order.id,
      v_listing.id,
      v_variant_id,
      v_listing.name_en,
      case when v_variant_id is null then null else v_variant.name_en end,
      case when v_variant_id is null then v_listing.sku else v_variant.sku end,
      case when v_variant_id is null then v_listing.unit_label else v_variant.unit_label end,
      v_unit_price,
      v_quantity,
      v_line_total
    );
  end loop;

  update public.orders
  set subtotal = v_subtotal,
      total = v_subtotal
  where id = v_order.id;

  insert into public.order_status_history (
    order_id, status, payment_status, note, changed_by
  ) values (
    v_order.id,
    'pending_payment',
    'unpaid',
    'Order request submitted. No payment has been collected.',
    v_user_id
  );

  update public.profiles
  set full_name = v_customer_name,
      phone = v_customer_phone
  where id = v_user_id;

  return query
  select v_order.id, v_order.order_number, 'pending_payment'::public.order_status, v_subtotal;
end;
$$;

revoke all on function public.create_marketplace_order(jsonb, jsonb) from public;
grant execute on function public.create_marketplace_order(jsonb, jsonb) to authenticated;

create or replace function public.update_marketplace_order(
  p_order_id uuid,
  p_status public.order_status,
  p_payment_status public.payment_status,
  p_delivery_fee numeric default null,
  p_tracking_reference text default null,
  p_estimated_delivery_date date default null,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_result public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_delivery_fee numeric(14, 2);
begin
  if not private.can_manage_orders() then
    raise exception 'This account cannot manage orders.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'The selected order no longer exists.';
  end if;

  if v_order.status in ('cancelled', 'returned', 'refunded') and p_status <> v_order.status then
    raise exception 'A terminal order cannot be moved back into fulfilment.';
  end if;

  if v_order.status = 'delivered' and p_status not in ('delivered', 'returned', 'refunded') then
    raise exception 'A delivered order can only move to returned or refunded.';
  end if;

  if p_status = 'cancelled' and v_order.status <> 'cancelled' then
    for v_item in select * from public.order_items where order_id = v_order.id
    loop
      if v_item.variant_id is not null then
        update public.listing_variants
        set stock_quantity = stock_quantity + v_item.quantity
        where id = v_item.variant_id;
      elsif v_item.listing_id is not null then
        update public.inventory
        set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity),
            updated_by = auth.uid()
        where listing_id = v_item.listing_id;
      end if;
    end loop;
  end if;

  if p_status = 'delivered' and v_order.status <> 'delivered' then
    for v_item in select * from public.order_items where order_id = v_order.id
    loop
      if v_item.variant_id is null and v_item.listing_id is not null then
        update public.inventory
        set quantity = greatest(0, quantity - v_item.quantity),
            reserved_quantity = greatest(0, reserved_quantity - v_item.quantity),
            updated_by = auth.uid()
        where listing_id = v_item.listing_id;
      end if;
    end loop;
  end if;

  v_delivery_fee := coalesce(p_delivery_fee, v_order.delivery_fee);
  if v_delivery_fee < 0 then
    raise exception 'Delivery fee cannot be negative.';
  end if;

  update public.orders
  set status = p_status,
      payment_status = p_payment_status,
      delivery_fee = v_delivery_fee,
      total = greatest(0, subtotal + v_delivery_fee - discount_total),
      tracking_reference = nullif(trim(p_tracking_reference), ''),
      estimated_delivery_date = p_estimated_delivery_date,
      delivered_at = case
        when p_status = 'delivered' and status <> 'delivered' then now()
        else delivered_at
      end,
      cancelled_at = case
        when p_status = 'cancelled' and status <> 'cancelled' then now()
        else cancelled_at
      end
  where id = v_order.id
  returning * into v_result;

  if v_order.status <> p_status
    or v_order.payment_status <> p_payment_status
    or nullif(trim(p_note), '') is not null then
    insert into public.order_status_history (
      order_id, status, payment_status, note, changed_by
    ) values (
      v_order.id,
      p_status,
      p_payment_status,
      nullif(trim(p_note), ''),
      auth.uid()
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.update_marketplace_order(
  uuid, public.order_status, public.payment_status, numeric, text, date, text
) from public;
grant execute on function public.update_marketplace_order(
  uuid, public.order_status, public.payment_status, numeric, text, date, text
) to authenticated;
