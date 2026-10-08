# khetE V8 — Order Tracking, Delivery & Documents

This update turns the existing order history into a complete customer order
centre with detailed tracking, delivery confirmation, support links, printable
documents, and controlled Finance issuance.

Online payment collection remains disconnected.

## Before installing

The earlier Orders migration must already be installed:

```text
202607220001_orders.sql
```

If `/admin/orders` and the existing order history are already working, this
requirement is complete.

## Install on Windows

1. Stop the khetE development server with `Ctrl+C`.
2. Extract `khete-V8-order-tracking-documents-update-2026-07-23.zip` directly
   into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace the files in the destination**.
4. Open this file in Notepad or VS Code:

   ```text
   C:\khete-V8\supabase\migrations\202607230011_order_tracking_documents.sql
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

## New customer pages

- `/account/orders` — all orders, search, status filters, tracking and document
  counts
- `/account/orders/[order-number]` — full order, delivery, totals, history,
  documents and support actions
- `/account/orders/[order-number]/document/[document-type]` — printable order
  confirmation or invoice

The Checkout success screen now links directly to the newly submitted order.

## Customer workflow

1. Sign in with a customer account that has an order.
2. Open:

   ```text
   http://localhost:3000/account/orders
   ```

3. Open an order and verify:
   - order and payment status;
   - fulfilment progress;
   - tracking reference and estimated delivery;
   - item and total details;
   - complete status history;
   - return/replacement deadline;
   - issued documents;
   - prefilled Support links for cancellation, return, delivery and payment.
4. After an admin marks the order **Delivered**, use **Confirm delivery**.
5. Open an issued document and choose **Print or save PDF**.

Cancellation, return, replacement, delivery and payment requests use the
existing central khetE Support system. They are not sent directly to a seller.

## Admin and Finance workflow

1. Sign in using a Super Admin, Order & Delivery, Customer Support, or Finance
   account.
2. Open:

   ```text
   http://localhost:3000/admin/orders
   ```

3. Select an order.
4. Update fulfilment, payment, tracking, estimated delivery, delivery fee and
   return/replacement deadline.
5. Save the order update.
6. Use **Customer documents** to issue or reissue the permitted document.

Document rules:

- **Order confirmation** — created automatically and can be reissued.
- **Payment invoice** — available only after payment is recorded as **Paid** or
  **Partially refunded**.
- **Tax invoice** — available only after payment, delivery, and the
  return/replacement deadline have passed. Legal issuer name, PAN/VAT number and
  registered address are required.

Every document issuance is written to the order history.

## What remains postponed

- eSewa, Khalti and card/bank gateway collection
- cash on delivery
- automatic email and SMS delivery of confirmations

The new order and document workflow does not charge customers and does not
enable any payment method.

## Verification completed

- ESLint
- TypeScript
- Next.js production build
- New route compilation
- Update archive integrity
