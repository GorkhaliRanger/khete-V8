-- khetE starter listings and inventory.
-- Run once in Supabase SQL Editor after the initial migration and category seed.
-- Safe to run again: matching listing slugs are updated instead of duplicated.

with starter (
  id, category_slug, kind, slug, name_en, name_ne, short_description_en,
  specifications, search_keywords, sku, base_price, compare_at_price,
  price_label, unit_label, available, stock_managed, featured, districts
) as (
  values
    (
      '40000000-0000-0000-0000-000000000001'::uuid,
      'heavy-duty-tractors', 'product', '20-hp-compact-tractor',
      '20 HP Compact Tractor', '२० एचपी कम्प्याक्ट ट्र्याक्टर',
      'A compact, fuel-efficient tractor designed for tilling, transport and everyday farm work.',
      '["20 HP diesel engine", "Two-wheel drive", "Three-point linkage", "Warranty support"]'::jsonb,
      array['tractor','20 hp','machinery','equipment','diesel','farm','ट्र्याक्टर'],
      'KHT-TR-20', 785000::numeric, 825000::numeric, null, 'unit', true, true, true,
      array['Kathmandu','Bhaktapur','Lalitpur','Chitwan']
    ),
    (
      '40000000-0000-0000-0000-000000000002'::uuid,
      'power-tillers', 'product', '8-hp-power-tiller',
      '8 HP Power Tiller', '८ एचपी पावर टिलर',
      'A versatile power tiller for soil preparation in smaller plots and vegetable farms.',
      '["8 HP engine", "Adjustable tilling width", "Compact turning radius"]'::jsonb,
      array['power tiller','tiller','soil','machine','equipment','खेती'],
      'KHT-PT-08', 138000::numeric, null, null, 'unit', true, true, true,
      array['Kathmandu','Bhaktapur','Lalitpur','Kavre']
    ),
    (
      '40000000-0000-0000-0000-000000000003'::uuid,
      'seasonal-vegetables', 'produce', 'farm-fresh-organic-tomatoes',
      'Farm-Fresh Organic Tomatoes', 'ताजा अर्गानिक टमाटर',
      'Freshly harvested local tomatoes sorted and packed for household or business orders.',
      '["Harvested locally", "Graded for freshness", "Bulk ordering available"]'::jsonb,
      array['organic','tomato','fresh','vegetable','kg','local','टमाटर','तरकारी'],
      'KHT-PR-TOM', 110::numeric, 135::numeric, null, 'kg', true, true, true,
      array['Kathmandu','Bhaktapur','Lalitpur']
    ),
    (
      '40000000-0000-0000-0000-000000000004'::uuid,
      'leafy-greens', 'produce', 'fresh-spinach-bundle',
      'Fresh Spinach Bundle', 'ताजा पालुङ्गोको मुठा',
      'Clean, tender spinach bundles supplied from local growers.',
      '["Same-day harvest", "Washed and bundled", "Local grower supply"]'::jsonb,
      array['spinach','greens','leafy','vegetable','fresh','पालुङ्गो','साग'],
      'KHT-PR-SPN', 65::numeric, null, null, 'bundle', true, true, true,
      array['Kathmandu','Bhaktapur','Lalitpur']
    ),
    (
      '40000000-0000-0000-0000-000000000005'::uuid,
      'grain-seeds', 'product', 'improved-maize-seed-pack',
      'Improved Maize Seed Pack', 'उन्नत मकैको बीउ',
      'A labelled maize seed pack suitable for seasonal field planting.',
      '["5 kg sealed pack", "Batch labelled", "Planting guidance included"]'::jsonb,
      array['maize','corn','seed','grain','crop','मकै','बीउ'],
      'KHT-SD-MZ5', 1850::numeric, null, null, '5 kg pack', true, true, false,
      array['Kathmandu','Bhaktapur','Lalitpur','Kavre','Chitwan']
    ),
    (
      '40000000-0000-0000-0000-000000000006'::uuid,
      'installation', 'service', 'drip-irrigation-installation',
      'Drip Irrigation Installation', 'ड्रिप सिँचाइ जडान सेवा',
      'Site review, system planning and installation for small and medium farms.',
      '["Site assessment", "Material estimate", "Installation and testing"]'::jsonb,
      array['drip','irrigation','installation','water','service','pipe','सिँचाइ','जडान'],
      'KHT-SV-DRIP', null, null, 'From Rs. 8,500', null, true, false, true,
      array['Kathmandu','Bhaktapur','Lalitpur','Kavre']
    ),
    (
      '40000000-0000-0000-0000-000000000007'::uuid,
      'tractor-rental', 'rental', 'tractor-rental-half-day',
      'Tractor Rental — Half Day', 'आधा दिन ट्र्याक्टर भाडा',
      'Reserve a tractor with an operator for ploughing and field preparation.',
      '["Operator included", "Four-hour booking", "Area confirmation required"]'::jsonb,
      array['tractor','rental','hire','ploughing','service','भाडा','ट्र्याक्टर'],
      'KHT-RT-TR4', null, null, 'From Rs. 5,500', null, true, false, false,
      array['Bhaktapur','Lalitpur','Kavre','Chitwan']
    ),
    (
      '40000000-0000-0000-0000-000000000008'::uuid,
      'dairy-cattle', 'livestock', 'verified-dairy-cattle-reservation',
      'Verified Dairy Cattle Reservation', 'प्रमाणित दुहुना गाई आरक्षण',
      'A reservation listing with health documentation and transport coordination before purchase.',
      '["Verification required", "Health record review", "Transport arranged separately"]'::jsonb,
      array['dairy','cattle','cow','livestock','reservation','गाई','पशुपालन'],
      'KHT-LV-DC', null, null, 'Reserve & enquire', null, true, false, true,
      array['Kathmandu','Bhaktapur','Lalitpur','Kavre','Chitwan']
    )
)
insert into public.listings (
  id, category_id, kind, status, slug, name_en, name_ne,
  short_description_en, specifications, search_keywords, sku,
  base_price, compare_at_price, price_label, unit_label, available,
  stock_managed, featured, districts, published_at
)
select
  starter.id, categories.id, starter.kind::public.listing_kind, 'active'::public.listing_status,
  starter.slug, starter.name_en, starter.name_ne, starter.short_description_en,
  starter.specifications, starter.search_keywords, starter.sku, starter.base_price,
  starter.compare_at_price, starter.price_label, starter.unit_label, starter.available,
  starter.stock_managed, starter.featured, starter.districts, now()
