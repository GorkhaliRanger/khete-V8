# khetE Cart and Wishlist Count Fix

This update makes the Cart and Wishlist badges match the items that customers
can actually see.

## Changes

- The Cart badge counts only valid, displayable cart items.
- The Cart badge is hidden when the valid cart is empty.
- The Wishlist badge counts only valid products and variants.
- The Wishlist page, Account page, and header use the same validated count.
- Stale Cart entries are removed after the live catalogue loads.
- Stale signed-in Wishlist entries are removed from both the browser and the
  customer's Supabase wishlist.
- Checkout receives the same validated cart used by the Cart page.

## Install

1. Stop the khetE development server with `Ctrl+C`.
2. Extract `khete-V8-cart-wishlist-count-fix-2026-07-23.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace the files in the destination**.
4. Restart:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

5. Open the Cart and Wishlist pages. If an old badge remains in an already-open
   tab, use `Ctrl+Shift+R` once.

No Supabase SQL migration and no `npm install` are required.
