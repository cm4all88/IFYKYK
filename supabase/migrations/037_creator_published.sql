-- Concierge / preview state for creators.
-- published=false means the page exists and is viewable by direct link,
-- but stays out of Explore and discovery until the creator goes live.
alter table public.creator_profiles
  add column if not exists published boolean not null default true;
-- everything that already exists stays visible
update public.creator_profiles set published = true where published is null;
create index if not exists idx_creator_profiles_published
  on public.creator_profiles (published) where published = true;
