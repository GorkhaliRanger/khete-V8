-- khetE marketplace: public certificates, verification records and entity links.
-- Requires:
--   202607160001_initial_marketplace.sql
--   202607230007_professional_network.sql
--   202607230009_professional_accounts.sql
--
-- A certificate can remain independent or be linked to multiple professional
-- profiles, marketplace listings, professional offerings, farms or people.

do $$
begin
  create type public.certificate_status as enum (
    'draft',
    'verified',
    'expired',
    'revoked',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.certificate_subject_kind as enum (
    'person',
    'farm'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.certificate_subjects (
  id uuid primary key default gen_random_uuid(),
  kind public.certificate_subject_kind not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null,
  subtitle text,
  location text,
  description text,
  image_url text,
  is_public boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificate_subject_name_length
    check (char_length(display_name) between 2 and 160),
  constraint certificate_subject_image_http
    check (image_url is null or image_url ~* '^https?://')
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  certificate_type text not null default 'other',
  issuer text not null,
  certificate_number text not null,
  summary text not null,
  full_text text,
  issued_on date,
  valid_from date,
  expires_on date,
  status public.certificate_status not null default 'draft',
  verification_url text,
  document_url text,
  document_storage_path text,
  document_mime_type text,
  is_public boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificate_title_length
    check (char_length(title) between 3 and 180),
  constraint certificate_issuer_length
    check (char_length(issuer) between 2 and 180),
  constraint certificate_number_length
    check (char_length(certificate_number) between 1 and 120),
  constraint certificate_summary_length
    check (char_length(summary) between 10 and 1200),
  constraint certificate_dates_valid
    check (
      expires_on is null
      or coalesce(valid_from, issued_on, expires_on) <= expires_on
    ),
  constraint certificate_verification_http
    check (verification_url is null or verification_url ~* '^https?://'),
  constraint certificate_document_http
    check (document_url is null or document_url ~* '^https?://'),
  constraint certificate_public_has_content
    check (
      not is_public
      or status not in ('verified', 'expired')
      or document_url is not null
      or nullif(trim(coalesce(full_text, '')), '') is not null
    ),
  unique (issuer, certificate_number)
);

create table if not exists public.certificate_links (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  professional_profile_id uuid references public.professional_profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  professional_offering_id uuid references public.professional_offerings(id) on delete cascade,
  subject_id uuid references public.certificate_subjects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint certificate_link_one_target
    check (
      num_nonnulls(
        professional_profile_id,
        listing_id,
        professional_offering_id,
        subject_id
      ) = 1
    )
);

create index if not exists certificates_public_status_idx
  on public.certificates (is_public, status, issued_on desc, created_at desc);
create index if not exists certificates_type_idx
  on public.certificates (certificate_type, status);
create index if not exists certificate_subjects_public_kind_idx
  on public.certificate_subjects (is_public, kind, display_name);
create index if not exists certificate_links_certificate_idx
  on public.certificate_links (certificate_id);
create index if not exists certificate_links_profile_idx
  on public.certificate_links (professional_profile_id)
  where professional_profile_id is not null;
create index if not exists certificate_links_listing_idx
  on public.certificate_links (listing_id)
  where listing_id is not null;
create index if not exists certificate_links_offering_idx
  on public.certificate_links (professional_offering_id)
  where professional_offering_id is not null;
create index if not exists certificate_links_subject_idx
  on public.certificate_links (subject_id)
  where subject_id is not null;

create unique index if not exists certificate_links_profile_unique
  on public.certificate_links (certificate_id, professional_profile_id)
  where professional_profile_id is not null;
create unique index if not exists certificate_links_listing_unique
  on public.certificate_links (certificate_id, listing_id)
  where listing_id is not null;
create unique index if not exists certificate_links_offering_unique
  on public.certificate_links (certificate_id, professional_offering_id)
  where professional_offering_id is not null;
create unique index if not exists certificate_links_subject_unique
  on public.certificate_links (certificate_id, subject_id)
  where subject_id is not null;

drop trigger if exists certificate_subjects_set_updated_at
  on public.certificate_subjects;
create trigger certificate_subjects_set_updated_at
before update on public.certificate_subjects
for each row execute function public.set_updated_at();

drop trigger if exists certificates_set_updated_at
  on public.certificates;
create trigger certificates_set_updated_at
before update on public.certificates
for each row execute function public.set_updated_at();

create or replace function private.can_manage_certificates()
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
        'product_inventory_manager',
        'customer_support',
        'content_promotion_manager'
      )
  );
$$;

grant execute on function private.can_manage_certificates() to authenticated;

