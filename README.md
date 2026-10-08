# khetE Marketplace

## Live listings and inventory

After the initial migration and `supabase/seed.sql`, run `supabase/seed-listings.sql` and `supabase/storage-media.sql` once in the Supabase SQL Editor. Sign in with a `super_admin` or `product_inventory_manager` account and open `/admin/listings` to create, publish and manage catalogue records, stock and product galleries.

First functional frontend build of the khetE agricultural marketplace.

## Included

- Animated intro shown once per browsing session
- Responsive branded header using the supplied khetE logo
- Uniform Home, Products, Services, khetE Deals and Our Story navigation
- Responsive laptop, widescreen and mobile layouts
- Product and service category rails with direct filters
- Experts & Partners directory and detailed profile pages
- Full-width search below the menu
- Live, in-place word matching across names, descriptions, categories, specifications, tags, English and Nepali text
- Left-side filters for search and catalogue results
- Supabase email/password login and registration popup that preserves the current page
- Google OAuth callback foundation and persistent authentication sessions
- Customer account page with orders, invoices, wishlist, returns and delivery-profile access
- Private customer address book with default delivery profiles and checkout autofill
- Live Supabase category tree in the homepage, header, Products, Services and search filters
- Protected Supabase category administration with parent, child and grandchild create/edit/archive operations
- Searchable category selectors in both category and listing administration
- Custom category icon upload with an enforced 512 × 512 px standard
- Product galleries with up to eight standardized images per listing
- Wishlist and cart state stored in the browser
- Parent, child and grandchild category structure
- Product, produce, service, rental and livestock listing types
- Product detail pages
- Cart and order-summary frontend
- Secure Supabase order creation with server-verified prices and inventory reservation
- Customer order history with payment, fulfilment, tracking and delivery status
- Protected order-management workspace for Super Admin, Order & Delivery, Support and Finance roles
- Central Contact & Support page with topic cards, guest enquiries, signed-in ticket history, private supporting files and conversation replies
- Protected Support & Enquiries workspace with topic filters, assignment, priority, internal notes, supporting files and customer replies
- Full footer with Contact Us, support, company and legal links
- Admin category manager at `/admin/categories`

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase Project URL and publishable key to `.env.local`.
3. In Supabase, open **SQL Editor**, run
   `supabase/migrations/202607160001_initial_marketplace.sql`,
   `supabase/migrations/202607180001_listing_variants.sql`,
   `supabase/seed.sql`, `supabase/seed-listings.sql`,
   `supabase/storage-media.sql`, and finally
   `supabase/migrations/202607220001_orders.sql` and
   `supabase/migrations/202607230001_promotions.sql` and
   `supabase/migrations/202607230005_customer_support.sql`, followed by
   `supabase/migrations/202607230006_everest_support_integration.sql` and
   `supabase/migrations/202607230012_customer_addresses.sql`.
4. In **Authentication → URL Configuration**, set the Site URL to
   `http://localhost:3000` while developing. Add `http://localhost:3000/**`
   to the allowed redirect URLs.
5. Email/password authentication works immediately. To enable Google login,
   configure the Google provider in **Authentication → Providers → Google**
   and use the callback URL shown by Supabase in your Google OAuth app.

## Appoint the first administrator

The admin route is intentionally hidden and rejects ordinary customer accounts.
After registering and confirming the account that will be the first Super Admin:

1. Open `supabase/appoint-first-admin.example.sql`.
2. Replace both occurrences of the placeholder email with that account's email.
3. Run the script once in the Supabase SQL Editor.
4. Sign out and back in, then open `http://localhost:3000/admin/categories`.

Do not promote public customer accounts. Additional team roles should later be
assigned by the Super Admin rather than by exposing an admin-registration form.

Never place a Supabase secret key, service-role key or database password in a
`NEXT_PUBLIC_` environment variable.

## Verify

```bash
npm run lint
npm run build
```

## Mandatory image standards

The admin uploader accepts a single master format and reuses that same file in
cards, search results and the product gallery. Separate desktop, mobile or
thumbnail versions are not required.

- Listing photos: exactly **1254 × 1254 px**, JPG/PNG/WebP, maximum **5 MB**,
  up to **8 photos** per listing.
- Keep the complete product centred with about **10% clear space** around it on
  a white or light neutral background.
- Category icons: exactly **512 × 512 px**, PNG/WebP, maximum **1 MB**.
- Files outside these dimensions or limits are rejected before upload so the
  catalogue stays uniform and products are not cropped out of their frames.

## Current stage

The secure Supabase schema, seeded live category tree, customer authentication,
persistent sessions, protected category and listing managers, bulk product
import, inventory, listing-image galleries, secure order requests, customer
order history and admin fulfilment management are included.

## Main routes

- `/` — homepage
- `/products` — category and catalogue page
- `/products/20-hp-compact-tractor` — example product detail
- `/deals` — promotions
- `/our-story` — story and projects
- `/cart` — shopping cart
- `/account` — signed-in customer account
- `/account/addresses` — private delivery profiles and default address
- `/support` — central help for products, orders, delivery, payments, custom requests, applications, returns and replacements
- `/admin/categories` — category creation and editing workspace
- `/admin/listings` — listing, inventory and product-gallery workspace
- `/admin/import` — Excel and image ZIP bulk importer
- `/admin/orders` — order, payment-status and delivery-management workspace
- `/admin/promotions` — scheduled homepage and KhetE Deals campaigns
- `/admin/support` — customer support and enquiry management

The current checkout saves an order request but does not collect payment. New
orders start as `pending_payment` until an approved eSewa, Khalti or bank/card
gateway is connected. Cash on delivery remains disabled.

## Promotions setup

Run `supabase/migrations/202607230001_promotions.sql` once after the orders
migration. Super Admin and Content & Promotion Manager accounts can then create,
schedule, hide and link campaigns from `/admin/promotions`.

## Hosting

`next.config.ts` enables Next.js standalone output for deployment to a Node.js or Docker-based Nepal VPS. The normal development command remains `npm run dev`.
