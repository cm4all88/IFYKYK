-- Migration 023: Extended posts features
-- Tags, post types, expiry, scheduling, pinning, VOD, archive/delete

-- Post tags (array of strings)
alter table public.posts add column if not exists tags text[] default '{}';

-- Post type
alter table public.posts add column if not exists post_type text default 'post'
  check (post_type in ('post', 'campaign_update', 'vod'));

-- Time-limited posts
alter table public.posts add column if not exists expires_at timestamptz;

-- Pin to top of creator page
alter table public.posts add column if not exists is_pinned boolean default false;

-- Scheduled publishing
alter table public.posts add column if not exists scheduled_at timestamptz;

-- Campaign link (for campaign_update type)
alter table public.posts add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

-- VOD source stream
alter table public.posts add column if not exists vod_stream_id uuid references public.live_streams(id) on delete set null;

-- Indexes
create index if not exists posts_tags_idx on public.posts using gin(tags);
create index if not exists posts_scheduled_at_idx on public.posts(scheduled_at) where scheduled_at is not null;
create index if not exists posts_expires_at_idx on public.posts(expires_at) where expires_at is not null;
create index if not exists posts_is_pinned_idx on public.posts(creator_profile_id, is_pinned) where is_pinned = true;