alter table public.certificates enable row level security;
alter table public.certificate_subjects enable row level security;
alter table public.certificate_links enable row level security;

drop policy if exists "public_reads_visible_certificates" on public.certificates;
create policy "public_reads_visible_certificates"
on public.certificates for select to anon, authenticated
using (
  is_public
  and status in ('verified', 'expired')
);

drop policy if exists "team_reads_all_certificates" on public.certificates;
create policy "team_reads_all_certificates"
on public.certificates for select to authenticated
using (private.can_manage_certificates());

drop policy if exists "team_creates_certificates" on public.certificates;
create policy "team_creates_certificates"
on public.certificates for insert to authenticated
with check (private.can_manage_certificates());

drop policy if exists "team_updates_certificates" on public.certificates;
create policy "team_updates_certificates"
on public.certificates for update to authenticated
using (private.can_manage_certificates())
with check (private.can_manage_certificates());

drop policy if exists "team_deletes_certificates" on public.certificates;
create policy "team_deletes_certificates"
on public.certificates for delete to authenticated
using (private.can_manage_certificates());

drop policy if exists "public_reads_visible_certificate_subjects"
  on public.certificate_subjects;
create policy "public_reads_visible_certificate_subjects"
on public.certificate_subjects for select to anon, authenticated
using (is_public);

drop policy if exists "team_reads_all_certificate_subjects"
  on public.certificate_subjects;
create policy "team_reads_all_certificate_subjects"
on public.certificate_subjects for select to authenticated
using (private.can_manage_certificates());

drop policy if exists "team_creates_certificate_subjects"
  on public.certificate_subjects;
create policy "team_creates_certificate_subjects"
on public.certificate_subjects for insert to authenticated
with check (private.can_manage_certificates());

drop policy if exists "team_updates_certificate_subjects"
  on public.certificate_subjects;
create policy "team_updates_certificate_subjects"
on public.certificate_subjects for update to authenticated
using (private.can_manage_certificates())
with check (private.can_manage_certificates());

drop policy if exists "team_deletes_certificate_subjects"
  on public.certificate_subjects;
create policy "team_deletes_certificate_subjects"
on public.certificate_subjects for delete to authenticated
using (private.can_manage_certificates());

drop policy if exists "public_reads_visible_certificate_links"
  on public.certificate_links;
create policy "public_reads_visible_certificate_links"
on public.certificate_links for select to anon, authenticated
using (
  exists (
    select 1
    from public.certificates certificate
    where certificate.id = certificate_id
      and certificate.is_public
      and certificate.status in ('verified', 'expired')
  )
);

drop policy if exists "team_reads_all_certificate_links"
  on public.certificate_links;
create policy "team_reads_all_certificate_links"
on public.certificate_links for select to authenticated
using (private.can_manage_certificates());

drop policy if exists "team_creates_certificate_links"
  on public.certificate_links;
create policy "team_creates_certificate_links"
on public.certificate_links for insert to authenticated
with check (private.can_manage_certificates());

drop policy if exists "team_updates_certificate_links"
  on public.certificate_links;
create policy "team_updates_certificate_links"
on public.certificate_links for update to authenticated
using (private.can_manage_certificates())
with check (private.can_manage_certificates());

drop policy if exists "team_deletes_certificate_links"
  on public.certificate_links;
create policy "team_deletes_certificate_links"
on public.certificate_links for delete to authenticated
using (private.can_manage_certificates());

grant select on public.certificates to anon, authenticated;
grant select on public.certificate_subjects to anon, authenticated;
grant select on public.certificate_links to anon, authenticated;
grant insert, update, delete on public.certificates to authenticated;
grant insert, update, delete on public.certificate_subjects to authenticated;
grant insert, update, delete on public.certificate_links to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificate-documents',
  'certificate-documents',
  true,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public_reads_certificate_documents" on storage.objects;
create policy "public_reads_certificate_documents"
on storage.objects for select to anon, authenticated
using (bucket_id = 'certificate-documents');

drop policy if exists "team_uploads_certificate_documents" on storage.objects;
create policy "team_uploads_certificate_documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'certificate-documents'
  and private.can_manage_certificates()
);

drop policy if exists "team_updates_certificate_documents" on storage.objects;
create policy "team_updates_certificate_documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'certificate-documents'
  and private.can_manage_certificates()
)
with check (
  bucket_id = 'certificate-documents'
  and private.can_manage_certificates()
);

drop policy if exists "team_deletes_certificate_documents" on storage.objects;
create policy "team_deletes_certificate_documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'certificate-documents'
  and private.can_manage_certificates()
);
