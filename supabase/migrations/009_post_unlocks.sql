-- ──────────────────────────────────────────────────────────────────
-- 009_post_unlocks.sql
-- One-time post purchases. A fan pays a flat fee to unlock a single
-- post without subscribing. Separate from subscription-gated posts.
-- ──────────────────────────────────────────────────────────────────

-- Add unlock fields to posts
alter table public.posts
  add column if not exists lock_type text not null default 'free'
    check (lock_type in ('free', 'subscription', 'purchase')),
  add column if not exists unlock_price numeric(10,2) null;

-- Track who has unlocked which post
create table if not exists public.post_unlocks (
  id                  uuid primary key default gen_random_uuid(),
  post_id             uuid references public.posts(id) on delete cascade not null,
  fan_user_id         uuid references auth.users(id) on delete cascade not null,
  amount_paid         numeric(10,2) not null,
  stripe_session_id   text,
  created_at          timestamptz not null default now(),
  unique (post_id, fan_user_id)
);

alter table public.post_unlocks enable row level security;

-- Fans can see their own unlocks
create policy "post_unlocks_fan_select" on public.post_unlocks
  for select using (fan_user_id = auth.uid());

-- Creators can see who unlocked their posts
create policy "post_unlocks_creator_select" on public.post_unlocks
  for select using (
    post_id in (
      select p.id from public.posts p
      join public.creator_profiles cp on cp.id = p.creator_profile_id
      where cp.user_id = auth.uid()
    )
  );

-- Service role inserts (from webhook)
create policy "post_unlocks_service_insert" on public.post_unlocks
  for insert with check (true);
