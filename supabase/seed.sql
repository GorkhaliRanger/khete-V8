-- Starter category hierarchy matching the current khetE frontend.
-- The admin panel can edit these records after Supabase is connected.

insert into public.categories
  (id, parent_id, level, slug, name_en, name_ne, description_en, icon_name, show_on_homepage, sort_order)
values
  ('10000000-0000-0000-0000-000000000001', null, 0, 'machinery', 'Machinery & Equipment', 'मेसिनरी तथा उपकरण', 'Machines, tools, irrigation equipment and rentals for farms of every scale.', 'tractor', true, 10),
  ('10000000-0000-0000-0000-000000000002', null, 0, 'produce', 'Fresh Produce', 'ताजा कृषि उपज', 'Fresh vegetables, fruits, grains and local farm produce sold by weight or pack.', 'sprout', true, 20),
  ('10000000-0000-0000-0000-000000000003', null, 0, 'seeds-inputs', 'Seeds & Farm Inputs', 'बीउ तथा कृषि सामग्री', 'Seeds, nutrition, growing media and farm essentials for dependable production.', 'wheat', true, 30),
  ('10000000-0000-0000-0000-000000000004', null, 0, 'livestock', 'Livestock', 'पशुपन्छी', 'Verified livestock listings with documentation and delivery coordination.', 'cow', true, 40),
  ('10000000-0000-0000-0000-000000000005', null, 0, 'services', 'Services & Rentals', 'सेवा तथा भाडा', 'Equipment rental, installation, farm support and agricultural services.', 'wrench', true, 50)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_ne = excluded.name_ne,
  description_en = excluded.description_en,
  icon_name = excluded.icon_name,
  show_on_homepage = excluded.show_on_homepage,
  sort_order = excluded.sort_order;

insert into public.categories
  (id, parent_id, level, slug, name_en, sort_order)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'tractors', 'Tractors', 10),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 1, 'irrigation', 'Irrigation', 20),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 1, 'farm-tools', 'Farm Tools', 30),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 1, 'vegetables', 'Vegetables', 10),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 1, 'fruits', 'Fruits', 20),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 1, 'seeds', 'Seeds', 10),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 1, 'soil-nutrition', 'Soil & Nutrition', 20),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000004', 1, 'cattle', 'Cattle', 10),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000004', 1, 'small-livestock', 'Small Livestock', 20),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000005', 1, 'equipment-rental', 'Equipment Rental', 10),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000005', 1, 'farm-services', 'Farm Services', 20)
on conflict (id) do update set
  parent_id = excluded.parent_id,
  level = excluded.level,
  name_en = excluded.name_en,
  sort_order = excluded.sort_order;

insert into public.categories
  (id, parent_id, level, slug, name_en, sort_order)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 2, 'heavy-duty-tractors', 'Heavy-Duty Tractors', 10),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 2, 'power-tillers', 'Power Tillers', 20),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 2, 'power-trailers', 'Power Trailers', 30),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 2, 'drip-systems', 'Drip Systems', 10),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 2, 'water-pumps', 'Water Pumps', 20),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 2, 'hand-tools', 'Hand Tools', 10),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', 2, 'sprayers', 'Sprayers', 20),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000004', 2, 'leafy-greens', 'Leafy Greens', 10),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000004', 2, 'seasonal-vegetables', 'Seasonal Vegetables', 20),
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000005', 2, 'citrus', 'Citrus', 10),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000005', 2, 'orchard-fruits', 'Orchard Fruits', 20),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000006', 2, 'vegetable-seeds', 'Vegetable Seeds', 10),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000006', 2, 'grain-seeds', 'Grain Seeds', 20),
  ('30000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000007', 2, 'organic-inputs', 'Organic Inputs', 10),
  ('30000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000007', 2, 'fertilizers', 'Fertilizers', 20),
  ('30000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000008', 2, 'dairy-cattle', 'Dairy Cattle', 10),
  ('30000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000008', 2, 'calves', 'Calves', 20),
  ('30000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000009', 2, 'goats', 'Goats', 10),
  ('30000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000009', 2, 'poultry', 'Poultry', 20),
  ('30000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000010', 2, 'tractor-rental', 'Tractor Rental', 10),
  ('30000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000010', 2, 'tool-rental', 'Tool Rental', 20),
  ('30000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000011', 2, 'installation', 'Installation', 10),
  ('30000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000011', 2, 'field-support', 'Field Support', 20)
on conflict (id) do update set
  parent_id = excluded.parent_id,
  level = excluded.level,
  name_en = excluded.name_en,
  sort_order = excluded.sort_order;

