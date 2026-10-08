-- khetE marketplace: named offers calculated as a fixed NPR amount or percentage.
-- Regular prices stay in listings.base_price and listing_variants.price.

alter table public.listings
  add column if not exists offer_title text,
  add column if not exists offer_type text,
  add column if not exists offer_value numeric(14, 2);

alter table public.listing_variants
  add column if not exists offer_title text,
  add column if not exists offer_type text,
  add column if not exists offer_value numeric(14, 2);

-- Preserve the final customer price of older compare-at records while moving
-- their original price into the regular-price column.
update public.listings
set
  offer_title = 'Special offer',
  offer_type = 'amount',
  offer_value = compare_at_price - base_price,
  base_price = compare_at_price,
  compare_at_price = null
where offer_title is null
  and offer_type is null
  and offer_value is null
  and base_price is not null
  and compare_at_price is not null
  and compare_at_price > base_price;

update public.listing_variants
set
  offer_title = 'Special offer',
  offer_type = 'amount',
  offer_value = compare_at_price - price,
  price = compare_at_price,
  compare_at_price = null
where offer_title is null
  and offer_type is null
  and offer_value is null
  and compare_at_price is not null
  and compare_at_price > price;

alter table public.listings
  drop constraint if exists listing_offer_fields;
alter table public.listings
  add constraint listing_offer_fields check (
    (
      offer_title is null
      and offer_type is null
      and offer_value is null
    )
    or (
      length(trim(offer_title)) > 0
      and offer_type in ('amount', 'percentage')
      and offer_value > 0
      and base_price is not null
      and (
        (offer_type = 'amount' and offer_value <= base_price)
        or (offer_type = 'percentage' and offer_value <= 100)
      )
    )
  );

alter table public.listing_variants
  drop constraint if exists listing_variant_offer_fields;
alter table public.listing_variants
  add constraint listing_variant_offer_fields check (
    (
      offer_title is null
      and offer_type is null
      and offer_value is null
    )
    or (
      length(trim(offer_title)) > 0
      and offer_type in ('amount', 'percentage')
      and offer_value > 0
      and (
        (offer_type = 'amount' and offer_value <= price)
        or (offer_type = 'percentage' and offer_value <= 100)
      )
    )
  );

create or replace function private.calculate_offer_price(
  p_regular_price numeric,
  p_offer_type text,
  p_offer_value numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(
    greatest(
      0::numeric,
      case
        when p_offer_type = 'amount' and p_offer_value > 0
          then p_regular_price - least(p_offer_value, p_regular_price)
        when p_offer_type = 'percentage' and p_offer_value > 0
          then p_regular_price - (p_regular_price * least(p_offer_value, 100) / 100)
        else p_regular_price
      end
    ),
    2
  );
$$;

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

      v_unit_price := private.calculate_offer_price(
        v_variant.price,
        v_variant.offer_type,
        v_variant.offer_value
      );
      update public.listing_variants
      set stock_quantity = stock_quantity - v_quantity
      where id = v_variant.id;
    else
      if v_listing.base_price is null then
        raise exception '"%" requires a quotation and cannot be ordered online yet.', v_listing.name_en;
      end if;
      v_unit_price := private.calculate_offer_price(
        v_listing.base_price,
        v_listing.offer_type,
        v_listing.offer_value
      );

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
