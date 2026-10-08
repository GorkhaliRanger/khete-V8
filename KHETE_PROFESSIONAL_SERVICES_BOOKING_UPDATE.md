# khetE Professional Services & Booking Requests

This update connects approved professional offerings to customers and to the
separate Professional Account Dashboard.

## Before installing

The following earlier migrations must already have completed successfully:

1. `202607230007_professional_network.sql`
2. `202607230009_professional_accounts.sql`

If the Professional Account Dashboard is already working, these prerequisites
are in place.

## Install on Windows

1. Stop the development server with `Ctrl+C`.
2. Extract `khete-V8-professional-services-booking-update-2026-07-23.zip`
   directly into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace the files in the destination**.
4. Open this file in Notepad or VS Code:

   ```text
   C:\khete-V8\supabase\migrations\202607230010_professional_service_requests.sql
   ```

5. Copy the complete SQL contents. Do not copy the Windows file path into
   Supabase.
6. Paste the SQL into the Supabase **SQL Editor** and click **Run**.
7. Wait for **Success. No rows returned**.
8. Restart the site:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No `npm install` is required.

## Test the complete flow

### 1. Prepare an approved service

1. Log in as Super Admin or Finance.
2. Open:

   ```text
   http://localhost:3000/admin/professional-finance
   ```

3. Select an active Advisor, Expert Professional or Associate Partner.
4. Open **Products & services**.
5. Add an active service with a name, description, price and unit.

`Partner product` entries remain outside the booking flow. Use `Advisory
service`, `Expert service` or `Partner service` for customer requests.

### 2. Submit a customer request

1. Sign in with a customer account.
2. Open:

   ```text
   http://localhost:3000/services
   ```

3. Find the **Verified professional services** section.
4. Choose **Request service**.
5. Enter the schedule, location, phone number and service details.
6. Submit the request.
7. Track it at:

   ```text
   http://localhost:3000/account/service-requests
   ```

### 3. Manage it as the professional

1. Sign in with the account linked to that professional profile.
2. Open:

   ```text
   http://localhost:3000/professional
   ```

3. Open **Service requests**.
4. Accept, request a schedule change, decline, start or complete the service.

When the professional marks the request **Completed**, khetE automatically
creates a **Pending** earning record. Finance can then review commission,
deductions and payout status in `/admin/professional-finance`.

## Included behavior

- Verified professional service catalogue on `/services`
- Filters by professional type, provider and search text
- Server-verified service price and total
- Required customer login for private request tracking
- Customer schedule, location, quantity and service notes
- Customer request history and cancellation
- Professional accept, reschedule, decline, start, cancel and complete actions
- Customer/professional access limited to their own records
- Automatic pending earning record after completion
- Responsive desktop, laptop and mobile layouts

Online payment collection remains disconnected. The booking total is an
estimate until the payment-gateway milestone is activated.
