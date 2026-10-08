-- khetE marketplace: customer order centre, delivery confirmation and issued documents.
-- Requires 202607220001_orders.sql.
-- The payment gateway remains intentionally disconnected.

do $$
begin
  create type public.order_document_type as enum (
    'order_confirmation',
    'payment_invoice',
    'tax_invoice'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_document_status as enum ('issued', 'void');
exception when duplicate_object then null;
end $$;

alter table public.orders
  add column if not exists return_window_ends_at date,
  add column if not exists customer_delivery_confirmed_at timestamptz,
  add column if not exists customer_delivery_note text;

create table if not exists public.order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  document_type public.order_document_type not null,
  document_number text not null unique,
  status public.order_document_status not null default 'issued',
  currency text not null default 'NPR' check (currency = 'NPR'),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(14, 2) not null default 0 check (delivery_fee >= 0),
  discount_total numeric(14, 2) not null default 0 check (discount_total >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  issuer_legal_name text,
  issuer_pan_vat text,
  issuer_address text,
  issuer_email text,
  issuer_phone text,
  note text,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz not null default now(),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, document_type),
  constraint order_document_note_length
    check (note is null or char_length(note) <= 1000),
  constraint order_document_issuer_name_length
    check (issuer_legal_name is null or char_length(issuer_legal_name) between 2 and 160),
  constraint order_document_issuer_pan_length
    check (issuer_pan_vat is null or char_length(issuer_pan_vat) between 3 and 40),
  constraint order_document_issuer_address_length
    check (issuer_address is null or char_length(issuer_address) between 3 and 300)
);

create index if not exists order_documents_order_issued_idx
  on public.order_documents (order_id, issued_at desc);

drop trigger if exists order_documents_set_updated_at on public.order_documents;
create trigger order_documents_set_updated_at
before update on public.order_documents
for each row execute function public.set_updated_at();

alter table public.order_documents enable row level security;

drop policy if exists "customers_or_managers_read_order_documents" on public.order_documents;
create policy "customers_or_managers_read_order_documents"
on public.order_documents for select to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_documents.order_id
      and (
        orders.customer_id = auth.uid()
        or private.can_manage_orders()
      )
  )
);

grant select on public.order_documents to authenticated;

