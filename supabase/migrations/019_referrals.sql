-- ──────────────────────────────────────────────────────────────────
-- 019_referrals.sql
-- Two referral systems:
-- 1. Creator referrals  — creator refers creators to Spotlightly
--    Every 5 signups = 1 free month on their billing tier
-- 2. Subscriber referrals — creator shares link, fans subscribe
--    Tracked for analytics + future rewards
-- ──────────────────────────────────────────────────────────────────

-- Creator referrals (creator → new creator signup)
create table if not exists public.creator_referrals (
  id                    uuid primary key default gen_random_uuid(),
  referrer_profile_id   uuid references public.creator_profiles(id) on delete cascade not null,
  referred_user_id      uuid references auth.users(id) on delete set null,
  referred_handle       text,
  credited              boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists creator_referrals_referrer_idx
  on public.creator_referrals(referrer_profile_id, credited);

-- Billing credits earned from referrals (1 = 1 month free)
create table if not exists public.billing_credits (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  amount_usd          numeric(10,2) not null default 29.00,
  reason              text not null,
  applied             boolean not null default false,
  applied_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists billing_credits_creator_idx
  on public.billing_credits(creator_profile_id, applied);

-- Subscriber referrals (creator shares link → fan signs up & subscribes)
create table if not exists public.subscriber_referrals (
  id                    uuid primary key default gen_random_uuid(),
  referrer_profile_id   uuid references public.creator_profiles(id) on delete cascade not null,
  fan_user_id           uuid references auth.users(id) on delete set null,
  fan_email             text,
  subscribed            boolean not null default false,
  subscribed_at         timestamptz,
  discount_applied      boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists subscriber_referrals_referrer_idx
  on public.subscriber_referrals(referrer_profile_id);

-- RLS
alter table public.creator_referrals     enable row level security;
alter table public.billing_credits       enable row level security;
alter table public.subscriber_referrals  enable row level security;

create policy "creator_referrals_own" on public.creator_referrals
  for select using (
    referrer_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );
create policy "creator_referrals_insert" on public.creator_referrals
  for insert with check (true);
create policy "creator_referrals_update" on public.creator_referrals
  for update using (true);

create policy "billing_credits_own" on public.billing_credits
  for select using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );
create policy "billing_credits_service" on public.billing_credits
  for all using (true) with check (true);

create policy "subscriber_referrals_own" on public.subscriber_referrals
  for select using (
    referrer_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );
create policy "subscriber_referrals_insert" on public.subscriber_referrals
  for insert with check (true);
create policy "subscriber_referrals_update" on public.subscriber_referrals
  for update using (true);
