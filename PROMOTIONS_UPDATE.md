# khetE promotions update

This update adds a scheduled promotions system while payment-gateway testing
remains deferred.

## Included

- `/admin/promotions` with the same left-sidebar layout as Categories,
  Listings, Bulk Import and Orders.
- Access for Super Admin and Content & Promotion Manager accounts.
- Create, edit, schedule, enable, hide and reorder campaigns.
- Link a campaign to:
  - a product or service listing;
  - a parent, child or grandchild category; or
  - the KhetE Deals page.
- Choose whether each campaign appears on the homepage, KhetE Deals, or both.
- Optional 1254 × 1254 px campaign image with JPG, PNG and WebP support.
- Automatic Live, Scheduled, Ended and Hidden states.
- Homepage and KhetE Deals display only currently active promotions.
- Existing fallback promotion cards remain visible until the first campaign is
  created.
- Listing and bulk-import image validation now uses 1254 × 1254 px.
- The downloadable Excel template and sample ZIP use the same 1254 × 1254 rule.

## Install

1. Stop the local khetE server.
2. Extract the update ZIP directly into `C:\khete-V8` and replace matching
   files.
3. Open Supabase SQL Editor.
4. Run the complete contents of:

   `C:\khete-V8\supabase\migrations\202607230001_promotions.sql`

   If the Promotions page already detects **Super Admin** but says the
   workspace could not be loaded, run this idempotent repair instead:

   `C:\khete-V8\supabase\migrations\202607230002_promotions_access_repair.sql`

5. Restart the website:

   `npm.cmd run dev`

6. Open:

   `http://localhost:3000/admin/promotions`

## First campaign

1. Choose **New promotion**.
2. Add the title, short description and button label.
3. Choose a destination: Deals, listing or category.
4. Set the start and optional end date.
5. Choose Homepage, KhetE Deals, or both.
6. Optionally upload one exact 1254 × 1254 px image.
7. Save the promotion.

The payment gateway remains unchanged. Orders still begin as awaiting payment.