create or replace function private.order_document_number(
  p_order_number text,
  p_document_type public.order_document_type
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_document_type
    when 'order_confirmation' then 'KHE-OC-'
    when 'payment_invoice' then 'KHE-INV-'
    when 'tax_invoice' then 'KHE-TAX-'
  end || regexp_replace(p_order_number, '^KHE-', '');
$$;

create or replace function private.create_order_confirmation_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_documents (
    order_id,
    document_type,
    document_number,
    currency,
    subtotal,
    delivery_fee,
    discount_total,
    total,
    note,
    issued_by,
    issued_at
  ) values (
    new.id,
    'order_confirmation',
    private.order_document_number(new.order_number, 'order_confirmation'),
    new.currency,
    new.subtotal,
    new.delivery_fee,
    new.discount_total,
    new.total,
    'Order request received. This confirmation is not proof of payment or a tax invoice.',
    new.customer_id,
    new.placed_at
  )
  on conflict (order_id, document_type) do update
  set currency = excluded.currency,
      subtotal = excluded.subtotal,
      delivery_fee = excluded.delivery_fee,
      discount_total = excluded.discount_total,
      total = excluded.total,
      status = 'issued',
      voided_at = null;

  return new;
end;
$$;

drop trigger if exists orders_create_confirmation_document on public.orders;
create trigger orders_create_confirmation_document
after update of subtotal, delivery_fee, discount_total, total on public.orders
for each row
when (
  old.subtotal is distinct from new.subtotal
  or old.delivery_fee is distinct from new.delivery_fee
  or old.discount_total is distinct from new.discount_total
  or old.total is distinct from new.total
)
execute function private.create_order_confirmation_document();

insert into public.order_documents (
  order_id,
  document_type,
  document_number,
  currency,
  subtotal,
  delivery_fee,
  discount_total,
  total,
  note,
  issued_by,
  issued_at
)
select
  orders.id,
  'order_confirmation',
  private.order_document_number(orders.order_number, 'order_confirmation'),
  orders.currency,
  orders.subtotal,
  orders.delivery_fee,
  orders.discount_total,
  orders.total,
  'Order request received. This confirmation is not proof of payment or a tax invoice.',
  orders.customer_id,
  orders.placed_at
from public.orders
on conflict (order_id, document_type) do nothing;

create or replace function public.set_order_return_window(
  p_order_id uuid,
  p_return_window_ends_at date,
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
  v_note text := nullif(trim(coalesce(p_note, '')), '');
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

  if p_return_window_ends_at is not null
    and v_order.estimated_delivery_date is not null
    and p_return_window_ends_at < v_order.estimated_delivery_date then
    raise exception 'The return window cannot end before the estimated delivery date.';
  end if;

  update public.orders
  set return_window_ends_at = p_return_window_ends_at
  where id = v_order.id
  returning * into v_result;

  if v_order.return_window_ends_at is distinct from p_return_window_ends_at
    or v_note is not null then
    insert into public.order_status_history (
      order_id,
      status,
      payment_status,
      note,
      changed_by
    ) values (
      v_order.id,
      v_order.status,
      v_order.payment_status,
      coalesce(
        v_note,
        case
          when p_return_window_ends_at is null then 'Return or replacement window removed.'
          else 'Return or replacement window set through ' || to_char(p_return_window_ends_at, 'DD Mon YYYY') || '.'
        end
      ),
      auth.uid()
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.set_order_return_window(uuid, date, text) from public;
grant execute on function public.set_order_return_window(uuid, date, text) to authenticated;

create or replace function public.issue_order_document(
  p_order_id uuid,
  p_document_type text,
  p_issuer jsonb default '{}'::jsonb,
  p_note text default null
)
returns public.order_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_type public.order_document_type;
  v_document public.order_documents%rowtype;
  v_legal_name text := nullif(trim(coalesce(p_issuer ->> 'legal_name', '')), '');
  v_pan_vat text := nullif(trim(coalesce(p_issuer ->> 'pan_vat', '')), '');
  v_address text := nullif(trim(coalesce(p_issuer ->> 'address', '')), '');
  v_email text := nullif(lower(trim(coalesce(p_issuer ->> 'email', ''))), '');
  v_phone text := nullif(trim(coalesce(p_issuer ->> 'phone', '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not private.can_manage_orders() then
    raise exception 'This account cannot issue order documents.';
  end if;

  begin
    v_type := p_document_type::public.order_document_type;
  exception when invalid_text_representation then
    raise exception 'Choose a valid order document type.';
  end;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'The selected order no longer exists.';
  end if;

  if v_type = 'payment_invoice'
    and v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'Mark the payment as paid before issuing a payment invoice.';
  end if;

  if v_type = 'tax_invoice' then
    if v_order.payment_status not in ('paid', 'partially_refunded') then
      raise exception 'Mark the payment as paid before issuing a tax invoice.';
    end if;
    if v_order.status <> 'delivered' then
      raise exception 'A tax invoice can be issued only after delivery.';
    end if;
    if v_order.return_window_ends_at is null or v_order.return_window_ends_at >= current_date then
      raise exception 'Set a completed return window before issuing a tax invoice.';
    end if;
    if v_legal_name is null or v_pan_vat is null or v_address is null then
      raise exception 'Enter the legal issuer name, PAN/VAT number and address for a tax invoice.';
    end if;
  end if;

  insert into public.order_documents (
    order_id,
    document_type,
    document_number,
    status,
    currency,
    subtotal,
    delivery_fee,
    discount_total,
    total,
    issuer_legal_name,
    issuer_pan_vat,
    issuer_address,
    issuer_email,
    issuer_phone,
    note,
    issued_by,
    issued_at,
    voided_at
  ) values (
    v_order.id,
    v_type,
    private.order_document_number(v_order.order_number, v_type),
    'issued',
    v_order.currency,
    v_order.subtotal,
    v_order.delivery_fee,
    v_order.discount_total,
    v_order.total,
    v_legal_name,
    v_pan_vat,
    v_address,
    v_email,
    v_phone,
    v_note,
    auth.uid(),
    now(),
    null
  )
  on conflict (order_id, document_type) do update
  set status = 'issued',
      currency = excluded.currency,
      subtotal = excluded.subtotal,
      delivery_fee = excluded.delivery_fee,
      discount_total = excluded.discount_total,
      total = excluded.total,
      issuer_legal_name = excluded.issuer_legal_name,
      issuer_pan_vat = excluded.issuer_pan_vat,
      issuer_address = excluded.issuer_address,
      issuer_email = excluded.issuer_email,
      issuer_phone = excluded.issuer_phone,
      note = excluded.note,
      issued_by = excluded.issued_by,
      issued_at = excluded.issued_at,
      voided_at = null
  returning * into v_document;

  insert into public.order_status_history (
    order_id,
    status,
    payment_status,
    note,
    changed_by
  ) values (
    v_order.id,
    v_order.status,
    v_order.payment_status,
    case v_type
      when 'order_confirmation' then 'Order confirmation issued: '
      when 'payment_invoice' then 'Payment invoice issued: '
      when 'tax_invoice' then 'Tax invoice issued: '
    end || v_document.document_number,
    auth.uid()
  );

  return v_document;
end;
$$;

revoke all on function public.issue_order_document(uuid, text, jsonb, text) from public;
grant execute on function public.issue_order_document(uuid, text, jsonb, text) to authenticated;

create or replace function public.confirm_marketplace_delivery(
  p_order_id uuid,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_result public.orders%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_user_id is null then
    raise exception 'Sign in before confirming delivery.';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'The delivery note must contain 500 characters or fewer.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.customer_id <> v_user_id then
    raise exception 'This order is not available to this account.';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'Delivery can be confirmed after the order is marked delivered.';
  end if;

  update public.orders
  set customer_delivery_confirmed_at = coalesce(customer_delivery_confirmed_at, now()),
      customer_delivery_note = coalesce(v_note, customer_delivery_note)
  where id = v_order.id
  returning * into v_result;

  if v_order.customer_delivery_confirmed_at is null then
    insert into public.order_status_history (
      order_id,
      status,
      payment_status,
      note,
      changed_by
    ) values (
      v_order.id,
      v_order.status,
      v_order.payment_status,
      case
        when v_note is null then 'Customer confirmed delivery.'
        else 'Customer confirmed delivery: ' || v_note
      end,
      v_user_id
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.confirm_marketplace_delivery(uuid, text) from public;
grant execute on function public.confirm_marketplace_delivery(uuid, text) to authenticated;
