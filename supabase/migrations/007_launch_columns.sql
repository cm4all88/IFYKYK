-- ──────────────────────────────────────────────────────────────────
-- Migration 007 — Launch columns
-- Adds stripe_account_id, social_links, subscription_price, ccbill fields
-- Run this in Supabase SQL editor before launch
-- ──────────────────────────────────────────────────────────────────

-- Stripe Connect account ID (set after creator completes onboarding)
alter table public.creator_profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_onboarded boolean default false;

-- Social links for link-in-bio (Linktree replacement)
alter table public.creator_profiles
  add column if not exists social_links jsonb default '{}'::jsonb;

-- Creator-set subscription price (monthly, in USD)
alter table public.creator_profiles
  add column if not exists subscription_price decimal(10,2) default 9.99;

-- CCBill credentials for Backstage creators
alter table public.creator_profiles
  add column if not exists ccbill_account_number text,
  add column if not exists ccbill_sub_account text;

-- Soft delete / account deletion timestamp
alter table public.creator_profiles
  add column if not exists deleted_at timestamptz;

-- Moderation: track which posts were AI-reviewed
alter table public.posts
  add column if not exists moderation_status text default 'pending'
    check (moderation_status in ('pending','approved','flagged','blocked')),
  add column if not exists moderation_note text;

select 'Migration 007 complete' as result;

-- Fan blocks table — creator can block specific fans by email
create table if not exists public.fan_blocks (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  fan_email           text not null,
  fan_user_id         uuid references auth.users(id) on delete set null,
  reason              text,
  created_at          timestamptz not null default now(),
  unique(creator_profile_id, fan_email)
);

alter table public.fan_blocks enable row level security;

create policy "Creators manage own blocks" on public.fan_blocks
  for all to authenticated
  using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );

-- Region blocking — array of country codes the creator has blocked
alter table public.creator_profiles
  add column if not exists blocked_regions text[] default '{}';

create index if not exists idx_fan_blocks_creator on public.fan_blocks(creator_profile_id);
create index if not exists idx_fan_blocks_email on public.fan_blocks(fan_email);

select 'Migration 007 extended with fan_blocks' as result;

-- ──────────────────────────────────────────────────────────────────
-- Campaigns — creator fundraising with exclusive access as reward
-- ──────────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  title               text not null,
  description         text,
  goal_amount         decimal(10,2) not null,
  raised_amount       decimal(10,2) not null default 0,
  deadline            timestamptz,
  status              text not null default 'active'
    check (status in ('active','funded','closed','cancelled')),
  reward_description  text, -- what donors get access to
  cover_image_url     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.campaign_donations (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid references public.campaigns(id) on delete cascade not null,
  donor_user_id       uuid references auth.users(id) not null,
  amount              decimal(10,2) not null,
  message             text,
  stripe_session_id   text,
  created_at          timestamptz not null default now()
);

alter table public.campaigns enable row level security;
alter table public.campaign_donations enable row level security;

-- Public can view active campaigns
create policy "Campaigns are public" on public.campaigns
  for select using (status in ('active','funded'));

-- Creators manage own campaigns
create policy "Creators manage own campaigns" on public.campaigns
  for all to authenticated
  using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );

-- Donors see own donations
create policy "Donors see own donations" on public.campaign_donations
  for select to authenticated
  using (donor_user_id = auth.uid());

-- Creators see donations to their campaigns
create policy "Creators see campaign donations" on public.campaign_donations
  for select to authenticated
  using (
    campaign_id in (
      select id from public.campaigns where creator_profile_id in (
        select id from public.creator_profiles where user_id = auth.uid()
      )
    )
  );

create policy "Authenticated users can donate" on public.campaign_donations
  for insert to authenticated
  with check (donor_user_id = auth.uid());

create index if not exists idx_campaigns_creator on public.campaigns(creator_profile_id);
create index if not exists idx_donations_campaign on public.campaign_donations(campaign_id);
create index if not exists idx_donations_donor on public.campaign_donations(donor_user_id);

select 'Campaigns table created' as result;

-- ──────────────────────────────────────────────────────────────────
-- Wishlists — creator gift registry with anonymous address
-- ──────────────────────────────────────────────────────────────────

-- Wishlist items (set by creator, shown publicly)
create table if not exists public.wishlist_items (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  name                text not null,
  description         text,
  price               decimal(10,2) not null,
  image_url           text,
  store_url           text,        -- original product link
  store_name          text,        -- "Amazon", "Best Buy", "Apple" etc
  priority            int default 0, -- higher = show first
  is_purchased        boolean not null default false,
  purchased_by_id     uuid references auth.users(id),
  purchased_at        timestamptz,
  reserved_until      timestamptz, -- 15 min hold while fan is in checkout
  created_at          timestamptz not null default now()
);

-- Wishlist purchases — tracks what needs to be fulfilled
create table if not exists public.wishlist_purchases (
  id                  uuid primary key default gen_random_uuid(),
  wishlist_item_id    uuid references public.wishlist_items(id) not null,
  creator_profile_id  uuid references public.creator_profiles(id) not null,
  buyer_user_id       uuid references auth.users(id) not null,
  item_price          decimal(10,2) not null,
  service_fee         decimal(10,2) not null,
  total_charged       decimal(10,2) not null,
  stripe_session_id   text,
  status              text not null default 'pending'
    check (status in ('paid_pending_purchase','creator_purchased','refunded')),
  tracking_number     text,
  buyer_message       text,
  receipt_url         text,         -- creator uploads proof of purchase
  stripe_transfer_id  text,         -- Stripe transfer ID when reimbursed
  fulfillment_notes   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Creator shipping address (private — never exposed to fans or public)
alter table public.creator_profiles
  add column if not exists shipping_name text,
  add column if not exists shipping_address text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists shipping_zip text,
  add column if not exists shipping_country text default 'US';

-- RLS
alter table public.wishlist_items enable row level security;
alter table public.wishlist_purchases enable row level security;

-- Anyone can view unpurchased wishlist items
create policy "Wishlist items are public" on public.wishlist_items
  for select using (true);

-- Creators manage own wishlist
create policy "Creators manage own wishlist" on public.wishlist_items
  for all to authenticated
  using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );

-- Buyers see own purchases
create policy "Buyers see own purchases" on public.wishlist_purchases
  for select to authenticated
  using (buyer_user_id = auth.uid());

-- Creators see purchases on their items
create policy "Creators see own wishlist purchases" on public.wishlist_purchases
  for select to authenticated
  using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );

create policy "Authenticated users can create purchases" on public.wishlist_purchases
  for insert to authenticated
  with check (buyer_user_id = auth.uid());

create index if not exists idx_wishlist_creator on public.wishlist_items(creator_profile_id, is_purchased);
create index if not exists idx_wishlist_purchases_item on public.wishlist_purchases(wishlist_item_id);

select 'Wishlist tables created' as result;
