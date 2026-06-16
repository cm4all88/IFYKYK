-- Creator endorsements: products linked with Spotlightly's Amazon Associates tag.
create table if not exists public.affiliate_picks (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid references public.creator_profiles(id) on delete cascade not null,
  asin text,
  url text not null,
  label text not null,
  image_url text,
  note text,
  sort int default 0,
  created_at timestamptz default now()
);
alter table public.affiliate_picks enable row level security;
create policy "Affiliate picks are public" on public.affiliate_picks
  for select using (true);
create index if not exists idx_affiliate_picks_creator
  on public.affiliate_picks(creator_profile_id);
