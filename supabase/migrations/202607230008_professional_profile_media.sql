-- khetE marketplace: Professional Network profile-photo and brand-logo uploads.
-- Run after 202607230007_professional_network.sql.

-- The marketplace-media bucket is public so approved profile images can be
-- displayed on directory cards and public profile pages. These policies only
-- grant write access to staff roles that can manage the Professional Network.
drop policy if exists "professional_network_media_insert" on storage.objects;
create policy "professional_network_media_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'marketplace-media'
  and (storage.foldername(name))[1] = 'professional-network'
  and private.can_manage_professional_network()
);

drop policy if exists "professional_network_media_update" on storage.objects;
create policy "professional_network_media_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'marketplace-media'
  and (storage.foldername(name))[1] = 'professional-network'
  and private.can_manage_professional_network()
)
with check (
  bucket_id = 'marketplace-media'
  and (storage.foldername(name))[1] = 'professional-network'
  and private.can_manage_professional_network()
);

drop policy if exists "professional_network_media_delete" on storage.objects;
create policy "professional_network_media_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'marketplace-media'
  and (storage.foldername(name))[1] = 'professional-network'
  and private.can_manage_professional_network()
);
