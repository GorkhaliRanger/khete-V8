# khetE named offers and variant flow update

## Install

1. Stop the running development server with `Ctrl+C`.
2. Extract `khete-V8-offers-variant-flow-update-2026-07-23.zip` directly into:

   ```text
   C:\khete-V8
   ```

3. Choose **Replace the files in the destination**.
4. Open this file in Notepad or VS Code:

   ```text
   C:\khete-V8\supabase\migrations\202607230003_listing_offers.sql
   ```

5. Copy the SQL code inside the file. Paste the code—not the Windows file path—into the Supabase SQL Editor and select **Run**.
6. `Success. No rows returned` is the expected result.
7. Restart the site:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

## Named offers

The listing form now stores a regular price plus an optional customer-facing offer:

- **Offer caption:** for example, `Monsoon Farm Offer`.
- **Amount (NPR):** subtracts a fixed amount from the regular price.
- **Percentage (%):** subtracts the chosen percentage from the regular price.

The calculated customer price is shown before saving. Product cards and product details show the offer caption, regular price, and calculated offer price. Variants can have different offer captions and reductions.

The database rechecks the calculated offer price when an order request is submitted. Existing compare-at prices are converted automatically into named `Special offer` amount reductions without changing the customer price.

## Variant entry

Every option card now has **Save option**:

- Invalid or missing information opens an error dialog.
- **Go to problem section** scrolls to the exact option.
- A valid option opens a confirmation dialog.
- **Add another variant** creates and opens the next option immediately.
- **Done adding variants** continues to the product gallery.

The existing **Save & publish** validation and **Add another product** confirmation remain unchanged.

## Bulk import

The Excel template now supports:

```text
offer_caption
offer_type
offer_value
```

Use `amount` or `percentage` for `offer_type`. Leave all three offer cells blank when there is no offer. For products with variants, enter offer fields on each Variants row.

Images remain exactly **1254 × 1254 px**, maximum 5 MB each.

## Test checklist

1. Open `/admin/listings` and create a product with a regular price.
2. Add `Monsoon Farm Offer`, choose `percentage`, and enter `10`.
3. Confirm that the preview shows 10% below the regular price.
4. Add a variant and select **Save option**.
5. Test **Add another variant** and **Done adding variants**.
6. Publish the product and confirm its offer caption and price on the product card and detail page.
