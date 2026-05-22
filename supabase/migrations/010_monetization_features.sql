-- ──────────────────────────────────────────────────────────────────
-- 010_monetization_features.sql
-- Super Tips, Comments, Comment Boosts, Early Access Passes,
-- Gift Subscriptions, Live Streams
-- ──────────────────────────────────────────────────────────────────

-- SUPER TIPS
-- Platform takes 15%, creator gets 85%.
-- Fan gets Top Supporter badge for 30 days.
create table if not exists public.super_tips (
  id                    uuid primary key default gen_random_uuid(),
  creator_profile_id    uuid references public.creator_profiles(id) on delete cascade not null,
  fan_user_id           uuid references auth.users(id) on delete set null,
  fan_display_name      text,              -- shown publicly on the tip banner
  message               text,              -- optional message with the tip
  amount_usd            numeric(10,2) not null,
  creator_receives      numeric(10,2) not null, -- 85%
  platform_receives     numeric(10,2) not null, -- 15%
  stripe_session_id     text,
  badge_expires_at      timestamptz,       -- 30 days from created_at
  notified              boolean not null default false,
  created_at            timestamptz not null default now()
);
alter table public.super_tips enable row level security;
create policy "super_tips_creator_select" on public.super_tips
  for select using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
    or fan_user_id = auth.uid()
  );
create policy "super_tips_insert" on public.super_tips
  for insert with check (true); -- service role from webhook

-- COMMENTS
create table if not exists public.comments (
  id                    uuid primary key default gen_random_uuid(),
  post_id               uuid references public.posts(id) on delete cascade not null,
  creator_profile_id    uuid references public.creator_profiles(id) on delete cascade not null,
  author_user_id        uuid references auth.users(id) on delete cascade not null,
  content               text not null check (char_length(content) <= 500),
  is_boosted            boolean not null default false,
  boosted_until         timestamptz,
  boost_amount_usd      numeric(10,2),
  boost_stripe_session  text,
  created_at            timestamptz not null default now()
);
create index if not exists comments_post_id on public.comments(post_id, created_at desc);
alter table public.comments enable row level security;
create policy "comments_select" on public.comments
  for select using (true); -- public
create policy "comments_insert" on public.comments
  for insert with check (author_user_id = auth.uid());
create policy "comments_delete" on public.comments
  for delete using (
    author_user_id = auth.uid()
    or creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

-- EARLY ACCESS PASSES
-- Fan pays $2.99/mo to see posts 30 min before regular subscribers.
-- 100% to platform (regular Stripe, no Connect).
create table if not exists public.early_access_passes (
  id                        uuid primary key default gen_random_uuid(),
  fan_user_id               uuid references auth.users(id) on delete cascade not null,
  creator_profile_id        uuid references public.creator_profiles(id) on delete cascade not null,
  stripe_subscription_id    text,
  status                    text not null default 'active' check (status in ('active', 'cancelled', 'past_due')),
  created_at                timestamptz not null default now(),
  unique(fan_user_id, creator_profile_id)
);
alter table public.early_access_passes enable row level security;
create policy "early_access_fan_select" on public.early_access_passes
  for select using (fan_user_id = auth.uid());
create policy "early_access_insert" on public.early_access_passes
  for insert with check (true);
create policy "early_access_update" on public.early_access_passes
  for update using (true);

-- Add early_access_at to posts (set by creator when scheduling)
alter table public.posts add column if not exists early_access_at timestamptz;

-- GIFT SUBSCRIPTIONS
create table if not exists public.gift_subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  gifter_user_id        uuid references auth.users(id) on delete set null,
  recipient_email       text not null,
  recipient_user_id     uuid references auth.users(id) on delete set null,
  creator_profile_id    uuid references public.creator_profiles(id) on delete cascade not null,
  months                integer not null default 1 check (months between 1 and 12),
  amount_paid           numeric(10,2) not null,
  stripe_session_id     text,
  redemption_code       text not null unique default encode(gen_random_bytes(12), 'hex'),
  redeemed_at           timestamptz,
  created_at            timestamptz not null default now()
);
alter table public.gift_subscriptions enable row level security;
create policy "gift_sub_gifter_select" on public.gift_subscriptions
  for select using (gifter_user_id = auth.uid() or recipient_user_id = auth.uid());
create policy "gift_sub_insert" on public.gift_subscriptions
  for insert with check (true);
create policy "gift_sub_update" on public.gift_subscriptions
  for update using (true);

-- LIVE STREAMS
create table if not exists public.live_streams (
  id                    uuid primary key default gen_random_uuid(),
  creator_profile_id    uuid references public.creator_profiles(id) on delete cascade not null,
  bunny_stream_id       text not null,
  title                 text not null default 'Live Stream',
  status                text not null default 'live' check (status in ('live', 'ended')),
  playback_url          text not null,
  rtmp_url              text not null,
  stream_key            text not null,
  started_at            timestamptz not null default now(),
  ended_at              timestamptz,
  created_at            timestamptz not null default now()
);
alter table public.live_streams enable row level security;
create policy "live_streams_select" on public.live_streams
  for select using (true);
create policy "live_streams_creator_manage" on public.live_streams
  for all using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );
create policy "live_streams_insert" on public.live_streams
  for insert with check (true);
