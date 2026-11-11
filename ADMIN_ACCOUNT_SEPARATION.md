# Admin and customer account separation

Admin and the customer marketplace have independent profile records and browser sessions, even when the same email and password authenticate the underlying Supabase user.

## Independent behavior

- Admin uses `public.admin_profiles` for name, phone, image, and active status.
- The marketplace continues to use `public.profiles` and its customer photo cache.
- Admin photos use the `khete-admin-photo:<user-id>` cache and never import customer or Google photos automatically.
- Admin authentication uses the `khete-admin-auth` cookie and separate browser/server clients.
- Login, logout, account switching, OAuth callbacks, and recovery use the selected area’s session.
- Deleting an administrator removes Admin roles and the Admin profile. It preserves the Auth identity, customer profile, customer role, and orders.
- Deactivation or deletion cancels pending Admin invitations for that account so an old invitation cannot restore access.

The existing Supabase Auth identity still holds one sign-in password. Changing that password affects every area using that identity. Independently managed passwords for the same email would require a separate authentication identity or project; this change does not create one.

## Database activation

**Live status, 9 November 2026:** Setup is active. Connected Supabase checks confirmed the separate Admin tables, own-profile column grants/RLS, the image bucket and four Storage policies, and zero administrators missing an Admin profile. The authenticated settings page now enables name/mobile editing and photo upload. A live name Save succeeded; the uploaded image is visible after reload and its stored file/reference were verified. No agent-side DDL reapplication was needed.

The original schema/profile activation was applied manually. The subsequent directory return-type fix is registered as migration `20261110064556_fix_admin_directory_email_return_type`; the password-request ledger was activated manually on 10 November. Review/baseline manual history before adopting automated `db push` rather than assuming every repository migration is pending.

For the missing Admin profile setup diagnosed on 9 November, open `supabase/setup/activate-admin-profiles.sql` and run the entire file in the configured Supabase project's SQL Editor:

https://supabase.com/dashboard/project/xcyxzfthyirsofpnzxsz/sql/new

The setup file packages the three November migrations below in one transaction, checks prerequisites before changing the schema, and prints verification results afterward. Do not run selected sections. The final migration restores the separate Admin profile routines before the transaction commits.

After successful execution, the final `administrators_without_profile` result should be `0`. Return to `/admin/settings`, choose **Check setup again** or reload the page, then save a name/mobile edit and upload a photo. Reload once more to confirm persistence.

The packaged migrations, in order, are:

1. `supabase/migrations/20261107113340_admin_account_security.sql`
2. `supabase/migrations/20261107135430_admin_profile_settings.sql`
3. `supabase/migrations/20261109111341_isolate_admin_profiles.sql`

These follow the original marketplace and Admin invitation migrations already in the repository. The separation migration checks its Admin prerequisites before changing the schema. It preserves existing staff names and phone numbers once, and deliberately starts Admin photos unset. Subsequent Admin profile changes never write to the customer profile.

In Supabase Auth, allow these redirect URLs for each actual development/production origin:

- `/admin/auth/callback`
- `/admin/update-password`

Keep the existing customer `/auth/callback` redirect configured separately. After updating the app, sign in at `/admin/login`; the customer session is no longer reused automatically. Upload the Admin photo in `/admin/settings`.

Admin deletion now uses a guarded database function and does not require a service-role key.

## Verification recorded on 9 November 2026

- Restarting the verified local Next.js development server restored the missing routes without deleting cache or changing routes.
- All 17 original Admin routes returned HTTP 200 after restart. After the source update, those routes plus `/admin/update-password`, `/`, `/products`, and `/account` returned HTTP 200.
- TypeScript checked the application successfully.
- The separation migration was executed in a temporary PostgreSQL test runtime with representative fixtures. Checks covered RLS, Admin/customer data isolation, invitation activation/cancellation, protected Super Admin records, and Admin-only deletion.
- Browser-client tests verified separate singleton instances, cookie names, cache keys, callbacks, and Admin import boundaries.
- Supabase connected and the live schema, RLS, grants, Storage bucket/policies and independent Admin helpers were verified. An authenticated name save succeeded; mobile editing opened correctly; the uploaded image persisted after reload and its file/reference were verified.
- The user initially chose manual activation SQL. Later checks confirmed setup was active, so no DDL was reapplied. Preparing the file alone had not activated it; the live checks now establish the current state.
- A broad Admin lint check found existing React hook/purity issues in Listings and Orders. The new separation files are checked separately; no unrelated behavior was changed to suppress those findings.
