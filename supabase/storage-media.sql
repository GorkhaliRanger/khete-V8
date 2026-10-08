-- Run once in Supabase SQL Editor after the main marketplace migration.
-- One public bucket stores category icons and standardized listing photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-media',
  'marketplace-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "marketplace_media_public_read" on storage.objects;
create policy "marketplace_media_public_read"
on storage.objects for select
to public
using (bucket_id = 'marketplace-media');

drop policy if exists "marketplace_media_catalog_insert" on storage.objects;
create policy "marketplace_media_catalog_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'marketplace-media'
  and private.can_manage_catalog()
);

drop policy if exists "marketplace_media_catalog_update" on storage.objects;
create policy "marketplace_media_catalog_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'marketplace-media'
  and private.can_manage_catalog()
)
with check (
  bucket_id = 'marketplace-media'
  and private.can_manage_catalog()
);

drop policy if exists "marketplace_media_catalog_delete" on storage.objects;
create policy "marketplace_media_catalog_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'marketplace-media'
  and private.can_manage_catalog()
);
