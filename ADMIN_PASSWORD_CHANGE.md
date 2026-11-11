# Admin password changes

Profile & Settings shows one **Change password** button. Its popup asks for the new password and confirmation. A default Supabase recovery email supplies a one-time verification link; numeric OTP was superseded by the user's choice on 9 November 2026.

Open the email link in the same browser as the original profile tab. The original popup keeps the new password in memory and completes the change only after the link is verified. Closing the popup cancels the request. If the original tab is closed, start a new request.

The server verifies the active Admin role and profile, binds PKCE proof to that user and session, seals its verifier/recovery session in an encrypted HttpOnly cookie, and claims the request once before changing Auth credentials. Only request IDs, owners and timestamps are stored in the database. Customer profile/session data is not used. The underlying Supabase Auth password is shared by any area using the same identity.

## Deployment

- Set server-only `ADMIN_PASSWORD_FLOW_SECRET` to 32 random bytes encoded as base64. Keep the same value across application replicas. It is already configured locally and must never be a `NEXT_PUBLIC_` variable.
- Apply the password-verification ledger migration, or run the entire `supabase/setup/activate-admin-password-verification.sql` file in the project's SQL Editor. That wrapper uses one transaction and returns verification booleans.
- Allow the actual site's `/admin/update-password` redirect in Supabase. The local `http://localhost:3000/**` entry is configured already.
- Serve production over HTTPS. Recovery responses use no-store and no-referrer headers. The existing implicit reset-email path also checks verified, fresh email-authentication claims; a plain signed-in page visit is insufficient.

## Verification

52 flow checks, 22 PostgreSQL ledger checks, and 27 legacy-entry/trusted-claims checks pass. TypeScript and targeted ESLint pass. The popup opens, receives keyboard focus, and closes back to the profile without entering a real credential. Cross-origin and signed-out API requests were rejected.

No real password was changed in testing. A user must enter and submit their own new credential and open the emailed verification link to exercise live email delivery and the final Auth mutation.

## Activation status, 10 November 2026

The connector's migration confirmation expired twice, so the complete atomic setup was prepared in the authenticated Supabase SQL Editor. Its execution then returned all verification booleans true. Connected live checks confirmed the table, metadata-only columns, three ownership policies, protected column grants, blocked anonymous access and invoker-rights atomic consumption. Database activation is complete.

The directory return-type fix is registered as Supabase migration `20261110064556_fix_admin_directory_email_return_type`. This password-ledger setup was executed manually; baseline manual schema history before adopting automated deployment.

Sources: [Supabase PKCE and cookies](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [password recovery API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
