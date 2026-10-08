# khetE Admin Standardisation & Verified Staff Invitations

## Install

1. Extract `khete-V8-admin-standard-invitations-update-2026-07-24.zip` into `C:\khete-V8`.
2. Replace matching files.
3. In Supabase, open **SQL Editor → New query**.
4. Open this local migration and copy its SQL contents into the query:

   `C:\khete-V8\supabase\migrations\202607240017_admin_invitations.sql`

5. Click **Run**.
6. Restart the website:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

## Configure the email verification code

In Supabase open **Authentication → Email Templates → Magic Link**. Ensure the message contains:

```text
Your khetE administrator verification code is: {{ .Token }}
```

You may keep `{{ .ConfirmationURL }}` in the same message as an alternative link.

In **Authentication → URL Configuration**, add these redirect URLs using the port on which khetE runs:

```text
http://localhost:3000/admin/verify
http://localhost:3001/admin/verify
```

Add the production-domain version before launch.

## Test the complete workflow

1. Sign in as Super Admin.
2. Open `/admin/users`.
3. Enter the new staff member’s name, email, and phone number.
4. Select one or more roles.
5. Click **Send verification code**.
6. Confirm the record appears under **Pending invitations**.
7. Open `/admin/verify` in a separate/private browser window.
8. Enter the invited email and the emailed one-time code.
9. Confirm the staff member is redirected to `/admin`.
10. Confirm only the authorised sidebar areas are visible.

Authority is not written to `user_roles` until the invited email is verified. Invitations expire after 24 hours. Sending another invitation to the same pending email refreshes its details, roles, and expiry time.

## Included

- Standard khetE visual system for the Admin Login and verification screens
- khetE logo treatment in the admin sidebar
- Consistent admin page shell for Admin Users
- Super Admin invitation form with name, email, phone, and multiple roles
- Email one-time-code verification
- Pending-invitation status list
- Authority activation only after verification
- Existing role editing retained
- Final-Super-Admin protection retained

No new npm package is required.
