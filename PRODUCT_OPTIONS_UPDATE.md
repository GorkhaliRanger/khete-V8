# Product options update

This update lets one marketplace listing contain several independently purchasable options.

Example: create one **Carp Hatchlings** listing, then add Rohu, Naini, Common Carp, Grass Carp, Bhakur, Silver Carp, Bighead and Bata as product options. Each option has its own price, unit, stock, SKU and availability. Customers can select quantities for several options at once; every option becomes a separate cart line.

## One-time Supabase setup

Open the Supabase SQL Editor and run:

`supabase/listing-variants.sql`

`Success. No rows returned` is the expected result because the script creates database structures rather than returning data.

## Admin workflow

1. Open `/admin/listings` and choose **New listing**.
2. Select the **Parent category**, then the searchable **Specific category**.
3. Complete the listing name and basic details.
4. Under **Purchasable product options**, choose **Add option** for every variety.
5. Give each option its own price, stock quantity, unit and optional SKU.
6. Upload up to eight standard 1254 × 1254 px product photos.
7. Save the listing as a draft or publish it.

Listings without product options continue to use their normal single price and inventory.
