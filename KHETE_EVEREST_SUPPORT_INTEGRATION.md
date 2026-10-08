# khetE V8 — Everest Exclusive Support Integration

This update brings the useful structure of the Everest Exclusive “Contact and
Support” experience into khetE while preserving khetE’s working support-ticket
system, roles, replies, assignment, priorities, and internal notes.

## Install

1. Stop the running khetE development server.
2. Extract `khete-V8-everest-support-integration-2026-07-23.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace the files in the destination**.
4. If the original Customer Support migration has not been run, open:

   ```text
   C:\khete-V8\supabase\migrations\202607230005_customer_support.sql
   ```

   Copy its complete SQL contents into Supabase SQL Editor and run it.
5. Open:

   ```text
   C:\khete-V8\supabase\migrations\202607230006_everest_support_integration.sql
   ```

6. Copy the complete SQL contents—not the Windows file path—into Supabase SQL
   Editor and run it.
7. `Success. No rows returned` is the expected result.
8. Restart:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No `npm install` is required.

## Customer support

Open:

```text
http://localhost:3000/support
```

The support page now includes:

- structured topic cards for general, product, order, delivery, payment,
  custom-request, application, account, return, and replacement support;
- a required order/request reference for order, delivery, payment,
  custom-request, cancellation, return, and replacement topics;
- central-support and privacy guidance adapted for khetE;
- real ticket references and a dedicated submission-success screen;
- guest enquiries;
- signed-in request history and conversation replies;
- up to five private PNG, JPG, WebP, or PDF supporting files, with a 5 MB
  maximum per file;
- links for farmer, independent-business, expert, and partner onboarding.

Supporting files require sign-in. Guest users can still submit a support
request without files.

## Admin support

Open:

```text
http://localhost:3000/admin/support
```

The Super Admin, Customer Support, and Order & Delivery Manager roles can:

- search by ticket, customer, email, or order/request reference;
- filter by both status and support topic;
- open private supporting files;
- assign requests;
- set priority and status;
- send customer replies;
- add internal team notes.

## Central-support rule

Customer, farmer, business, expert, and partner support is coordinated by
khetE. Buyers are not connected directly to sellers through support tickets.
Private customer and payment information is not displayed publicly.

Payment-gateway behavior is unchanged.
