-- Homepage highlight promo details.
-- Lets admins give each highlighted listing its own badge, headline,
-- description and image for the Featured Products and Deals sections.

alter table public.home_highlights
  add column if not exists badge text,
  add column if not exists headline text,
  add column if not exists description text,
  add column if not exists image_path text;
