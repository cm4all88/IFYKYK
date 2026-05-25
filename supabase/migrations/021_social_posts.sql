-- Migration 021: Social Posts (cross-platform feed)
-- Creators paste social media URLs, we fetch oEmbed and display in their mixed feed

create table if not exists social_posts (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references creator_profiles(id) on delete cascade not null,
  url text not null,
  platform text not null check (platform in ('instagram','tiktok','youtube','x','facebook')),
  oembed_html text,
  caption text,
  thumbnail_url text,
  original_posted_at timestamptz,  -- from oEmbed response where available
  pinned boolean default false,
  created_at timestamptz default now()
);

create index social_posts_creator_id_idx on social_posts(creator_id);
create index social_posts_original_posted_at_idx on social_posts(original_posted_at desc nulls last);

alter table social_posts enable row level security;

create policy "Creators manage own social posts"
  on social_posts for all
  using (creator_id = auth.uid());

create policy "Public can view social posts"
  on social_posts for select
  using (true);
