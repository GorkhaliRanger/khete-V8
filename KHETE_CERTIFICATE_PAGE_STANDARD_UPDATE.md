# khetE Certificate Page Standard Update

Date: 24 July 2026

## What this update corrects

- The public `/certificates` page now uses the same compact page banner, container width, typography, spacing, buttons, borders, and card treatment as the other khetE marketplace pages.
- Certificate totals are shown in a slim information strip instead of an oversized separate hero panel.
- Certificate detail and certified farm/person pages use the standard khetE surface colours, corner radii, heading scale, and spacing.
- `/admin/certificates` now uses the correct admin shell, so its sidebar and workspace align with the other admin modules.
- `/admin/reviews` receives the same admin-shell correction because it used the same obsolete layout class.
- Responsive layouts were adjusted for laptop, tablet, and mobile widths.

## Installation

1. Extract `khete-V8-certificate-page-standard-update-2026-07-24.zip`.
2. Copy the extracted `app` folder into:

   `C:\khete-V8`

3. Allow Windows to replace the matching files.
4. Restart the website:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No Supabase migration and no `npm install` are required for this visual update.

## Pages to test

- `http://localhost:3000/certificates`
- `http://localhost:3000/admin/certificates`
- `http://localhost:3000/admin/reviews`

Replace `3000` with the port shown in PowerShell if Next.js starts on another port.

## Remaining khetE roadmap

### Launch-critical

1. Live payment gateways, payment callbacks, refunds, and admin enable/disable controls.
2. Automated email and SMS for account, order, payment, invoice, delivery, cancellation, and service-booking events.
3. Delivery rules, charges, fulfilment partners, and automatic tracking updates.
4. Full English/Nepali switching across the whole storefront, account, checkout, and messages.
5. Customer profile, communication preferences, password recovery, and account-security controls.
6. Farmer, seller, and independent-business onboarding with separate catalogue, order, inventory, and earnings dashboards.

### Operations and growth

7. A real administrator overview dashboard with sales, orders, stock alerts, support, services, payouts, and exports. `/admin` currently opens Category Management.
8. Working newsletter subscriptions and marketing-consent records.
9. Direct WhatsApp Business integration; current WhatsApp-labelled buttons open the internal khetE Support flow.
10. Admin-editable homepage, Our Story, projects, testimonials, and future blog content.
11. Customer and professional notification centres with read/unread history.
12. Stronger financial reconciliation, tax reporting, payout exports, and refund records.

### Production readiness

13. Final legal, tax, privacy, returns, and invoice review for the registered Nepal business.
14. SEO metadata, sitemap, robots rules, social previews, and structured product/service data.
15. Production domain, hosting, environment secrets, storage limits, backups, monitoring, and recovery testing.
16. Full end-to-end testing for desktop/mobile, accessibility, performance, permissions, checkout, and database security.

## Recommended next module

Build **Customer Profile, Language & Notification Preferences** next. It is still missing from the Account area, does not require payment credentials, and provides the customer data needed before email/SMS and full bilingual delivery are connected.

## Validation completed

- ESLint passed.
- TypeScript passed.
- Next.js production build passed.
- All certificate, review, account, storefront, and admin routes compiled successfully.
