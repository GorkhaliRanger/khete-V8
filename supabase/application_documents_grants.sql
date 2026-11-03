-- khetE marketplace: allow signed-in applicants and the admin team to
-- read/insert professional application document records.
-- Safe to run multiple times.

grant select, insert on public.professional_application_documents to authenticated;

select 'application document grants applied' as result;
