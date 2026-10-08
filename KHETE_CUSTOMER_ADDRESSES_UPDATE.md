# khetE V8 — Customer Address Book & Checkout Profiles

This update adds private saved delivery profiles to customer accounts and
connects them to the existing checkout.

Online payment collection remains disconnected.

## Before installing

The initial marketplace migration and the existing checkout/orders foundation
must already be installed. If customer login, Cart and Checkout are working,
this requirement is complete.

## Install on Windows

1. Stop the khetE development server with `Ctrl+C`.
2. Extract `khete-V8-customer-addresses-update-2026-07-23.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace the files in the destination**.
4. Open:

   ```text
   C:\khete-V8\supabase\migrations\202607230012_customer_addresses.sql
   ```

5. Copy the complete SQL contents into the Supabase SQL Editor.
6. Click **Run**.

Do not paste the Windows file path into the SQL Editor. A successful run should
show **Success. No rows returned**.

## Restart

```powershell
cd C:\khete-V8
npm.cmd run dev
```

No `npm install` is required.

## New customer page

Open:

```text
http://localhost:3000/account/addresses
```

Customers can:

- add Home, Farm, Office or other delivery profiles;
- edit or delete their own profiles;
- choose one default address;
- save recipient, phone, email and full Nepal delivery details;
- keep an optional delivery note;
- open the address book from the Account page.

Address records are private. Supabase Row Level Security limits every customer
to their own addresses.

## Checkout behavior

1. Add a product to Cart and open Checkout.
2. Sign in with a customer account.
3. The compatible default delivery profile is selected automatically.
4. Selecting another saved profile fills the contact and delivery form.
5. Profiles outside the cart's supported districts are visible but cannot be
   selected.
6. Choose **Use another address** to enter one-time details.
7. Use **Manage addresses** to add, edit or change the default profile.

The selected address is copied into the order when the order request is
submitted. Later edits to the address book do not alter an existing order's
delivery record.

## Default-address rules

- The first saved profile automatically becomes the default.
- Only one profile can be the default at a time.
- Choosing a new default removes the previous default automatically.
- If the default profile is deleted, the most recently updated remaining
  profile becomes the default.

These rules are enforced by the database as well as the customer interface.

## What remains postponed

- eSewa, Khalti and card/bank gateway collection
- cash on delivery
- automatic email and SMS confirmations

This update does not charge customers and does not enable a payment method.

## Verification completed

- ESLint
- TypeScript
- Next.js production build
- `/account/addresses` route compilation
- Checkout integration compilation
- Update archive integrity
