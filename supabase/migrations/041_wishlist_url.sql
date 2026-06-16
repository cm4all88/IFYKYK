-- Plain Amazon wishlist link shown on the creator page (display only, no commission).
alter table public.creator_profiles
  add column if not exists wishlist_url text;
notify pgrst, 'reload schema';
