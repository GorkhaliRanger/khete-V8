-- khetE marketplace: customer enquiries, support conversations and team workflow.
-- This migration is independent of the deferred payment gateway.

do $$
begin
  create type public.support_ticket_type as enum (
    'general_enquiry',
    'product_question',
    'order_issue',
    'delivery_issue',
    'return_request',
    'payment_issue',
    'account_issue',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.support_ticket_status as enum (
    'open',
    'in_progress',
    'awaiting_customer',
    'resolved',
    'closed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.support_priority as enum ('normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default (
    'SUP-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  customer_id uuid references auth.users(id) on delete set null,
  type public.support_ticket_type not null default 'general_enquiry',
  status public.support_ticket_status not null default 'open',
  priority public.support_priority not null default 'normal',
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  subject text not null,
  order_number text,
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_contact_name_length check (char_length(contact_name) between 2 and 100),
  constraint support_email_length check (char_length(contact_email) between 3 and 254),
  constraint support_subject_length check (char_length(subject) between 5 and 160)
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_kind text not null check (sender_kind in ('guest', 'customer', 'team')),
  body text not null check (char_length(body) between 1 and 4000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_customer_updated_idx
  on public.support_tickets (customer_id, last_message_at desc);
create index if not exists support_tickets_status_updated_idx
  on public.support_tickets (status, last_message_at desc);
create index if not exists support_messages_ticket_created_idx
  on public.support_messages (ticket_id, created_at);

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

create or replace function private.can_manage_support()
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
      and role in ('super_admin', 'customer_support', 'order_delivery_manager')
  );
$$;

grant execute on function private.can_manage_support() to authenticated;

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "customers_or_team_read_support_tickets" on public.support_tickets;
create policy "customers_or_team_read_support_tickets"
on public.support_tickets for select to authenticated
using (customer_id = auth.uid() or private.can_manage_support());

drop policy if exists "support_team_updates_tickets" on public.support_tickets;
create policy "support_team_updates_tickets"
on public.support_tickets for update to authenticated
using (private.can_manage_support())
with check (private.can_manage_support());

drop policy if exists "customers_or_team_read_support_messages" on public.support_messages;
create policy "customers_or_team_read_support_messages"
on public.support_messages for select to authenticated
using (
  exists (
    select 1
    from public.support_tickets
    where support_tickets.id = support_messages.ticket_id
      and (
        private.can_manage_support()
        or (
          support_tickets.customer_id = auth.uid()
          and not support_messages.is_internal
        )
      )
  )
);

grant select on public.support_tickets, public.support_messages to authenticated;
grant update (status, priority, assigned_to) on public.support_tickets to authenticated;

create or replace function public.create_support_ticket(
  p_type text,
  p_name text,
  p_email text,
  p_phone text,
  p_subject text,
  p_message text,
  p_order_number text default null
)
returns table (ticket_id uuid, ticket_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_type public.support_ticket_type;
  v_ticket public.support_tickets%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_subject text := trim(coalesce(p_subject, ''));
  v_message text := trim(coalesce(p_message, ''));
  v_order_number text := nullif(upper(trim(coalesce(p_order_number, ''))), '');
begin
  begin
    v_type := p_type::public.support_ticket_type;
  exception when invalid_text_representation then
    raise exception 'Choose a valid support topic.';
  end;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Enter a valid full name.';
  end if;
  if char_length(v_email) < 3 or char_length(v_email) > 254 or position('@' in v_email) < 2 then
    raise exception 'Enter a valid email address.';
  end if;
  if v_phone is not null and char_length(v_phone) > 30 then
    raise exception 'The phone number is too long.';
  end if;
  if char_length(v_subject) < 5 or char_length(v_subject) > 160 then
    raise exception 'The subject must contain between 5 and 160 characters.';
  end if;
  if char_length(v_message) < 10 or char_length(v_message) > 4000 then
    raise exception 'The message must contain between 10 and 4000 characters.';
  end if;
  if v_order_number is not null and char_length(v_order_number) > 40 then
    raise exception 'The order number is too long.';
  end if;

  insert into public.support_tickets (
    customer_id,
    type,
    contact_name,
    contact_email,
    contact_phone,
    subject,
    order_number
  ) values (
    v_user_id,
    v_type,
    v_name,
    v_email,
    v_phone,
    v_subject,
    v_order_number
  ) returning * into v_ticket;

  insert into public.support_messages (
    ticket_id,
    sender_id,
    sender_kind,
    body
  ) values (
    v_ticket.id,
    v_user_id,
    case when v_user_id is null then 'guest' else 'customer' end,
    v_message
  );

  return query select v_ticket.id, v_ticket.ticket_number;
end;
$$;

revoke all on function public.create_support_ticket(text, text, text, text, text, text, text) from public;
grant execute on function public.create_support_ticket(text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.add_support_message(
  p_ticket_id uuid,
  p_message text,
  p_internal boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.support_tickets%rowtype;
  v_is_team boolean;
  v_message text := trim(coalesce(p_message, ''));
begin
  if v_user_id is null then
    raise exception 'Sign in before replying to a support request.';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 4000 then
    raise exception 'The reply must contain between 1 and 4000 characters.';
  end if;

  v_is_team := private.can_manage_support();

  select * into v_ticket
  from public.support_tickets
  where id = p_ticket_id
  for update;

  if not found or (not v_is_team and v_ticket.customer_id <> v_user_id) then
    raise exception 'This support request is not available to this account.';
  end if;
  if p_internal and not v_is_team then
    raise exception 'Only the support team can add internal notes.';
  end if;
  if v_ticket.status = 'closed' and not v_is_team then
    raise exception 'This request is closed. Submit a new request for more help.';
  end if;

  insert into public.support_messages (
    ticket_id,
    sender_id,
    sender_kind,
    body,
    is_internal
  ) values (
    v_ticket.id,
    v_user_id,
    case when v_is_team then 'team' else 'customer' end,
    v_message,
    p_internal
  );

  update public.support_tickets
  set last_message_at = now(),
      status = case
        when p_internal then status
        when v_is_team then 'awaiting_customer'::public.support_ticket_status
        else 'open'::public.support_ticket_status
      end
  where id = v_ticket.id;
end;
$$;

revoke all on function public.add_support_message(uuid, text, boolean) from public;
grant execute on function public.add_support_message(uuid, text, boolean) to authenticated;