from starter
join public.categories on categories.slug = starter.category_slug
on conflict (slug) do update set
  category_id = excluded.category_id,
  kind = excluded.kind,
  status = excluded.status,
  name_en = excluded.name_en,
  name_ne = excluded.name_ne,
  short_description_en = excluded.short_description_en,
  specifications = excluded.specifications,
  search_keywords = excluded.search_keywords,
  sku = excluded.sku,
  base_price = excluded.base_price,
  compare_at_price = excluded.compare_at_price,
  price_label = excluded.price_label,
  unit_label = excluded.unit_label,
  available = excluded.available,
  stock_managed = excluded.stock_managed,
  featured = excluded.featured,
  districts = excluded.districts,
  published_at = coalesce(public.listings.published_at, excluded.published_at);

with stock (slug, quantity, reserved_quantity, low_stock_threshold, allow_backorder) as (
  values
    ('20-hp-compact-tractor', 3::numeric, 0::numeric, 1::numeric, false),
    ('8-hp-power-tiller', 8::numeric, 1::numeric, 2::numeric, false),
    ('farm-fresh-organic-tomatoes', 250::numeric, 20::numeric, 40::numeric, false),
    ('fresh-spinach-bundle', 90::numeric, 5::numeric, 20::numeric, false),
    ('improved-maize-seed-pack', 45::numeric, 3::numeric, 10::numeric, false)
)
insert into public.inventory (listing_id, quantity, reserved_quantity, low_stock_threshold, allow_backorder)
select listings.id, stock.quantity, stock.reserved_quantity, stock.low_stock_threshold, stock.allow_backorder
from stock
join public.listings on listings.slug = stock.slug
on conflict (listing_id) do update set
  quantity = excluded.quantity,
  reserved_quantity = excluded.reserved_quantity,
  low_stock_threshold = excluded.low_stock_threshold,
  allow_backorder = excluded.allow_backorder;

-- Confirmation: this should return eight rows.
select slug, kind, status, available, featured
from public.listings
where slug in (
  '20-hp-compact-tractor',
  '8-hp-power-tiller',
  'farm-fresh-organic-tomatoes',
  'fresh-spinach-bundle',
  'improved-maize-seed-pack',
  'drip-irrigation-installation',
  'tractor-rental-half-day',
  'verified-dairy-cattle-reservation'
)
order by kind, name_en;
