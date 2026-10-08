# khetE Variant Placement and New Arrivals Update

## Install

1. Stop the khetE development server with `Ctrl+C`.
2. Extract `khete-V8-variant-new-arrivals-update-2026-07-23.zip`.
3. Copy the extracted folders directly into `C:\khete-V8`.
4. Choose **Replace the files in the destination** when Windows asks.
5. Restart the website:

   ```powershell
   cd C:\khete-V8
   npm.cmd run dev
   ```

No Supabase SQL and no `npm install` are required for this update.

## Variant workflow

- Open **Admin > Listings** and select an existing product.
- Click **Add option**.
- The blank **New variant** form opens immediately below the product's main details.
- Previously added variants remain grouped below the new form.
- Click **Save option** after completing the new variant.
- Choose **Add another variant** to open another blank form in the same position, or **Done adding variants** to continue to the gallery.
- Use **Save & publish** to write the complete product and its variants to the catalogue.

## New Arrivals

- A newly published product displays **New Arrival** for 30 days.
- Adding a new active variant also makes the parent product display **New Arrival** for 30 days.
- The newly added variant displays **New** in the product option selector for 30 days.
- The homepage **New Arrivals** section prioritizes the most recently published products and newly added variants.
- The labels expire automatically; no admin checkbox is required.

## Quick test

1. Edit a product that already has at least three variants.
2. Click **Add option** and confirm that the blank form appears above the existing variants.
3. Complete and save the new option, then publish the product.
4. Open the product on the storefront.
5. Confirm that the product card says **New Arrival** and the new option says **New**.
