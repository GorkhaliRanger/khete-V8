-- khetE demo data: promotional products with discounted prices for the Deals page.
-- Run once in the Supabase SQL Editor. Safe to re-run: matching slugs are updated,
-- the demo campaign banner row is updated instead of duplicated.
-- Preview: open http://localhost:3000/deals — the hero becomes the clickable
-- "Dashain Harvest Sale" banner and the "Current promotions" grid lists every
-- discounted product below it.

with promos (
  id, category_slug, kind, slug, name_en, name_ne, short_description_en,
  specifications, search_keywords, sku, base_price,
  offer_title, offer_type, offer_value, unit_label, featured
) as (
  values
    (
      '40000000-0000-0000-0000-000000000101'::uuid,
      'seasonal-vegetables', 'product', 'heirloom-tomato-family-box',
      'Heirloom Tomato Family Box — 5 kg', 'हेरलूम टमाटर परिवार प्याक',
      'Graded heirloom tomatoes packed for families and small restaurants during the festive season.',
      '["5 kg packed box", "Graded for freshness", "Harvested to order"]'::jsonb,
      array['tomato','organic','fresh','vegetable','dashain','family pack','box','टमाटर'],
      'KHT-DL-TOM5', 640::numeric, 'Dashain Family Offer', 'percentage', 10::numeric, 'box', true
    ),
    (
      '40000000-0000-0000-0000-000000000102'::uuid,
      'leafy-greens', 'product', 'organic-spinach-weekly-bundle',
      'Organic Spinach Weekly Bundle — 3 kg', 'अर्गानिक पालुङ्गो साप्ताहिक प्याक',
      'A weekly supply of washed, bundled organic spinach from partner growers.',
      '["3 kg weekly supply", "Washed and bundled", "Partner grower supply"]'::jsonb,
      array['spinach','organic','greens','weekly','bundle','fresh','पालुङ्गो'],
      'KHT-DL-SPN3', 240::numeric, 'Fresh Week Special', 'percentage', 20::numeric, 'bundle', false
    ),
    (
      '40000000-0000-0000-0000-000000000103'::uuid,
      'grain-seeds', 'product', 'hybrid-maize-seed-10kg',
      'Hybrid Maize Seed — 10 kg Sack', 'हाइब्रिड मकैको बीउ १० केजी',
      'Batch-labelled hybrid maize seed for the winter sowing window, with planting guidance included.',
      '["10 kg sealed sack", "Batch labelled", "Planting guidance included"]'::jsonb,
      array['maize','hybrid','seed','sowing','winter','मकै','बीउ'],
      'KHT-DL-MZ10', 3400::numeric, 'Sowing Season Deal', 'percentage', 12::numeric, 'sack', true
    ),
    (
      '40000000-0000-0000-0000-000000000104'::uuid,
      'grain-seeds', 'product', 'vegetable-seed-starter-kit',
      'Vegetable Seed Starter Kit — 8 Varieties', 'तरकारी बीउ स्टार्टर किट',
      'Eight seasonal vegetable varieties in one starter kit for new growers and kitchen gardens.',
      '["8 vegetable varieties", "Sowing calendar included", "Starter quantities"]'::jsonb,
      array['vegetable','seed','starter','kit','garden','beginner','बीउ','किट'],
      'KHT-DL-VSK8', 1250::numeric, 'New Farmer Bundle', 'amount', 200::numeric, 'kit', false
    ),
    (
      '40000000-0000-0000-0000-000000000105'::uuid,
      'power-trailers', 'product', 'power-tiller-festive-offer',
      '8 HP Power Tiller — Festive Offer', '८ एचपी पावर टिलर चाडपर्व अफर',
      'A versatile power tiller for soil preparation, offered with a festive season discount.',
      '["8 HP engine", "Adjustable tilling width", "Warranty support"]'::jsonb,
      array['power tiller','tiller','machine','dashain','offer','पावर टिलर'],
      'KHT-DL-PT08', 138000::numeric, 'Dashain Machine Offer', 'amount', 15000::numeric, 'unit', true
    ),
    (
      '40000000-0000-0000-0000-000000000106'::uuid,
      'heavy-duty-tractors', 'product', 'compact-tractor-season-deal',
      '20 HP Compact Tractor — Season Deal', '२० एचपी कम्प्याक्ट ट्र्याक्टर सिजन डिल',
      'A fuel-efficient compact tractor for tilling and transport, discounted for the harvest season.',
      '["20 HP diesel engine", "Two-wheel drive", "Three-point linkage"]'::jsonb,
      array['tractor','compact','20 hp','harvest','deal','ट्र्याक्टर'],
      'KHT-DL-TR20', 785000::numeric, 'Harvest Season Deal', 'percentage', 8::numeric, 'unit', false
    )
)
insert into public.listings (
  id, category_id, kind, status, slug, name_en, name_ne,
  short_description_en, specifications, search_keywords, sku,
  base_price, offer_title, offer_type, offer_value, unit_label,
  available, stock_managed, featured, districts, published_at
)
select
  promos.id, categories.id, promos.kind::public.listing_kind, 'active'::public.listing_status,
  promos.slug, promos.name_en, promos.name_ne, promos.short_description_en,
  promos.specifications, promos.search_keywords, promos.sku,
  promos.base_price, promos.offer_title, promos.offer_type,
  promos.offer_value, promos.unit_label,
  true, true, promos.featured, array[]::text[], now()
