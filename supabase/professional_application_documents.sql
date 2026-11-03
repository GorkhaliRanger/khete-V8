-- khetE professional application documents.
-- Applicants for Advisor / Expert Professional / Associate Partner can attach
-- supporting documents (citizenship, degrees, licences, certificates) to their
-- application. Documents are PRIVATE: visible only to the applicant and the
-- khetE admin team. Run once in the Supabase SQL Editor. Safe to run again.

-- Private storage bucket for application documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Applicants upload their own documents (paths are prefixed with their user id)
drop policy if exists "applicants_upload_application_documents" on storage.objects;
create policy "applicants_upload_application_documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Applicants can read their own uploaded documents
drop policy if exists "applicants_read_application_documents" on storage.objects;
create policy "applicants_read_application_documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- khetE admin team manages all application documents
drop policy if exists "team_manages_application_documents" on storage.objects;
create policy "team_manages_application_documents"
on storage.objects for all to authenticated
using (
  bucket_id = 'application-documents'
  and private.can_manage_professional_network()
)
with check (
  bucket_id = 'application-documents'
  and private.can_manage_professional_network()
);

-- Documents attached to an application
create table if not exists public.professional_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.professional_applications(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists professional_application_documents_application_idx
  on public.professional_application_documents (application_id, created_at desc);

alter table public.professional_application_documents enable row level security;

-- Applicants see documents on their own applications
drop policy if exists "applicants_read_application_documents_rows" on public.professional_application_documents;
create policy "applicants_read_application_documents_rows"
on public.professional_application_documents for select to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.professional_applications
    where professional_applications.id = application_id
      and professional_applications.applicant_id = auth.uid()
  )
);

-- Applicants attach documents only to their own applications
drop policy if exists "applicants_create_application_documents" on public.professional_application_documents;
create policy "applicants_create_application_documents"
on public.professional_application_documents for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.professional_applications
    where professional_applications.id = application_id
      and professional_applications.applicant_id = auth.uid()
  )
);

-- khetE admin team manages all rows
drop policy if exists "team_manages_application_documents_rows" on public.professional_application_documents;
create policy "team_manages_application_documents_rows"
on public.professional_application_documents for all to authenticated
using (private.can_manage_professional_network())
with check (private.can_manage_professional_network());

grant select, insert on public.professional_application_documents to authenticated;

select 'application documents ready' as result;
