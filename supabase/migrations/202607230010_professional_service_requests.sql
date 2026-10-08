-- khetE marketplace: professional service discovery, customer requests and
-- professional request management.
--
-- Run after:
--   202607230007_professional_network.sql
--   202607230009_professional_accounts.sql
--
-- Online payment remains intentionally disconnected. Completing a request
-- creates a Pending professional_earnings record for Finance to review.

do $$
begin
  create type public.professional_service_request_status as enum (
    'submitted',
    'accepted',
    'reschedule_requested',
    'in_progress',
    'completed',
    'declined',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.professional_service_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default (
    'KHE-SVC-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  customer_id uuid not null references auth.users(id) on delete restrict,
  profile_id uuid not null references public.professional_profiles(id) on delete restrict,
  offering_id uuid not null references public.professional_offerings(id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  service_location text not null,
  preferred_date date not null,
  preferred_time_slot text not null,
  quantity numeric(14, 3) not null default 1 check (quantity > 0 and quantity <= 100),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  total_amount numeric(14, 2) generated always as (quantity * unit_price) stored,
  customer_note text,
  professional_note text,
  status public.professional_service_request_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_service_customer_name_length
    check (char_length(customer_name) between 2 and 120),
  constraint professional_service_customer_email_length
    check (char_length(customer_email) between 3 and 180),
  constraint professional_service_customer_phone_length
    check (char_length(customer_phone) between 7 and 40),
  constraint professional_service_location_length
    check (char_length(service_location) between 3 and 240),
  constraint professional_service_time_slot_length
    check (char_length(preferred_time_slot) between 2 and 80),
  constraint professional_service_customer_note_length
    check (customer_note is null or char_length(customer_note) <= 1600),
  constraint professional_service_professional_note_length
    check (professional_note is null or char_length(professional_note) <= 1600)
);

create index if not exists professional_service_requests_customer_idx
  on public.professional_service_requests (customer_id, created_at desc);
create index if not exists professional_service_requests_profile_status_idx
  on public.professional_service_requests (profile_id, status, created_at desc);
create index if not exists professional_service_requests_offering_idx
  on public.professional_service_requests (offering_id, created_at desc);

drop trigger if exists professional_service_requests_set_updated_at
  on public.professional_service_requests;
create trigger professional_service_requests_set_updated_at
before update on public.professional_service_requests
for each row execute function public.set_updated_at();

create or replace function private.can_manage_professional_service_requests()
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
        'content_promotion_manager',
        'customer_support',
        'finance_manager',
        'order_delivery_manager'
      )
  );
$$;

grant execute on function private.can_manage_professional_service_requests()
  to authenticated;

alter table public.professional_service_requests enable row level security;

drop policy if exists "service_customer_reads_own_requests"
  on public.professional_service_requests;
create policy "service_customer_reads_own_requests"
on public.professional_service_requests for select to authenticated
using (customer_id = auth.uid());

drop policy if exists "service_professional_reads_profile_requests"
  on public.professional_service_requests;
create policy "service_professional_reads_profile_requests"
on public.professional_service_requests for select to authenticated
using (private.owns_professional_profile(profile_id));

drop policy if exists "service_team_reads_all_requests"
  on public.professional_service_requests;
create policy "service_team_reads_all_requests"
on public.professional_service_requests for select to authenticated
using (private.can_manage_professional_service_requests());

grant select on public.professional_service_requests to authenticated;

create or replace function public.create_professional_service_request(
  p_offering_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_service_location text,
  p_preferred_date date,
  p_preferred_time_slot text,
  p_quantity numeric,
  p_customer_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offering public.professional_offerings%rowtype;
  v_profile_status public.professional_profile_status;
  v_request_number text;
begin
  if auth.uid() is null then
    raise exception 'Log in before requesting a professional service.';
  end if;

  select offering.*
  into v_offering
  from public.professional_offerings as offering
  join public.professional_profiles as profile
    on profile.id = offering.profile_id
  where offering.id = p_offering_id
    and offering.status = 'active'
    and offering.kind <> 'partner_product'
    and profile.status = 'active';

  if v_offering.id is null then
    raise exception 'This professional service is no longer available.';
  end if;

  select status
  into v_profile_status
  from public.professional_profiles
  where id = v_offering.profile_id;

  if v_profile_status <> 'active' then
    raise exception 'This professional profile is not currently active.';
  end if;

  if char_length(trim(coalesce(p_customer_name, ''))) not between 2 and 120 then
    raise exception 'Enter your full name.';
  end if;

  if char_length(trim(coalesce(p_customer_email, ''))) not between 3 and 180
    or position('@' in p_customer_email) < 2 then
    raise exception 'Enter a valid email address.';
  end if;

  if char_length(trim(coalesce(p_customer_phone, ''))) not between 7 and 40 then
    raise exception 'Enter a valid phone number.';
  end if;

  if char_length(trim(coalesce(p_service_location, ''))) not between 3 and 240 then
    raise exception 'Enter the service location or Online.';
  end if;

  if p_preferred_date is null or p_preferred_date < current_date then
    raise exception 'Choose today or a future preferred date.';
  end if;

  if char_length(trim(coalesce(p_preferred_time_slot, ''))) not between 2 and 80 then
    raise exception 'Choose a preferred time.';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity > 100 then
    raise exception 'Service quantity must be between 1 and 100.';
  end if;

  if char_length(coalesce(p_customer_note, '')) > 1600 then
    raise exception 'The service note must be 1,600 characters or fewer.';
  end if;

  insert into public.professional_service_requests (
    customer_id,
    profile_id,
    offering_id,
    customer_name,
    customer_email,
    customer_phone,
    service_location,
    preferred_date,
    preferred_time_slot,
    quantity,
    unit_price,
    customer_note
  )
  values (
    auth.uid(),
    v_offering.profile_id,
    v_offering.id,
    trim(p_customer_name),
    lower(trim(p_customer_email)),
    trim(p_customer_phone),
    trim(p_service_location),
    p_preferred_date,
    trim(p_preferred_time_slot),
    p_quantity,
    v_offering.price,
    nullif(trim(coalesce(p_customer_note, '')), '')
  )
  returning request_number into v_request_number;

  return v_request_number;
end;
$$;

revoke all on function public.create_professional_service_request(
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  numeric,
  text
) from public;
grant execute on function public.create_professional_service_request(
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  numeric,
  text
) to authenticated;

create or replace function public.update_professional_service_request(
  p_request_id uuid,
  p_status public.professional_service_request_status,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.professional_service_requests%rowtype;
  v_offering public.professional_offerings%rowtype;
  v_is_customer boolean := false;
  v_is_professional boolean := false;
  v_is_staff boolean := false;
  v_transition_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Log in before updating a service request.';
  end if;

  select *
  into v_request
  from public.professional_service_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'The service request was not found.';
  end if;

  v_is_customer := v_request.customer_id = auth.uid();
  v_is_professional := private.owns_professional_profile(v_request.profile_id);
  v_is_staff := private.can_manage_professional_service_requests();

  if not (v_is_customer or v_is_professional or v_is_staff) then
    raise exception 'This account cannot update the selected service request.';
  end if;

  if char_length(coalesce(p_note, '')) > 1600 then
    raise exception 'The request note must be 1,600 characters or fewer.';
  end if;

  if v_is_customer and not (v_is_professional or v_is_staff) then
    v_transition_allowed :=
      p_status = 'cancelled'
      and v_request.status in ('submitted', 'accepted', 'reschedule_requested');
  elsif v_is_professional and not v_is_staff then
    v_transition_allowed :=
      (v_request.status = 'submitted'
        and p_status in ('accepted', 'reschedule_requested', 'declined'))
      or (v_request.status = 'accepted'
        and p_status in ('in_progress', 'reschedule_requested', 'cancelled'))
      or (v_request.status = 'reschedule_requested'
        and p_status in ('accepted', 'declined'))
      or (v_request.status = 'in_progress'
        and p_status = 'completed');
  else
    v_transition_allowed :=
      v_request.status not in ('completed', 'declined', 'cancelled')
      and p_status <> v_request.status;
  end if;

  if not v_transition_allowed then
    raise exception 'That status change is not available for this service request.';
  end if;

  update public.professional_service_requests
  set
    status = p_status,
    customer_note = case
      when v_is_customer and nullif(trim(coalesce(p_note, '')), '') is not null
        then concat_ws(
          E'\n\n',
          customer_note,
          'Cancellation note: ' || trim(p_note)
        )
      else customer_note
    end,
    professional_note = case
      when (v_is_professional or v_is_staff)
        and nullif(trim(coalesce(p_note, '')), '') is not null
        then trim(p_note)
      else professional_note
    end,
    accepted_at = case
      when p_status = 'accepted' then coalesce(accepted_at, now())
      else accepted_at
    end,
    started_at = case
      when p_status = 'in_progress' then coalesce(started_at, now())
      else started_at
    end,
    completed_at = case
      when p_status = 'completed' then coalesce(completed_at, now())
      else completed_at
    end,
    cancelled_at = case
      when p_status = 'cancelled' then coalesce(cancelled_at, now())
      else cancelled_at
    end
  where id = p_request_id
  returning * into v_request;

  if p_status = 'completed' then
    select *
    into v_offering
    from public.professional_offerings
    where id = v_request.offering_id;

    if not exists (
      select 1
      from public.professional_earnings
      where reference_number = v_request.request_number
    ) then
      insert into public.professional_earnings (
        profile_id,
        offering_id,
        reference_number,
        activity_kind,
        title,
        quantity,
        unit_price,
        gross_amount,
        discount_amount,
        platform_commission,
        payment_fee,
        shipping_deduction,
        other_deduction,
        activity_status,
        earning_status,
        activity_date,
        completed_at,
        internal_note,
        created_by,
        updated_by
      )
      values (
        v_request.profile_id,
        v_request.offering_id,
        v_request.request_number,
        v_offering.kind,
        v_offering.title,
        v_request.quantity,
        v_request.unit_price,
        v_request.total_amount,
        0,
        0,
        0,
        0,
        0,
        'completed',
        'pending',
        current_date,
        now(),
        'Created automatically from completed professional service request.',
        auth.uid(),
        auth.uid()
      );
    end if;
  end if;

  return v_request.request_number;
end;
$$;

revoke all on function public.update_professional_service_request(
  uuid,
  public.professional_service_request_status,
  text
) from public;
grant execute on function public.update_professional_service_request(
  uuid,
  public.professional_service_request_status,
  text
) to authenticated;
