# khetE Verified Reviews & Ratings Update

This update adds verified, moderated customer reviews for delivered products and completed professional services.

## Installation

1. Stop the khetE development server with `Ctrl+C`.
2. Extract `khete-V8-verified-reviews-update-2026-07-24.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace the files in the destination** when Windows asks.
4. Open this migration:

   ```text
   C:\khete-V8\supabase\migrations\202607240014_verified_reviews.sql
   ```

5. Copy the SQL contents—not the file path—into **Supabase Dashboard → SQL Editor → New query**, then click **Run**.
6. Restart khetE:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No `npm install` is required.

## New pages

Use the exact localhost port shown in PowerShell.

- Customer review centre:

  ```text
  http://localhost:3000/account/reviews
  ```

- Admin moderation:

  ```text
  http://localhost:3000/admin/reviews
  ```

Replace `3000` with `3001` if that is the active port.

## How to test product reviews

1. Sign in as a customer who has an order.
2. In Admin Orders, change that order to **Delivered**.
3. Return to the customer account and open **Reviews & ratings**.
4. Select the delivered product, choose 1–5 stars, enter at least 10 characters, and submit.
5. Sign in as an authorised admin and open `/admin/reviews`.
6. Select the pending review and click **Publish review**.
7. Open the product-detail page. The rating and published review will appear under the product information.

## How to test professional-service reviews

1. Create a professional service request as a customer.
2. Complete it from the linked Professional Account.
3. Open `/account/reviews` as the same customer and submit feedback.
4. Publish it from `/admin/reviews`.
5. Open that Advisor, Expert, or Associate Partner's public profile to see the rating and review.

## Included rules

- Only a delivered order item can receive a product review.
- Only a completed professional-service request can receive a service review.
- One review is allowed for each purchased order item or completed service request.
- New and edited reviews return to **Pending review**.
- Public visitors see only **Published** reviews.
- Customers can edit, resubmit, or withdraw their own reviews.
- Rejected reviews can include a moderation note visible to the customer.
- Withdrawn reviews disappear publicly and no longer affect the rating.
- Customer account identities and purchase records remain private.

## Admin access

The moderation page is available to:

- Super Admin
- Product & Inventory Manager
- Customer Support
- Content & Promotion Manager

## Unchanged

- khetE logo and brand assets
- Payment gateway status
- Cart and Wishlist
- Support tickets
- Professional Finance
- Order tracking and invoices
- Customer addresses
- Legal Policy Centre
