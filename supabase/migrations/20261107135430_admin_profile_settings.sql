-- Dedicated public avatars for the Admin identity header.
-- Writes are limited to an active administrator's own user-id folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-profile-images',
  'admin-profile-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_profile_images_public_read" on storage.objects;
create policy "admin_profile_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'admin-profile-images');

drop policy if exists "admins_upload_own_profile_image" on storage.objects;
create policy "admins_upload_own_profile_image"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'admin-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    private.has_role('super_admin')
    or private.has_role('product_inventory_manager')
    or private.has_role('order_delivery_manager')
    or private.has_role('customer_support')
    or private.has_role('finance_manager')
    or private.has_role('content_promotion_manager')
  )
);

drop policy if exists "admins_update_own_profile_image" on storage.objects;
create policy "admins_update_own_profile_image"
on storage.objects for update
to authenticated
using (
  bucket_id = 'admin-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    private.has_role('super_admin')
    or private.has_role('product_inventory_manager')
    or private.has_role('order_delivery_manager')
    or private.has_role('customer_support')
    or private.has_role('finance_manager')
    or private.has_role('content_promotion_manager')
  )
)
with check (
  bucket_id = 'admin-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    private.has_role('super_admin')
    or private.has_role('product_inventory_manager')
    or private.has_role('order_delivery_manager')
    or private.has_role('customer_support')
    or private.has_role('finance_manager')
    or private.has_role('content_promotion_manager')
  )
);

drop policy if exists "admins_delete_own_profile_image" on storage.objects;
create policy "admins_delete_own_profile_image"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'admin-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    private.has_role('super_admin')
    or private.has_role('product_inventory_manager')
    or private.has_role('order_delivery_manager')
    or private.has_role('customer_support')
    or private.has_role('finance_manager')
    or private.has_role('content_promotion_manager')
  )
);
