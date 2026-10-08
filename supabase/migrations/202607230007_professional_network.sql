-- khetE marketplace: professional network profiles and applications.
-- Requires the initial marketplace migration.

do $$
begin
  create type public.professional_role as enum (
    'advisor',
    'expert_professional',
    'associate_partner'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.professional_application_status as enum (
    'submitted',
    'under_review',
    'changes_requested',
    'approved',
    'rejected',
    'withdrawn'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.professional_profile_status as enum (
    'draft',
    'active',
    'hidden',
    'suspended'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.professional_applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique default (
    'KHETE-NET-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  applicant_id uuid references auth.users(id) on delete set null,
  role public.professional_role not null,
  applicant_name text not null,
  organization_name text,
  position_title text not null,
  contact_email text not null,
  contact_phone text,
  location text not null,
  experience text not null,
  expertise text[] not null default '{}',
  qualifications text[] not null default '{}',
  summary text not null,
  motivation text not null,
  website_url text,
  status public.professional_application_status not null default 'submitted',
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_application_name_length check (char_length(applicant_name) between 2 and 120),
  constraint professional_application_title_length check (char_length(position_title) between 2 and 140),
  constraint professional_application_email_length check (char_length(contact_email) between 3 and 254),
  constraint professional_application_location_length check (char_length(location) between 2 and 140),
  constraint professional_application_summary_length check (char_length(summary) between 40 and 1200),
  constraint professional_application_motivation_length check (char_length(motivation) between 40 and 1600),
  constraint professional_application_expertise_required check (cardinality(expertise) between 1 and 12),
  constraint professional_application_website_http check (
    website_url is null or website_url ~* '^https?://'
  )
);

create table if not exists public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  source_application_id uuid unique references public.professional_applications(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  role public.professional_role not null,
  name text not null,
  position_title text not null,
  organization_name text,
  location text not null,
  experience text not null,
  expertise text[] not null default '{}',
  summary text not null,
  biography text[] not null default '{}',
  achievements text[] not null default '{}',
  qualifications text[] not null default '{}',
  website_url text,
  profile_image_url text,
  tone text not null default 'forest' check (tone in ('forest', 'gold', 'sage', 'earth')),
  status public.professional_profile_status not null default 'draft',
  featured boolean not null default false,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_profile_name_length check (char_length(name) between 2 and 140),
  constraint professional_profile_title_length check (char_length(position_title) between 2 and 140),
  constraint professional_profile_location_length check (char_length(location) between 2 and 140),
  constraint professional_profile_summary_length check (char_length(summary) between 40 and 1200),
  constraint professional_profile_website_http check (
    website_url is null or website_url ~* '^https?://'
  ),
  constraint professional_profile_image_http check (
    profile_image_url is null or profile_image_url ~* '^https?://'
  )
);

create index if not exists professional_applications_status_created_idx
  on public.professional_applications (status, created_at desc);
create index if not exists professional_applications_applicant_created_idx
  on public.professional_applications (applicant_id, created_at desc);
create index if not exists professional_profiles_public_idx
  on public.professional_profiles (status, featured desc, sort_order, published_at desc);
create index if not exists professional_profiles_role_idx
  on public.professional_profiles (role, status, sort_order);

drop trigger if exists professional_applications_set_updated_at on public.professional_applications;
create trigger professional_applications_set_updated_at
before update on public.professional_applications
for each row execute function public.set_updated_at();

drop trigger if exists professional_profiles_set_updated_at on public.professional_profiles;
create trigger professional_profiles_set_updated_at
before update on public.professional_profiles
for each row execute function public.set_updated_at();

create or replace function private.can_manage_professional_network()
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
      and role in ('super_admin', 'content_promotion_manager', 'customer_support')
  );
$$;

grant execute on function private.can_manage_professional_network() to authenticated;

alter table public.professional_applications enable row level security;
alter table public.professional_profiles enable row level security;

drop policy if exists "applicants_or_team_read_professional_applications" on public.professional_applications;
create policy "applicants_or_team_read_professional_applications"
on public.professional_applications for select to authenticated
using (applicant_id = auth.uid() or private.can_manage_professional_network());

drop policy if exists "team_updates_professional_applications" on public.professional_applications;
create policy "team_updates_professional_applications"
on public.professional_applications for update to authenticated
using (private.can_manage_professional_network())
with check (private.can_manage_professional_network());

drop policy if exists "public_reads_active_professional_profiles" on public.professional_profiles;
create policy "public_reads_active_professional_profiles"
on public.professional_profiles for select to anon, authenticated
using (status = 'active');

drop policy if exists "team_reads_all_professional_profiles" on public.professional_profiles;
create policy "team_reads_all_professional_profiles"
on public.professional_profiles for select to authenticated
using (private.can_manage_professional_network());

drop policy if exists "team_creates_professional_profiles" on public.professional_profiles;
create policy "team_creates_professional_profiles"
on public.professional_profiles for insert to authenticated
with check (private.can_manage_professional_network());

drop policy if exists "team_updates_professional_profiles" on public.professional_profiles;
create policy "team_updates_professional_profiles"
on public.professional_profiles for update to authenticated
using (private.can_manage_professional_network())
with check (private.can_manage_professional_network());

drop policy if exists "team_deletes_professional_profiles" on public.professional_profiles;
create policy "team_deletes_professional_profiles"
on public.professional_profiles for delete to authenticated
using (private.can_manage_professional_network());

grant select on public.professional_applications to authenticated;
grant update (status, admin_notes, reviewed_by, reviewed_at) on public.professional_applications to authenticated;
grant select on public.professional_profiles to anon, authenticated;
grant insert, update, delete on public.professional_profiles to authenticated;

create or replace function public.create_professional_application(
  p_role text,
  p_name text,
  p_organization text,
  p_position text,
  p_email text,
  p_phone text,
  p_location text,
  p_experience text,
  p_expertise text[],
  p_qualifications text[],
  p_summary text,
  p_motivation text,
  p_website_url text
)
returns table (application_id uuid, application_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.professional_role;
  v_application public.professional_applications%rowtype;
begin
  begin
    v_role := p_role::public.professional_role;
  exception when others then
    raise exception 'Choose a valid professional-network role.';
  end;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Enter the applicant or representative name.';
  end if;
  if char_length(trim(coalesce(p_position, ''))) < 2 then
    raise exception 'Enter the professional title or partnership role.';
  end if;
  if char_length(trim(coalesce(p_email, ''))) < 3 or position('@' in p_email) = 0 then
    raise exception 'Enter a valid contact email.';
  end if;
  if char_length(trim(coalesce(p_location, ''))) < 2 then
    raise exception 'Enter the applicant location.';
  end if;
  if cardinality(coalesce(p_expertise, '{}')) = 0 then
    raise exception 'Add at least one field of expertise.';
  end if;
  if char_length(trim(coalesce(p_summary, ''))) < 40 then
    raise exception 'Write a professional summary of at least 40 characters.';
  end if;
  if char_length(trim(coalesce(p_motivation, ''))) < 40 then
    raise exception 'Explain the reason for joining in at least 40 characters.';
  end if;
  if nullif(trim(coalesce(p_website_url, '')), '') is not null
    and trim(p_website_url) !~* '^https?://' then
    raise exception 'The website address must begin with http:// or https://.';
  end if;

  insert into public.professional_applications (
    applicant_id,
    role,
    applicant_name,
    organization_name,
    position_title,
    contact_email,
    contact_phone,
    location,
    experience,
    expertise,
    qualifications,
    summary,
    motivation,
    website_url
  )
  values (
    auth.uid(),
    v_role,
    trim(p_name),
    nullif(trim(coalesce(p_organization, '')), ''),
    trim(p_position),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_phone, '')), ''),
    trim(p_location),
    trim(p_experience),
    coalesce(p_expertise, '{}'),
    coalesce(p_qualifications, '{}'),
    trim(p_summary),
    trim(p_motivation),
    nullif(trim(coalesce(p_website_url, '')), '')
  )
  returning * into v_application;

  return query select v_application.id, v_application.application_number;
