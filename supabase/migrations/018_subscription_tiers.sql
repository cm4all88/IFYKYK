-- ──────────────────────────────────────────────────────────────────
-- 018_subscription_tiers.sql
-- Creator-defined subscription tiers with monthly and yearly pricing.
-- Creators can have unlimited tiers. Platform takes 0% (flat fee model).
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.subscription_tiers (
  id                      uuid primary key default gen_random_uuid(),
  creator_profile_id      uuid references public.creator_profiles(id) on delete cascade not null,
  name                    text not null,
  description             text,
  perks                   text[] not null default '{}',
  monthly_price           numeric(10,2) not null check (monthly_price >= 0.99),
  yearly_price            numeric(10,2),            -- null = no yearly option
  yearly_discount_pct     integer default 20,        -- e.g. 20 = 20% off yearly
  sort_order              integer not null default 0,
  is_active               boolean not null default true,
  -- Stripe price IDs (created automatically when tier is saved)
  stripe_monthly_price_id text,
  stripe_yearly_price_id  text,
  stripe_product_id       text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Add tier_id to subscriptions
alter table public.subscriptions
  add column if not exists tier_id         uuid references public.subscription_tiers(id) on delete set null,
  add column if not exists billing_period  text check (billing_period in ('monthly', 'yearly')) default 'monthly';

-- Indexes
create index if not exists subscription_tiers_creator_idx
  on public.subscription_tiers(creator_profile_id, is_active, sort_order);

-- RLS
alter table public.subscription_tiers enable row level security;

create policy "tiers_public_select" on public.subscription_tiers
  for select using (is_active = true);

create policy "tiers_creator_select_all" on public.subscription_tiers
  for select using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

create policy "tiers_creator_manage" on public.subscription_tiers
  for all using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );
