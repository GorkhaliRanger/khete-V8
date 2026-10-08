-- khetE marketplace: separate Professional Accounts, offerings, earnings and payouts.
-- Run after:
--   202607230007_professional_network.sql
--
-- Payment-gateway collection is intentionally not required. Finance staff can
-- record activity manually now; a future gateway/order integration can write
-- to the same professional_earnings ledger.

do $$
begin
  create type public.professional_offering_kind as enum (
    'advisory_service',
    'expert_service',
    'partner_product',
    'partner_service'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.professional_offering_status as enum (
    'active',
    'hidden',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.professional_activity_status as enum (
    'booked',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.professional_earning_status as enum (
    'pending',
    'available',
    'scheduled',
    'paid',
    'withheld',
    'reversed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.professional_account_links (
  profile_id uuid primary key references public.professional_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now()
);

create index if not exists professional_account_links_user_idx
  on public.professional_account_links (user_id);

-- Approved applications are already tied to the applicant's authenticated
-- account, so link those profiles automatically when possible.
insert into public.professional_account_links (profile_id, user_id)
select profile.id, application.applicant_id
from public.professional_profiles as profile
join public.professional_applications as application
  on application.id = profile.source_application_id
where application.applicant_id is not null
on conflict (profile_id) do nothing;

create or replace function private.link_professional_profile_account_from_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_applicant_id uuid;
begin
  if new.source_application_id is null then
    return new;
  end if;

  select applicant_id into v_applicant_id
  from public.professional_applications
  where id = new.source_application_id;

  if v_applicant_id is not null then
    insert into public.professional_account_links (
      profile_id,
      user_id
    )
    values (
      new.id,
      v_applicant_id
    )
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists professional_profiles_link_account on public.professional_profiles;
create trigger professional_profiles_link_account
after insert or update of source_application_id on public.professional_profiles
for each row execute function private.link_professional_profile_account_from_application();

create table if not exists public.professional_offerings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  kind public.professional_offering_kind not null,
  title text not null,
  description text,
  price numeric(14, 2) not null default 0 check (price >= 0),
  unit_label text not null default 'service',
  status public.professional_offering_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_offering_title_length check (char_length(title) between 2 and 160),
  constraint professional_offering_description_length check (
    description is null or char_length(description) <= 1600
  ),
  constraint professional_offering_unit_length check (char_length(unit_label) between 1 and 60)
);

create table if not exists public.professional_earnings (
  id uuid primary key default gen_random_uuid(),
  earning_number text not null unique default (
    'KHE-PRO-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  offering_id uuid references public.professional_offerings(id) on delete set null,
  reference_number text,
  activity_kind public.professional_offering_kind not null,
  title text not null,
  quantity numeric(14, 3) not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  gross_amount numeric(14, 2) not null default 0 check (gross_amount >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  platform_commission numeric(14, 2) not null default 0 check (platform_commission >= 0),
  payment_fee numeric(14, 2) not null default 0 check (payment_fee >= 0),
  shipping_deduction numeric(14, 2) not null default 0 check (shipping_deduction >= 0),
  other_deduction numeric(14, 2) not null default 0 check (other_deduction >= 0),
  net_amount numeric(14, 2) generated always as (
    greatest(
      0::numeric,
      gross_amount
        - discount_amount
        - platform_commission
        - payment_fee
        - shipping_deduction
        - other_deduction
    )
  ) stored,
  activity_status public.professional_activity_status not null default 'booked',
  earning_status public.professional_earning_status not null default 'pending',
  activity_date date not null default current_date,
  completed_at timestamptz,
  payout_reference text,
  paid_at timestamptz,
  internal_note text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_earning_title_length check (char_length(title) between 2 and 180),
  constraint professional_earning_reference_length check (
    reference_number is null or char_length(reference_number) <= 120
  ),
  constraint professional_earning_payout_reference_length check (
    payout_reference is null or char_length(payout_reference) <= 160
  ),
  constraint professional_earning_deductions_limit check (
    discount_amount
      + platform_commission
      + payment_fee
      + shipping_deduction
      + other_deduction
    <= gross_amount
  ),
  constraint professional_earning_paid_shape check (
    earning_status <> 'paid'
    or (paid_at is not null and nullif(trim(coalesce(payout_reference, '')), '') is not null)
  )
);

create index if not exists professional_offerings_profile_status_idx
  on public.professional_offerings (profile_id, status, created_at desc);
create index if not exists professional_earnings_profile_date_idx
  on public.professional_earnings (profile_id, activity_date desc, created_at desc);
create index if not exists professional_earnings_profile_payout_idx
  on public.professional_earnings (profile_id, earning_status, paid_at desc);

drop trigger if exists professional_offerings_set_updated_at on public.professional_offerings;
create trigger professional_offerings_set_updated_at
before update on public.professional_offerings
for each row execute function public.set_updated_at();

drop trigger if exists professional_earnings_set_updated_at on public.professional_earnings;
create trigger professional_earnings_set_updated_at
before update on public.professional_earnings
for each row execute function public.set_updated_at();

create or replace function private.can_manage_professional_finance()
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
      and role in ('super_admin', 'finance_manager', 'order_delivery_manager')
  );
$$;

create or replace function private.owns_professional_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.professional_account_links
    where profile_id = p_profile_id
      and user_id = auth.uid()
  );
$$;

grant execute on function private.can_manage_professional_finance() to authenticated;
grant execute on function private.owns_professional_profile(uuid) to authenticated;

alter table public.professional_account_links enable row level security;
alter table public.professional_offerings enable row level security;
alter table public.professional_earnings enable row level security;

drop policy if exists "linked_professional_reads_own_profile" on public.professional_profiles;
create policy "linked_professional_reads_own_profile"
on public.professional_profiles for select to authenticated
using (private.owns_professional_profile(id));

drop policy if exists "professional_finance_reads_all_profiles" on public.professional_profiles;
create policy "professional_finance_reads_all_profiles"
on public.professional_profiles for select to authenticated
using (private.can_manage_professional_finance());

drop policy if exists "professional_reads_own_account_links" on public.professional_account_links;
create policy "professional_reads_own_account_links"
on public.professional_account_links for select to authenticated
using (
  user_id = auth.uid()
  or private.can_manage_professional_finance()
  or private.can_manage_professional_network()
);

drop policy if exists "public_reads_active_professional_offerings" on public.professional_offerings;
create policy "public_reads_active_professional_offerings"
on public.professional_offerings for select to anon, authenticated
using (status = 'active');

drop policy if exists "professional_team_reads_all_offerings" on public.professional_offerings;
create policy "professional_team_reads_all_offerings"
on public.professional_offerings for select to authenticated
using (
  private.owns_professional_profile(profile_id)
  or private.can_manage_professional_finance()
  or private.can_manage_professional_network()
);

drop policy if exists "professional_finance_inserts_offerings" on public.professional_offerings;
create policy "professional_finance_inserts_offerings"
on public.professional_offerings for insert to authenticated
with check (
  private.can_manage_professional_finance()
  or private.can_manage_professional_network()
);

drop policy if exists "professional_finance_updates_offerings" on public.professional_offerings;
create policy "professional_finance_updates_offerings"
on public.professional_offerings for update to authenticated
using (
  private.can_manage_professional_finance()
  or private.can_manage_professional_network()
)
with check (
  private.can_manage_professional_finance()
  or private.can_manage_professional_network()
);

drop policy if exists "professional_finance_deletes_offerings" on public.professional_offerings;
create policy "professional_finance_deletes_offerings"
on public.professional_offerings for delete to authenticated
using (
  private.can_manage_professional_finance()
  or private.can_manage_professional_network()
);

drop policy if exists "professional_or_finance_reads_earnings" on public.professional_earnings;
create policy "professional_or_finance_reads_earnings"
on public.professional_earnings for select to authenticated
using (
  private.owns_professional_profile(profile_id)
  or private.can_manage_professional_finance()
);

drop policy if exists "professional_finance_inserts_earnings" on public.professional_earnings;
create policy "professional_finance_inserts_earnings"
on public.professional_earnings for insert to authenticated
with check (private.can_manage_professional_finance());

drop policy if exists "professional_finance_updates_earnings" on public.professional_earnings;
create policy "professional_finance_updates_earnings"
on public.professional_earnings for update to authenticated
using (private.can_manage_professional_finance())
with check (private.can_manage_professional_finance());

drop policy if exists "professional_finance_deletes_earnings" on public.professional_earnings;
create policy "professional_finance_deletes_earnings"
on public.professional_earnings for delete to authenticated
using (private.can_manage_professional_finance());

grant select on public.professional_account_links to authenticated;
grant select on public.professional_offerings to anon, authenticated;
grant insert, update, delete on public.professional_offerings to authenticated;
grant select, insert, update, delete on public.professional_earnings to authenticated;

create or replace function public.link_professional_account(
  p_profile_id uuid,
  p_account_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not (
    private.can_manage_professional_finance()
    or private.can_manage_professional_network()
  ) then
    raise exception 'This account cannot link Professional Accounts.';
  end if;

  if not exists (
    select 1 from public.professional_profiles where id = p_profile_id
  ) then
    raise exception 'The selected professional profile was not found.';
  end if;

  if nullif(trim(coalesce(p_account_email, '')), '') is null then
    delete from public.professional_account_links
    where profile_id = p_profile_id;
    return null;
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_account_email))
    and deleted_at is null
  order by created_at desc
  limit 1;

  if v_user_id is null then
    raise exception 'No khetE account was found for that email address. Ask the professional to register first.';
  end if;

  insert into public.professional_account_links (
    profile_id,
    user_id,
    linked_by
  )
  values (
    p_profile_id,
    v_user_id,
    auth.uid()
  )
  on conflict (profile_id) do update
  set
    user_id = excluded.user_id,
    linked_by = auth.uid(),
    linked_at = now();

  return v_user_id;
end;
$$;

revoke all on function public.link_professional_account(uuid, text) from public;
grant execute on function public.link_professional_account(uuid, text) to authenticated;
