# khetE Professional Accounts & Finance update

This update adds a separate authenticated dashboard for Advisors, Expert
Professionals and Associate Partners, plus a protected Finance workspace for
their services, partner sales, earnings and payouts.

## Install

1. Stop the current khetE development server with `Ctrl+C`.
2. Extract `khete-V8-professional-accounts-update-2026-07-23.zip` directly into:

   ```text
   C:\khete-V8
   ```

   Replace the matching files when Windows asks.
3. Open this file in Notepad or VS Code:

   ```text
   C:\khete-V8\supabase\migrations\202607230009_professional_accounts.sql
   ```

4. Copy the **SQL contents inside the file**, paste them into the Supabase SQL
   Editor and click **Run**. Do not paste the Windows file path into Supabase.
5. Restart:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No `npm install` is required.

## New pages

- Professional dashboard:

  ```text
  http://localhost:3000/professional
  ```

- Admin Professional Finance:

  ```text
  http://localhost:3000/admin/professional-finance
  ```

The admin page is available to the Super Admin, Finance Manager and Order &
Delivery Manager roles.

## First test

1. Register or sign in with the email address that the professional will use.
2. Sign in as Super Admin and open **Admin → Professional Finance**.
3. Select the Advisor, Expert or Associate Partner.
4. Open **Account access**, enter the professional's registered email and click
   **Link account**.
5. Add an approved offering:
   - Advisors: advisory services
   - Experts: expert services
   - Associate Partners: partner products and/or partner services
6. Record one service or sale under **Earnings**.
7. Enter quantity, unit price, discount, khetE commission, payment fee, shipping
   deduction and any other deduction. The net professional earning is calculated
   automatically.
8. To test a received payment, choose **Paid** and enter the payout reference.
9. Sign in as the professional and open `/professional`.

## Professional dashboard information

- Amount received
- Pending earnings
- Number of completed services, partner sales or partner services
- Gross value
- khetE commission
- Discounts, payment fees, shipping and other deductions
- Net earnings
- Activity status and payout status
- Payment reference and payment date
- Active products and services

If one login is connected to more than one professional profile, the dashboard
includes a profile selector.

## Payment-gateway status

The gateway is still intentionally postponed. Finance staff can record and
verify transactions manually now. The database is structured so future order,
service-booking and payment-gateway workflows can write into the same earnings
ledger without replacing this dashboard.