end;
$$;

revoke all on function public.create_professional_application(
  text, text, text, text, text, text, text, text, text[], text[], text, text, text
) from public;
grant execute on function public.create_professional_application(
  text, text, text, text, text, text, text, text, text[], text[], text, text, text
) to anon, authenticated;

create or replace function public.review_professional_application(
  p_application_id uuid,
  p_decision text,
  p_notes text default null,
  p_publish boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.professional_applications%rowtype;
  v_decision public.professional_application_status;
  v_profile_id uuid;
  v_profile_name text;
  v_slug text;
begin
  if not private.can_manage_professional_network() then
    raise exception 'This account cannot review professional-network applications.';
  end if;

  begin
    v_decision := p_decision::public.professional_application_status;
  exception when others then
    raise exception 'Choose a valid application decision.';
  end;

  if v_decision not in ('under_review', 'changes_requested', 'approved', 'rejected') then
    raise exception 'This application decision is not available to the admin team.';
  end if;

  select * into v_application
  from public.professional_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'The selected professional-network application was not found.';
  end if;

  update public.professional_applications
  set
    status = v_decision,
    admin_notes = nullif(trim(coalesce(p_notes, '')), ''),
    reviewed_by = auth.uid(),
    reviewed_at = case when v_decision in ('approved', 'rejected') then now() else null end
  where id = p_application_id;

  if v_decision <> 'approved' then
    return null;
  end if;

  v_profile_name := case
    when v_application.role = 'associate_partner'
      and nullif(trim(coalesce(v_application.organization_name, '')), '') is not null
      then trim(v_application.organization_name)
    else trim(v_application.applicant_name)
  end;
  v_slug := trim(both '-' from regexp_replace(lower(v_profile_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'network-profile';
  end if;
  v_slug := v_slug || '-' || substr(replace(v_application.id::text, '-', ''), 1, 8);

  insert into public.professional_profiles (
    source_application_id,
    slug,
    role,
    name,
    position_title,
    organization_name,
    location,
    experience,
    expertise,
    summary,
    biography,
    qualifications,
    website_url,
    tone,
    status,
    published_at,
    created_by,
    updated_by
  )
  values (
    v_application.id,
    v_slug,
    v_application.role,
    v_profile_name,
    v_application.position_title,
    v_application.organization_name,
    v_application.location,
    v_application.experience,
    v_application.expertise,
    v_application.summary,
    array[v_application.summary, v_application.motivation],
    v_application.qualifications,
    v_application.website_url,
    case v_application.role
      when 'advisor' then 'forest'
      when 'expert_professional' then 'gold'
      else 'earth'
    end,
    case when p_publish then 'active'::public.professional_profile_status else 'draft'::public.professional_profile_status end,
    case when p_publish then now() else null end,
    auth.uid(),
    auth.uid()
  )
  on conflict (source_application_id) do update
  set
    status = excluded.status,
    published_at = case
      when excluded.status = 'active' and public.professional_profiles.published_at is null then now()
      else public.professional_profiles.published_at
    end,
    updated_by = auth.uid()
  returning id into v_profile_id;

  return v_profile_id;
end;
$$;

revoke all on function public.review_professional_application(uuid, text, text, boolean) from public;
grant execute on function public.review_professional_application(uuid, text, text, boolean) to authenticated;
