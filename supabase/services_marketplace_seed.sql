-- khetE Services & Rentals showcase seed.
-- Adds: 3 agricultural advisors + 5 expert professionals (with photos),
-- their bookable offerings, and the services/rentals listings
-- (2 machinery rentals, machinery maintenance, paddy/wheat/mustard season packages).
--
-- NON-DESTRUCTIVE: every insert uses ON CONFLICT DO NOTHING, so anything
-- you already edited or created stays untouched. Safe to run more than once.
-- Run in the Supabase SQL Editor.

-- Allow site-local image paths (e.g. /experts/advisor-1.png) for profile photos.
-- The photos ship inside the website's /public folder, so they do not need https URLs.
alter table public.professional_profiles
  drop constraint if exists professional_profile_image_http;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Professional profiles: 3 advisors + 5 experts
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.professional_profiles (
  id, slug, role, name, position_title, organization_name, location, experience,
  expertise, summary, biography, achievements, qualifications,
  profile_image_url, tone, status, featured, sort_order, published_at
)
values
  (
    '50000000-0000-0000-0000-000000000001', 'sita-sharma', 'advisor',
    'Sita Sharma', 'Agricultural Advisor — Paddy & Crop Planning', null,
    'Bharatpur, Chitwan', '8+ years',
    array['Paddy cultivation', 'Crop planning', 'Seed selection', 'Farm budgeting'],
    'Paddy and crop-planning advisor helping Chitwan farmers choose varieties, plan seasons and budget input costs for dependable harvests.',
    array[
      'Sita has spent eight seasons walking paddy fields across Chitwan, guiding smallholder families from seed selection to harvest scheduling.',
      'She focuses on simple, low-cost plans: the right variety for the soil, a realistic fertilizer calendar and honest yield expectations.'
    ],
    array['Guided 300+ paddy farms through seasonal planning', 'Introduced SRI practices in 12 farmer groups'],
    array['B.Sc. Agriculture (IAAS, Rampur)', 'Certified farm business advisor'],
    '/experts/advisor-1.png', 'forest', 'active', true, 10, now()
  ),
  (
    '50000000-0000-0000-0000-000000000002', 'ram-bahadur-gurung', 'advisor',
    'Ram Bahadur Gurung', 'Livestock & Dairy Advisor', null,
    'Pokhara, Kaski', '12+ years',
    array['Dairy cattle', 'Feed planning', 'Shed management', 'Animal health basics'],
    'Livestock and dairy advisor supporting farmers with feed planning, shed layout and everyday herd-health routines that raise milk yield.',
    array[
      'Ram Bahadur has advised dairy households around Pokhara for over a decade, from two-cow sheds to growing commercial herds.',
      'His visits are practical: feed ratios you can afford, shed fixes that keep animals dry, and early-warning signs to watch before calling a vet.'
    ],
    array['Improved average milk yield for 150+ dairy households', 'Runs monthly farmer shed-training days'],
    array['Diploma in Animal Science (Lamjung Campus)', 'Government livestock training certified'],
    '/experts/advisor-2.png', 'earth', 'active', true, 20, now()
  ),
  (
    '50000000-0000-0000-0000-000000000003', 'maya-tamang', 'advisor',
    'Maya Tamang', 'Vegetable Farming Advisor', null,
    'Banepa, Kavre', '7+ years',
    array['Vegetable farming', 'Greenhouse management', 'Pest scouting', 'Harvest planning'],
    'Vegetable-farming advisor helping growers plan profitable rotations, manage greenhouses and time harvests for the Kalimati market.',
    array[
      'Maya works with vegetable growers in Kavre and Bhaktapur on rotation planning, greenhouse care and staggered planting for steadier income.',
      'She is known for simple record-keeping habits that help farmers see which crops actually pay.'
    ],
    array['Set up 40+ small greenhouses with first-season profit', 'Market-timing planner used by 3 cooperatives'],
    array['B.Sc. Agriculture (Horticulture focus)', 'Greenhouse technician training, JICA programme'],
    '/experts/advisor-3.png', 'sage', 'active', true, 30, now()
  ),
  (
    '50000000-0000-0000-0000-000000000004', 'dr-anil-karki', 'expert_professional',
    'Dr. Anil Karki', 'Senior Agronomist — Cereal Crops', null,
    'Kathmandu', '20+ years',
    array['Agronomy', 'Cereal crops', 'Variety trials', 'Yield improvement'],
    'Senior agronomist with two decades in cereal research, advising on variety choice, crop nutrition and yield improvement for paddy, wheat and maize.',
    array[
      'Dr. Karki led cereal variety trials across the Terai and mid-hills and now consults for farms and cooperatives that want research-grade guidance.',
      'He visits fields during critical growth stages and leaves a written season plan the whole family can follow.'
    ],
    array['20+ years in national cereal research programmes', 'Published variety-trial protocols adopted by NARC stations'],
    array['Ph.D. Agronomy', 'M.Sc. Agriculture, IAAS Rampur'],
    '/experts/expert-1.png', 'forest', 'active', true, 40, now()
  ),
  (
    '50000000-0000-0000-0000-000000000005', 'dr-bina-shrestha', 'expert_professional',
    'Dr. Bina Shrestha', 'Plant Protection Specialist — IPM', null,
    'Lalitpur', '15+ years',
    array['Integrated pest management', 'Disease diagnosis', 'Safe pesticide use'],
    'Plant-protection specialist diagnosing pest and disease outbreaks in the field and designing safe, integrated control plans that protect crops and soil.',
    array[
      'Dr. Shrestha spent fifteen years in plant pathology labs and field clinics identifying the outbreaks that cost farmers their season.',
      'Her reports combine immediate treatment with prevention: traps, resistant varieties and careful, label-correct pesticide use.'
    ],
    array['Diagnosed 1,000+ field cases for farmers and agrovets', 'Trainer for safe-pesticide-use certification'],
    array['Ph.D. Plant Pathology', 'IPM facilitator certification (FAO programme)'],
    '/experts/expert-2.png', 'sage', 'active', true, 50, now()
  ),
  (
    '50000000-0000-0000-0000-000000000006', 'er-dipesh-thapa', 'expert_professional',
    'Er. Dipesh Thapa', 'Agricultural Engineer — Irrigation & Machinery', null,
    'Bhaktapur', '14+ years',
    array['Irrigation design', 'Farm machinery', 'Drainage', 'Mechanisation planning'],
    'Agricultural engineer designing irrigation layouts, drainage and right-sized mechanisation plans so farms spend less on water, fuel and repairs.',
    array[
      'Dipesh designs drip and sprinkler layouts, pond and pump sizing, and machinery choices matched to actual field sizes and budgets.',
      'He also audits existing systems, finding the leaks and mismatches that quietly raise costs every season.'
    ],
    array['Designed irrigation for 200+ ha of vegetable farms', 'Machinery-selection advisor to 5 agricultural cooperatives'],
    array['M.Sc. Agricultural Engineering', 'NEC registered engineer'],
    '/experts/expert-3.png', 'earth', 'active', true, 60, now()
  ),
  (
    '50000000-0000-0000-0000-000000000007', 'dr-ganga-adhikari', 'expert_professional',
    'Dr. Ganga Adhikari', 'Soil Scientist — Fertility & Nutrition', null,
    'Chitwan', '18+ years',
    array['Soil testing', 'Fertilizer planning', 'Composting', 'Soil health'],
    'Soil scientist turning soil-test results into practical fertilizer and compost plans that rebuild fertility and cut unnecessary input costs.',
    array[
      'Dr. Adhikari has run soil-fertility programmes across the Terai, helping farmers replace guesswork with tested, field-specific nutrition plans.',
      'Her plans typically reduce fertilizer spend while improving soil organic matter year after year.'
    ],
    array['Built soil-testing calendars for 30+ cooperatives', 'Author of a Nepali-language composting handbook'],
    array['Ph.D. Soil Science', 'M.Sc. Agriculture, IAAS Rampur'],
    '/experts/expert-4.png', 'gold', 'active', true, 70, now()
  ),
  (
    '50000000-0000-0000-0000-000000000008', 'prakash-rai', 'expert_professional',
    'Prakash Rai', 'Horticulture Expert — Fruits & Orchard Management', null,
    'Dhankuta', '16+ years',
    array['Citrus orchards', 'Pruning & grafting', 'Orchard layout', 'Post-harvest handling'],
    'Horticulture expert specialising in citrus and fruit orchards — layout, grafting, pruning calendars and post-harvest handling for better prices.',
    array[
      'Prakash grew up in Dhankuta orange country and has spent sixteen years turning backyard trees into managed, profitable orchards.',
      'His seasonal visits cover pruning, nutrition and harvest handling so fruit reaches market in top condition.'
    ],
    array['Revived 60+ declining citrus orchards in the eastern hills', 'Trains grafting teams for district agriculture offices'],
    array['B.Sc. Horticulture', 'Advanced orchard-management training (Japan)'],
    '/experts/expert-5.png', 'forest', 'active', true, 80, now()
  )
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Bookable offerings (one per professional) — these power the
--    "Hire advisor" / "Hire expert" buttons and the request form.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.professional_offerings (
  id, profile_id, kind, title, description, price, unit_label, status
)
values
  (
    '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
    'advisory_service', 'On-Farm Paddy Advisory Visit',
    'Half-day field visit covering variety choice, crop stage review and a written season plan for your paddy.',
    2500, 'visit', 'active'
  ),
  (
    '60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002',
    'advisory_service', 'Dairy Herd Health & Feed Review',
    'Shed visit reviewing feed ratios, housing and herd health routines with a simple written action list.',
    3000, 'visit', 'active'
  ),
  (
    '60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003',
    'advisory_service', 'Vegetable Plot Planning Session',
    'On-farm or online session building a rotation and planting calendar matched to your plot size and market.',
    1800, 'session', 'active'
  ),
  (
    '60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000004',
    'expert_service', 'Cereal Crop Field Diagnosis & Season Plan',
    'Full field inspection during a critical growth stage with a research-grade written season plan.',
    4500, 'visit', 'active'
  ),
  (
    '60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000005',
    'expert_service', 'Pest & Disease Diagnosis with Treatment Plan',
    'Field diagnosis of the outbreak plus an integrated treatment and prevention plan with safe-pesticide guidance.',
    4000, 'visit', 'active'
  ),
  (
    '60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000006',
    'expert_service', 'Irrigation & Machinery System Review',
    'On-site audit of your irrigation layout and machinery use with concrete cost-saving recommendations.',
    6000, 'visit', 'active'
  ),
  (
    '60000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000007',
    'expert_service', 'Soil Health Assessment & Fertilizer Plan',
    'Soil sampling guidance, lab-test interpretation and a field-by-field fertilizer and compost plan.',
    3800, 'report', 'active'
  ),
  (
    '60000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000008',
    'expert_service', 'Orchard Management & Pruning Day',
    'A full working day in your orchard: pruning, nutrition review and a harvest-handling checklist.',
    5000, 'day', 'active'
  )
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Services & rentals listings — shown in the "Available support" grid:
--    2 machinery rentals, machinery maintenance, and the paddy / wheat /
--    mustard sowing-to-harvest season packages (quoted after field review).
-- ─────────────────────────────────────────────────────────────────────────────
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
from (
  values
    (
      '40000000-0000-0000-0000-000000000006'::uuid,
      'installation', 'service', 'drip-irrigation-installation',
      'Drip Irrigation Installation', 'ड्रिप सिँचाइ जडान सेवा',
      'Site review, system planning and installation for small and medium farms.',
      '["Site assessment", "Material estimate", "Installation and testing"]'::jsonb,
      array['drip','irrigation','installation','water','service','pipe','सिँचाइ','जडान'],
      'KHT-SV-DRIP', null::numeric, null::numeric, 'From Rs. 8,500', null, true, false, false,
      array['Kathmandu','Bhaktapur','Lalitpur','Kavre']
    ),
    (
      '40000000-0000-0000-0000-000000000007'::uuid,
      'tractor-rental', 'rental', 'tractor-rental-half-day',
      'Tractor Rental — Half Day', 'आधा दिन ट्र्याक्टर भाडा',
      'Reserve a tractor with an operator for ploughing and field preparation.',
      '["Operator included", "Four-hour booking", "Area confirmation required"]'::jsonb,
      array['tractor','rental','hire','ploughing','service','भाडा','ट्र्याक्टर'],
      'KHT-RT-TR4', 5500::numeric, null::numeric, null, '4 hours', true, false, false,
      array['Bhaktapur','Lalitpur','Kavre','Chitwan']
    ),
    (
      '40000000-0000-0000-0000-000000000009'::uuid,
      'tool-rental', 'rental', 'power-tiller-rental-full-day',
      'Power Tiller Rental — Full Day', 'पावर टिलर भाडा — पुरा दिन',
      'A full-day power tiller rental with operator for smaller plots and vegetable fields.',
      '["Operator included", "Eight-hour booking", "Fuel billed separately"]'::jsonb,
      array['power tiller','rental','hire','tilling','tractor','भाडा','टिलर'],
      'KHT-RT-PT8', 3200::numeric, null::numeric, null, 'day', true, false, false,
      array['Kathmandu','Bhaktapur','Lalitpur','Kavre']
    ),
    (
      '40000000-0000-0000-0000-00000000000a'::uuid,
      'field-support', 'service', 'machinery-service-maintenance',
      'Machinery Service & Maintenance Visit', 'मेसिनरी सेवा तथा मर्मत',
      'On-site servicing and repair check for tractors, tillers, pumps and threshers by a verified technician.',
      '["Full inspection", "Minor repairs on site", "Genuine parts estimate", "Service report"]'::jsonb,
      array['maintenance','repair','service','tractor','tiller','pump','मर्मत','मेसिन'],
      'KHT-SV-MAINT', 1500::numeric, null::numeric, null, 'service visit', true, false, false,
      array['Kathmandu','Bhaktapur','Lalitpur','Kavre','Chitwan']
    ),
    (
      '40000000-0000-0000-0000-00000000000b'::uuid,
      'field-support', 'service', 'paddy-season-package',
      'Paddy Season Package — Sowing to Harvest', 'धान प्याकेज — रोपाइँदेखि कटाइसम्म',
      'A full-season managed paddy service: nursery and transplanting support, crop-stage visits, harvest coordination. Priced per ropani after a field review.',
      '["Nursery & transplanting support", "Three crop-stage visits", "Harvest coordination", "Written season calendar"]'::jsonb,
      array['paddy','rice','sowing','harvesting','season','package','धान','रोपाइँ'],
      'KHT-SV-PADDY', null::numeric, null::numeric, 'Custom quote after field review', null, true, false, false,
      array['Chitwan','Kavre','Bhaktapur','Lalitpur']
    ),
    (
      '40000000-0000-0000-0000-00000000000c'::uuid,
      'field-support', 'service', 'wheat-season-package',
      'Wheat Season Package — Sowing to Harvest', 'गहुँ प्याकेज — बुवाइदेखि कटाइसम्म',
      'Full-season wheat service covering sowing, nutrient and weed management visits, and harvest coordination. Priced per ropani after a field review.',
      '["Sowing support", "Nutrient & weed visits", "Harvest coordination", "Written season calendar"]'::jsonb,
      array['wheat','sowing','harvesting','season','package','गहुँ'],
      'KHT-SV-WHEAT', null::numeric, null::numeric, 'Custom quote after field review', null, true, false, false,
      array['Chitwan','Kavre','Kathmandu','Lalitpur']
    ),
    (
      '40000000-0000-0000-0000-00000000000d'::uuid,
      'field-support', 'service', 'mustard-season-package',
      'Mustard Season Package — Sowing to Harvest', 'तोरी प्याकेज — बुवाइदेखि कटाइसम्म',
      'Full-season mustard service from sowing through harvest, including pest scouting and oil-content harvest timing. Priced per ropani after a field review.',
      '["Sowing support", "Pest scouting visits", "Harvest timing for oil content", "Written season calendar"]'::jsonb,
      array['mustard','torī','tori','sowing','harvesting','oilseed','तोरी'],
      'KHT-SV-MUSTARD', null::numeric, null::numeric, 'Custom quote after field review', null, true, false, false,
      array['Chitwan','Kavre','Bhaktapur']
    )
) as starter (
  id, category_slug, kind, slug, name_en, name_ne, short_description_en,
  specifications, search_keywords, sku, base_price, compare_at_price,
  price_label, unit_label, available, stock_managed, featured, districts
)
join public.categories on categories.slug = starter.category_slug
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Listing photos — site-local image paths served from the website's /public
--    folder (public/services/*.png). Safe to run again.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.listing_images (listing_id, storage_path, alt_text_en, is_primary, sort_order)
select listings.id, img.path, img.alt, true, 0
from (values
  ('drip-irrigation-installation', '/services/drip-irrigation.png', 'Drip irrigation lines running through a vegetable field'),
  ('tractor-rental-half-day', '/services/tractor-rental.png', 'Compact tractor on a ploughed field'),
  ('power-tiller-rental-full-day', '/services/power-tiller.png', 'Power tiller working a muddy paddy field'),
  ('machinery-service-maintenance', '/services/machinery-maintenance.png', 'Technician servicing a tractor engine'),
  ('paddy-season-package', '/services/paddy-season.png', 'Green terraced paddy fields'),
  ('wheat-season-package', '/services/wheat-season.png', 'Golden wheat field before harvest'),
  ('mustard-season-package', '/services/mustard-season.png', 'Yellow mustard flowers in bloom')
) as img (slug, path, alt)
join public.listings on listings.slug = img.slug
on conflict (listing_id, storage_path) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Confirmation — expect: 8 profiles, 8 offerings, 7 service/rental listings.
-- If a listing row is missing, its category slug is missing in your categories
-- table (run supabase/seed.sql first, or check the name in the admin panel).
-- ─────────────────────────────────────────────────────────────────────────────
select 'profiles' as section, role::text, name from public.professional_profiles
where slug in ('sita-sharma','ram-bahadur-gurung','maya-tamang','dr-anil-karki','dr-bina-shrestha','er-dipesh-thapa','dr-ganga-adhikari','prakash-rai')
union all
select 'offerings', kind::text, title from public.professional_offerings
where id::text like '60000000-%'
union all
select 'listings', kind::text, name_en from public.listings
where slug in ('drip-irrigation-installation','tractor-rental-half-day','power-tiller-rental-full-day','machinery-service-maintenance','paddy-season-package','wheat-season-package','mustard-season-package')
order by 1, 2, 3;
