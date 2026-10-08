# khetE Admin Login & Authority Management

Date: 24 July 2026

## What this update adds

- A dedicated, private-facing admin login page at `/admin/login`.
- Admin login uses the existing Supabase account and password system.
- Customer accounts without an administration role are refused.
- Public admin registration is not available.
- A Super Admin workspace at `/admin/users`.
- One registered account can hold several administration roles.
- The final Super Admin cannot be removed.
- Admin access errors now lead directly to the dedicated admin login.
- Role-aware admin navigation hides areas outside the signed-in staff member's authority when roles are supplied to the sidebar.

## Administration roles

| Role | Main authority |
|---|---|
| Super Admin | Complete access and admin-user authority |
| Product & Inventory Manager | Categories, listings, inventory, imports, reviews and certificates |
| Order & Delivery Manager | Orders, delivery, support and professional finance records |
| Customer Support | Customer cases, order support, reviews and Professional Network cases |
| Finance Manager | Collections, invoices, commissions, earnings and payouts |
| Content & Promotion Manager | Banners, promotions, Deals, policies, reviews and public content |

## Installation

1. Stop the development server with `Ctrl+C`.
2. Extract `khete-V8-admin-login-authority-update-2026-07-24.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Replace matching files when Windows asks.
4. Open this file:

   ```text
   C:\khete-V8\supabase\migrations\202607240016_admin_access_management.sql
   ```

5. Copy the SQL contents into **Supabase Dashboard → SQL Editor → New query** and click **Run**.
6. Restart:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No `npm install` is required.

## Test the admin login

Open:

```text
http://localhost:3000/admin/login
```

Use port `3001` if that is the active address shown in PowerShell.

1. Sign in with the existing Super Admin account.
2. Confirm that it opens `/admin`.
3. Open **Admin Users** or:

   ```text
   http://localhost:3000/admin/users
   ```

4. Select a registered account.
5. Choose one or more roles.
6. Click **Save authority**.
7. Sign in using that staff account and verify its permitted admin pages.

## Important account rule

An administrator must first have a normal registered khetE account. The Super Admin then assigns administration authority from `/admin/users`. This avoids a public admin-registration form and keeps all credentials in Supabase authentication.

## Verification completed

- ESLint passed.
- TypeScript passed.
- Next.js production build passed.
- All 48 application routes compiled, including `/admin/login` and `/admin/users`.
