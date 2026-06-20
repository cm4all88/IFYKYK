-- Free tier: creator-customized name, description, and perks for the free
-- membership that shows on the public page as the "Join free" option.
alter table public.creator_profiles
  add column if not exists free_tier_name text,
  add column if not exists free_tier_blurb text,
  add column if not exists free_tier_perks text[] default '{}'::text[];

notify pgrst, 'reload schema';
