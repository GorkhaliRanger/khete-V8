-- khetE professional credentials upload.
-- Lets verified Advisors / Expert Professionals / Associate Partners upload their own
-- certificates and documents. Uploaded records are always created as DRAFT and
-- PRIVATE — only the khetE admin team can verify them or make them public.
-- Until then they are internal (khetE legal/verification) documents only.
-- Run once in the Supabase SQL Editor. Safe to run again.

-- Helper: is the current user a linked professional (has a professional account)?
create or replace function private.has_professional_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.professional_account_links
    where user_id = auth.uid()
  );
$$;

-- Helper: is the given professional profile managed by the current user?
create or replace function private.manages_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.professional_account_links
    where user_id = auth.uid() and profile_id = p_profile_id
  );
$$;

-- Professionals may upload certificates, but ONLY as non-public drafts.
drop policy if exists "professionals_create_draft_certificates" on public.certificates;
create policy "professionals_create_draft_certificates"
on public.certificates for insert to authenticated
with check (
  private.has_professional_account()
  and status = 'draft'
  and is_public = false
  and created_by = auth.uid()
);

-- Professionals can see the certificates they uploaded (to track review status).
drop policy if exists "professionals_read_own_certificates" on public.certificates;
create policy "professionals_read_own_certificates"
on public.certificates for select to authenticated
using (created_by = auth.uid());

-- Professionals may link a certificate only to their own profile.
drop policy if exists "professionals_create_own_certificate_links" on public.certificate_links;
create policy "professionals_create_own_certificate_links"
on public.certificate_links for insert to authenticated
with check (
  created_by = auth.uid()
  and professional_profile_id is not null
  and private.manages_profile(professional_profile_id)
);

-- Professionals can see the certificate links of their own profiles.
drop policy if exists "professionals_read_own_certificate_links" on public.certificate_links;
create policy "professionals_read_own_certificate_links"
on public.certificate_links for select to authenticated
using (
  created_by = auth.uid()
  or (
    professional_profile_id is not null
    and private.manages_profile(professional_profile_id)
  )
);

-- Professionals may upload document files to the certificate-documents bucket.
-- (Public read stays as-is; team management policies stay as-is.)
drop policy if exists "professionals_upload_certificate_documents" on storage.objects;
create policy "professionals_upload_certificate_documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'certificate-documents'
  and private.has_professional_account()
);

-- Confirmation
select 'policies added' as result;
