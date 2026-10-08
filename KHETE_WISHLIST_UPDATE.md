# khetE V8 — Customer Wishlist Update

## Install the update

1. Stop the khetE development server with `Ctrl+C`.
2. Extract `khete-V8-customer-wishlist-update-2026-07-23.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace the files in the destination** when Windows asks.
4. Open this file in Notepad or VS Code:

   ```text
   C:\khete-V8\supabase\migrations\202607230004_customer_wishlist.sql
   ```

5. Copy the complete SQL contents. Paste the SQL code—not the Windows file path—into the Supabase SQL Editor and click **Run**.
6. Restart khetE:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

7. Open:

   ```text
   http://localhost:3000/wishlist
   ```

## What changed

- The heart in the header now opens the Wishlist page.
- Customers can save a complete listing from product cards or product details.
- Customers can save an individual product variant.
- Saved variants show their current price, offer caption, availability and stock.
- A saved variant can be added directly to the cart.
- Guests retain saved items in the same browser.
- When a guest logs in, eligible saved catalogue items merge into that account.
- Signed-in wishlists are protected by Supabase row-level security and synchronize across devices.
- The Customer Account page shows the live saved-item count and links to Wishlist.

## Quick test

1. While logged out, save one product and one variant.
2. Open the heart icon in the header and confirm both appear.
3. Log in and return to Wishlist; the guest selections should remain.
4. Remove one saved item and refresh the page.
5. Log out and log in again; the removed item should stay removed.
6. Add a saved variant to the cart and confirm the correct variant and current offer price appear.

The Wishlist migration can be run again safely. It does not change order or payment behavior.
