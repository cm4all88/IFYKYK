-- Migration 022: Live stream chat, tips, and moderation preferences

-- Live chat messages
create table if not exists public.live_chat_messages (
  id              uuid primary key default gen_random_uuid(),
  stream_id       uuid references public.live_streams(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete set null,
  display_name    text not null,
  message         text not null,
  is_tip          boolean default false,
  tip_amount_usd  numeric(10,2),
  moderated       boolean default false,
  created_at      timestamptz default now()
);

create index live_chat_messages_stream_idx on public.live_chat_messages(stream_id, created_at desc);

alter table public.live_chat_messages enable row level security;

-- Anyone logged in can read chat for a stream
create policy "Public can read live chat"
  on live_chat_messages for select using (true);

-- Logged in users can post
create policy "Logged in users can post chat"
  on live_chat_messages for insert
  with check (user_id = auth.uid());

-- Creator moderation preferences (per creator profile)
create table if not exists public.stream_moderation_prefs (
  id                    uuid primary key default gen_random_uuid(),
  creator_profile_id    uuid references public.creator_profiles(id) on delete cascade unique not null,
  moderation_level      text default 'moderate' check (moderation_level in ('strict', 'moderate', 'open')),
  banned_words          text[] default '{}',
  allow_links           boolean default false,
  slow_mode_seconds     int default 0,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table public.stream_moderation_prefs enable row level security;

create policy "Creators manage own moderation prefs"
  on stream_moderation_prefs for all
  using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );

create policy "Public can read moderation prefs"
  on stream_moderation_prefs for select using (true);

-- Live stream tip leaderboard (session-based)
create table if not exists public.live_stream_tips (
  id              uuid primary key default gen_random_uuid(),
  stream_id       uuid references public.live_streams(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete set null,
  display_name    text not null,
  amount_usd      numeric(10,2) not null,
  message         text,
  payment_method  text default 'stripe' check (payment_method in ('stripe', 'ccbill')),
  created_at      timestamptz default now()
);

create index live_stream_tips_stream_idx on public.live_stream_tips(stream_id, amount_usd desc);

alter table public.live_stream_tips enable row level security;

create policy "Public can view stream tips"
  on live_stream_tips for select using (true);

create policy "Logged in users can tip"
  on live_stream_tips for insert
  with check (user_id = auth.uid());
