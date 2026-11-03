-- khetE marketplace: Everest Exclusive-inspired support topics, validation,
-- private supporting files, and branded ticket references.
-- Requires 202607230005_customer_support.sql.

alter type public.support_ticket_type add value if not exists 'custom_request';
alter type public.support_ticket_type add value if not exists 'seller_application';

alter table public.support_tickets
  alter column ticket_number set default (
    'KHE-SUP-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  ),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint support_attachment_name_length check (char_length(file_name) between 1 and 180)
);

create index if not exists support_attachments_ticket_created_idx
  on public.support_attachments (ticket_id, created_at);

alter table public.support_attachments enable row level security;

drop policy if exists "customers_or_team_read_support_attachments" on public.support_attachments;
create policy "customers_or_team_read_support_attachments"
on public.support_attachments for select to authenticated
using (
  private.can_manage_support()
  or exists (
    select 1
    from public.support_tickets
    where support_tickets.id = support_attachments.ticket_id
      and support_tickets.customer_id = auth.uid()
  )
);

drop policy if exists "customers_add_support_attachments" on public.support_attachments;
create policy "customers_add_support_attachments"
on public.support_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.support_tickets
    where support_tickets.id = support_attachments.ticket_id
      and (
        support_tickets.customer_id = auth.uid()
        or private.can_manage_support()
      )
  )
);

drop policy if exists "customers_or_team_delete_support_attachments" on public.support_attachments;
create policy "customers_or_team_delete_support_attachments"
on public.support_attachments for delete to authenticated
using (
  private.can_manage_support()
  or (
    uploaded_by = auth.uid()
    and exists (
      select 1
      from public.support_tickets
      where support_tickets.id = support_attachments.ticket_id
        and support_tickets.customer_id = auth.uid()
    )
  )
);

grant select, insert, delete on public.support_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "support_attachment_owner_or_team_read" on storage.objects;
create policy "support_attachment_owner_or_team_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.can_manage_support()
  )
);

drop policy if exists "support_attachment_owner_insert" on storage.objects;
create policy "support_attachment_owner_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "support_attachment_owner_or_team_delete" on storage.objects;
create policy "support_attachment_owner_or_team_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'support-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.can_manage_support()
  )
);

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
  v_requires_reference boolean := coalesce(p_type, '') = any (
    array['order_issue', 'delivery_issue', 'return_request', 'payment_issue']
  );
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
    raise exception 'The order or request reference is too long.';
  end if;
  if v_requires_reference and v_order_number is null then
    raise exception 'Enter the order or request reference for this support topic.';
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
