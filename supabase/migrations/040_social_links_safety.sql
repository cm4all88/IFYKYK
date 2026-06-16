-- Safety: ensure the social_links column exists (no-op if already added earlier).
alter table public.creator_profiles
  add column if not exists social_links jsonb default '{}'::jsonb;
notify pgrst, 'reload schema';
