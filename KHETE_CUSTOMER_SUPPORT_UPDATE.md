# khetE V8 — Customer Support & Enquiries update

This update adds a complete customer-support workflow without changing the
deferred payment-gateway functionality.

## Installation

1. Stop the development server with `Ctrl+C`.
2. Extract `khete-V8-customer-support-update-2026-07-23.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace files in the destination**.
4. Open this file in Notepad or VS Code:

   ```text
   C:\khete-V8\supabase\migrations\202607230005_customer_support.sql
   ```

5. Copy the complete SQL contents. Do not copy or paste the Windows file path
   into Supabase.
6. Paste the SQL into the Supabase SQL Editor and choose **Run**.
7. `Success. No rows returned` is the expected result.
8. Restart the website:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

## New pages

- `http://localhost:3000/support`
- `http://localhost:3000/admin/support`

## Included behavior

- Guests can submit an enquiry and receive a support reference number.
- Signed-in customers can view their support history and reply in the same
  conversation.
- Support topics cover product questions, orders, delivery, cancellations,
  returns, payment questions and account issues.
- Super Admin, Customer Support, and Order & Delivery Manager roles can open the
  admin Support workspace.
- Admins can search requests, set status and priority, assign a request to
  themselves, reply to the customer and add private internal notes.
- Header, footer, Customer Account, Return links and the floating chat button
  open the real Support page.
- The chat/WhatsApp entry routes into Support until the official khetE business
  number is configured.

No `npm install` is required. Payment collection remains unchanged.
