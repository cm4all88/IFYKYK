-- ──────────────────────────────────────────────────────────────────
-- 012_creator_billing.sql
-- Tracks the platform subscription each creator pays to Spotlightly.
-- Separate from fan→creator subscriptions.
-- Tiers based on subscriber count, auto-upgraded at billing cycle.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.creator_billing (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references auth.users(id) on delete cascade not null unique,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  status                  text not null default 'trial'
                            check (status in ('trial', 'active', 'past_due', 'cancelled', 'incomplete')),
  tier                    text not null default 'starter'
                            check (tier in ('starter', 'growth', 'pro', 'scale', 'legend')),
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  trial_warning_sent      boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Indexes
create index if not exists creator_billing_user_id on public.creator_billing(user_id);
create index if not exists creator_billing_trial_ends on public.creator_billing(trial_ends_at)
  where status = 'trial';

-- RLS
alter table public.creator_billing enable row level security;

create policy "creator_billing_own_select" on public.creator_billing
  for select using (user_id = auth.uid());

create policy "creator_billing_service_all" on public.creator_billing
  for all using (true) with check (true);

-- Helper: calculate tier from subscriber count
create or replace function public.billing_tier_for_count(subscriber_count integer)
returns text language sql immutable as $$
  select case
    when subscriber_count <= 100   then 'starter'
    when subscriber_count <= 500   then 'growth'
    when subscriber_count <= 2500  then 'pro'
    when subscriber_count <= 10000 then 'scale'
    else 'legend'
  end;
$$;