from promos
join public.categories on categories.slug = promos.category_slug
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
  offer_title = excluded.offer_title,
  offer_type = excluded.offer_type,
  offer_value = excluded.offer_value,
  unit_label = excluded.unit_label,
  available = excluded.available,
  stock_managed = excluded.stock_managed,
  featured = excluded.featured,
  published_at = coalesce(public.listings.published_at, excluded.published_at);

with stock (slug, quantity, reserved_quantity, low_stock_threshold) as (
  values
    ('heirloom-tomato-family-box', 80::numeric, 4::numeric, 15::numeric),
    ('organic-spinach-weekly-bundle', 60::numeric, 3::numeric, 12::numeric),
    ('hybrid-maize-seed-10kg', 35::numeric, 2::numeric, 8::numeric),
    ('vegetable-seed-starter-kit', 50::numeric, 2::numeric, 10::numeric),
    ('power-tiller-festive-offer', 4::numeric, 0::numeric, 1::numeric),
    ('compact-tractor-season-deal', 2::numeric, 0::numeric, 1::numeric)
)
insert into public.inventory (listing_id, quantity, reserved_quantity, low_stock_threshold, allow_backorder)
select listings.id, stock.quantity, stock.reserved_quantity, stock.low_stock_threshold, false
from stock
join public.listings on listings.slug = stock.slug
on conflict (listing_id) do update set
  quantity = excluded.quantity,
  reserved_quantity = excluded.reserved_quantity,
  low_stock_threshold = excluded.low_stock_threshold;

-- Demo campaign: this becomes the clickable hero banner on the /deals page.
insert into public.promotions (
  id, title_en, title_ne, eyebrow_en, eyebrow_ne,
  description_en, description_ne, button_label_en, button_label_ne,
  target_type, target_listing_id, target_category_id,
  banner_storage_path, theme, show_on_homepage, show_on_deals_page,
  is_active, sort_order, starts_at, ends_at
)
values (
  '50000000-0000-0000-0000-000000000001',
  'Dashain Harvest Sale', null,
  'Limited-time value', null,
  'Discounted produce, seed bundles and machinery offers for the festive season.', null,
  'Shop the sale', null,
  'listing', '40000000-0000-0000-0000-000000000101'::uuid, null,
  null, 'gold', false, true,
  true, 1, now() - interval '1 day', now() + interval '45 days'
)
on conflict (id) do update set
  title_en = excluded.title_en,
  eyebrow_en = excluded.eyebrow_en,
  description_en = excluded.description_en,
  button_label_en = excluded.button_label_en,
  target_type = excluded.target_type,
  target_listing_id = excluded.target_listing_id,
  target_category_id = excluded.target_category_id,
  theme = excluded.theme,
  show_on_homepage = excluded.show_on_homepage,
  show_on_deals_page = excluded.show_on_deals_page,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at;

-- Confirmation: six discounted listings plus one live campaign.
select
  listings.slug,
  listings.base_price,
  listings.offer_title,
  listings.offer_type,
  listings.offer_value
from public.listings
where listings.slug in (
  'heirloom-tomato-family-box',
  'organic-spinach-weekly-bundle',
  'hybrid-maize-seed-10kg',
  'vegetable-seed-starter-kit',
  'power-tiller-festive-offer',
  'compact-tractor-season-deal'
)
order by listings.slug;
