# khetE bulk product import

The bulk importer lets an authorized catalogue administrator create many products, variants, inventory records, and product images from one ZIP package.

## Download files

- `public/templates/khete-bulk-products-template.xlsx` — blank workbook for real imports.
- `public/templates/khete-bulk-products-sample-package.zip` — working example containing a completed workbook and correctly named image.

## Required ZIP structure

```text
your-import.zip
├── khete-bulk-products.xlsx
└── images
    ├── PRODUCT-001
    │   ├── PRODUCT-001-01.jpg
    │   └── PRODUCT-001-02.jpg
    └── PRODUCT-002
        └── PRODUCT-002-01.webp
```

`product_ref` is the permanent reference used to connect rows across the workbook and to locate each product's image folder. Use 3–40 uppercase letters, numbers, hyphens, or underscores. Do not reuse a reference for a different product.

## Workbook sheets

### Products

One row creates one marketplace listing. Required fields are visually marked in the template. Use an existing value from the `Category Reference` sheet for `category_slug`.

`base_price_npr` is the regular price. To add an offer, complete all three fields:

- `offer_caption` — the customer-facing name, such as `Monsoon Farm Offer`.
- `offer_type` — `amount` or `percentage`.
- `offer_value` — the NPR amount or percentage to subtract.

Leave all three offer fields blank when the product has no offer.

Lists such as specifications, keywords, and districts use a vertical bar (`|`) between values, for example:

```text
Live delivery|Oxygen-packed bag|Advance booking
```

### Variants

Optional. Add one row per independently purchasable option. Variants have their own name, SKU, regular price, optional named offer, stock quantity, unit, active state, and sort order. For example, a Carp Hatchlings listing can contain Rohu, Naini, Common Carp, Grass Carp, Bhakur, Silver Carp, Bighead, and Bata as eight separate cart items.

If a product has variants, the importer uses the lowest active variant price as the listing's starting price. If it has no variants, stock is read from the Products sheet.

### Images

Add one row for every image file in the ZIP. A product must have 1–8 images. Mark no more than one as primary; if none is marked, the first image becomes primary automatically.

## Mandatory image standard

- Exact canvas: **1254 × 1254 pixels** (square).
- Format: **JPG, JPEG, PNG, or WebP**.
- Maximum file size: **5 MB per image**.
- File names: `PRODUCT_REF-01.ext` through `PRODUCT_REF-08.ext`.
- Folder: `images/PRODUCT_REF/`.
- Keep the whole subject inside the square with comfortable space around its edges. The storefront uses the single uploaded image and does not require a separate thumbnail file.

Example:

```text
images/CARP-HATCH/CARP-HATCH-01.png
```

## Import workflow

1. Open `/admin/import` while signed in as Super Admin or Product & Inventory Manager.
2. Download and complete the blank Excel template.
3. Place the workbook and image folders in one ZIP using the structure above.
4. Choose the ZIP on the Bulk product import page.
5. Review the validation preview. Nothing is written while errors remain.
6. Select **Import products** after every row and image passes validation.

Before saving, the importer checks sheet names, required values, categories, duplicate references, slugs, SKUs, variant values, image paths, formats, dimensions, and file sizes. It also checks the live catalogue for conflicting slugs and SKUs. If an upload fails partway through, newly uploaded files and incomplete listings from that attempt are removed.

## Notes

- Upload the complete ZIP, not the Excel workbook alone. A browser cannot safely read a separate local image folder based only on names written in Excel.
- Keep the ZIP as the import record.
- Start with `draft` status when preparing a large catalogue. Change products to `active` after checking them in the admin listings page.
