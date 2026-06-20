-- ──────────────────────────────────────────────────────────────────
-- 046_first_month_offer.sql
-- First-month offer: a creator-set discount applied to a NEW subscriber's
-- first invoice only. 0 = no offer.
--
-- The creator keeps 100% of the (discounted) price; Spotlightly stays 0%.
-- The discount lowers what the fan pays the first period; it does not take
-- anything from the creator beyond the price they chose to discount.
--
-- The feature is gated to Starter+ at the point of effect (the subscribe
-- routes only apply the discount if the creator is currently entitled), so
-- this column has no entitlement logic of its own.
-- ──────────────────────────────────────────────────────────────────

alter table public.creator_profiles
  add column if not exists first_month_offer_pct integer not null default 0
    check (first_month_offer_pct >= 0 and first_month_offer_pct <= 100);
