-- ─────────────────────────────────────────────────────────────────────────────
-- 063_subscription_payments.sql
-- A ledger row for every fan subscription payment.
--
-- Why: nothing recorded recurring revenue. The subscriptions table holds the
-- current state of a subscription (status, price, period) but not a history of
-- what was actually paid, so there was no way to answer "how much did this
-- creator earn last month" for the single largest revenue source on the
-- platform. One-off purchases each have their own table; subscriptions had none.
--
-- invoice.payment_succeeded fires on every renewal, so this fills forward from
-- the day it ships. It cannot backfill: Stripe has the history, the database
-- never did.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.subscription_payments (
  id                      uuid primary key default gen_random_uuid(),
  subscription_id         uuid references public.subscriptions(id) on delete set null,
  creator_profile_id      uuid references public.creator_profiles(id) on delete cascade not null,
  fan_user_id             uuid references auth.users(id) on delete set null,

  gross_usd               numeric(10,2) not null,  -- what the fan was charged
  platform_fee_usd        numeric(10,2) not null default 0,
  creator_receives        numeric(10,2) not null,  -- what the creator keeps

  stripe_invoice_id       text unique,             -- idempotency: one row per invoice
  stripe_subscription_id  text,
  status                  text not null default 'paid'
                            check (status in ('paid', 'refunded')),

  created_at              timestamptz not null default now()
);

create index if not exists subscription_payments_creator_idx
  on public.subscription_payments(creator_profile_id, created_at desc);
create index if not exists subscription_payments_sub_idx
  on public.subscription_payments(stripe_subscription_id);

alter table public.subscription_payments enable row level security;

-- Creators see their own. Fans see what they paid.
drop policy if exists "subscription_payments_select" on public.subscription_payments;
create policy "subscription_payments_select" on public.subscription_payments
  for select using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
    or fan_user_id = auth.uid()
  );

-- Written by the Stripe webhook under the service role, which bypasses RLS.
-- No insert policy is granted to anyone else on purpose.
