-- khet E — editable site content (story page marquee, etc.)
-- Run in the Supabase SQL Editor. Project: xcyxzfthyirsofpnzxsz

create table if not exists public.site_content (
  key text primary key,
  value_en text not null,
  value_ne text,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

create policy "Public read access to site content"
  on public.site_content for select
  using (true);

create policy "Admin manage site content"
  on public.site_content for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('super_admin', 'content_promotion_manager')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('super_admin', 'content_promotion_manager')
    )
  );

insert into public.site_content (key, value_en, value_ne)
values (
  'story_marquee',
  'From our fields to your family — trade that begins and ends with the farmer.',
  'हाम्रो खेतबाट तपाईंको परिवारसम्म — जसको सुरुवात किसानबाटै हुन्छ, अन्त्य पनि किसानमै।'
)
on conflict (key) do nothing;
