-- ─────────────────────────────────────────────────────────────────────────────
-- 066_emergency_rls_lockdown.sql
--
-- PHASE 2 of 2 — DESTRUCTIVE. Apply ONLY after the new application code is live.
--
-- ORDER (see 064 for why):
--   1. 064  additive: creator_public view + narrow policies
--   2. 065  additive: tips schema
--   3. DEPLOY THE APPLICATION
--   4. 066  this file — removes the dangerous policies and grants
--
-- Running this BEFORE the deploy breaks every public creator page, explore,
-- search, the sitemap and recommendations, because the currently-deployed code
-- reads `creator_profiles` directly.
--
-- Every policy name below was read from production `pg_policies` on 2026-08-05
-- (audit/production-integrity/LIVE_VERIFICATION.md), not from this repository.
-- The two differ, and three repo-derived drops would have been silent no-ops:
--     repo `digital_purchases_service_insert`  ->  live `dpur_insert`
--     repo `digital_purchases_service_update`  ->  live `dpur_update`
--     repo `merch_orders_service_all`          ->  DOES NOT EXIST live
-- `merch_orders_service_all` is deliberately NOT dropped here.
--
-- WHAT THIS CLOSES
--   SL-011  creator_profiles fully readable by anon, incl. claim_code (7 live codes)
--   SL-001  creator_billing writable by anon  -> free platform access
--   SL-002  billing_credits mintable by anon
--   SL-003  digital_purchases insertable by anon -> paid-content paywall bypass
--   SL-013  eleven tables accepting forged paid records
--   SL-029  tips readable by anon
--   SL-067  live_streams exposing stream_key / rtmp_url to anon (partially)
--   SL-068  anon holding TRUNCATE on every table
--
-- WHY NO REPLACEMENT SERVICE-ROLE POLICIES: the service role bypasses RLS
-- entirely. Policies named `*_service_*` never did anything for it; they only
-- ever granted access to anon and authenticated.
--
-- Idempotent. Re-runnable. Fully reversible — see the rollback block at the foot,
-- which restores each policy to its exact pre-migration definition.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 — creator_profiles: remove the full-table public read
-- ═══════════════════════════════════════════════════════════════════════════
-- THE exposure: every column of every profile, readable with the browser key —
-- claim_code, date_of_birth, first_ip/last_ip, shipping_*, stripe_account_id.
-- `creator_profiles_own_select` (created in 064) keeps owner reads working.
drop policy if exists "Creators are publicly readable" on public.creator_profiles;

-- anon loses the table entirely and uses public.creator_public instead.
-- authenticated keeps DML for the owner-scoped policies that remain
-- ("Creators can update their own profile", "Users can insert their own profile").
revoke all on public.creator_profiles from anon;
revoke truncate, trigger, references on public.creator_profiles from authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 — remove anon/public WRITE policies (live names, verified 2026-08-05)
-- ═══════════════════════════════════════════════════════════════════════════

-- Entitlement and money-state. Anon could set status='active' on any creator.
drop policy if exists "creator_billing_service_all" on public.creator_billing;
drop policy if exists "billing_credits_service"     on public.billing_credits;

-- Paid-content paywall bypass: forge a purchase row with a chosen download token.
drop policy if exists "dpur_insert" on public.digital_purchases;
drop policy if exists "dpur_update" on public.digital_purchases;

-- Forgeable paid records.
drop policy if exists "merch_orders_insert"           on public.merch_orders;
drop policy if exists "post_unlocks_service_insert"   on public.post_unlocks;
drop policy if exists "super_tips_insert"             on public.super_tips;
drop policy if exists "early_access_insert"           on public.early_access_passes;
drop policy if exists "early_access_update"           on public.early_access_passes;
drop policy if exists "gift_sub_insert"               on public.gift_subscriptions;
drop policy if exists "gift_sub_update"               on public.gift_subscriptions;
drop policy if exists "wishlist_purchases_insert"     on public.wishlist_purchases;
drop policy if exists "Anyone can create order"       on public.marketplace_orders;
drop policy if exists "Anyone can create an order"    on public.social_addback_orders;

-- Referral forgery. `/api/referrals/creator` now runs authenticated + service role.
drop policy if exists "creator_referrals_insert"    on public.creator_referrals;
drop policy if exists "creator_referrals_update"    on public.creator_referrals;
drop policy if exists "subscriber_referrals_insert" on public.subscriber_referrals;
drop policy if exists "subscriber_referrals_update" on public.subscriber_referrals;

-- live_streams: `live_streams_creator_manage` (FOR ALL, USING = creator owns)
-- already covers creator inserts — for an ALL policy Postgres reuses USING as
-- the WITH CHECK — so dropping the permissive insert breaks nothing.
drop policy if exists "live_streams_insert" on public.live_streams;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 — remove anon/public READ policies over private data
-- ═══════════════════════════════════════════════════════════════════════════

-- Tips: fan_user_id, amount and message were readable by anyone.
-- "Creators can view tips they received" remains; `tips_fan_select` (064) covers
-- the fan side.
drop policy if exists "Tips publicly readable" on public.tips;

-- live_streams: `USING (true)` exposed stream_key and rtmp_url — the credentials
-- to broadcast as that creator. `live_streams_public_status` (064) replaces it.
drop policy if exists "live_streams_select" on public.live_streams;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 — reduce excessive grants (SL-068)
-- ═══════════════════════════════════════════════════════════════════════════
-- TRUNCATE is NOT subject to RLS. anon and authenticated held it on every table.
-- PostgREST never issues TRUNCATE so this was not reachable today, but the grant
-- surface should not be wider than the policy surface.
do $$
declare t text;
begin
  foreach t in array array[
    'creator_profiles','creator_billing','digital_purchases','merch_orders',
    'tips','subscriptions','subscription_payments','wishlist_purchases',
    'marketplace_orders','social_addback_orders','creator_referrals',
    'subscriber_referrals','billing_credits','referral_codes','referral_signups',
    'referral_rewards_claimed','post_unlocks','super_tips','early_access_passes',
    'gift_subscriptions','live_streams'
  ]
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK — restores production to its exact pre-066 state.
--
-- Each policy below is reproduced from the live pg_policies capture of
-- 2026-08-05. Running this re-opens every exposure this file closed; it exists
-- so a failed verification can be undone in seconds, not so it can be left in
-- place.
--
--   begin;
--   -- creator_profiles
--   create policy "Creators are publicly readable" on public.creator_profiles
--     for select using (true);
--   grant select, insert, update, delete, references, trigger, truncate
--     on public.creator_profiles to anon;
--   grant references, trigger, truncate on public.creator_profiles to authenticated;
--   -- write policies
--   create policy "creator_billing_service_all" on public.creator_billing
--     for all using (true) with check (true);
--   create policy "billing_credits_service" on public.billing_credits
--     for all using (true) with check (true);
--   create policy "dpur_insert" on public.digital_purchases for insert with check (true);
--   create policy "dpur_update" on public.digital_purchases for update using (true);
--   create policy "merch_orders_insert" on public.merch_orders for insert with check (true);
--   create policy "post_unlocks_service_insert" on public.post_unlocks for insert with check (true);
--   create policy "super_tips_insert" on public.super_tips for insert with check (true);
--   create policy "early_access_insert" on public.early_access_passes for insert with check (true);
--   create policy "early_access_update" on public.early_access_passes for update using (true);
--   create policy "gift_sub_insert" on public.gift_subscriptions for insert with check (true);
--   create policy "gift_sub_update" on public.gift_subscriptions for update using (true);
--   create policy "wishlist_purchases_insert" on public.wishlist_purchases for insert with check (true);
--   create policy "Anyone can create order" on public.marketplace_orders for insert with check (true);
--   create policy "Anyone can create an order" on public.social_addback_orders for insert with check (true);
--   create policy "creator_referrals_insert" on public.creator_referrals for insert with check (true);
--   create policy "creator_referrals_update" on public.creator_referrals for update using (true);
--   create policy "subscriber_referrals_insert" on public.subscriber_referrals for insert with check (true);
--   create policy "subscriber_referrals_update" on public.subscriber_referrals for update using (true);
--   create policy "live_streams_insert" on public.live_streams for insert with check (true);
--   -- read policies
--   create policy "Tips publicly readable" on public.tips for select using (true);
--   create policy "live_streams_select" on public.live_streams for select using (true);
--   -- grants
--   do $$ declare t text; begin
--     foreach t in array array[
--       'creator_profiles','creator_billing','digital_purchases','merch_orders',
--       'tips','subscriptions','subscription_payments','wishlist_purchases',
--       'marketplace_orders','social_addback_orders','creator_referrals',
--       'subscriber_referrals','billing_credits','referral_codes','referral_signups',
--       'referral_rewards_claimed','post_unlocks','super_tips','early_access_passes',
--       'gift_subscriptions','live_streams']
--     loop
--       execute format('grant truncate, trigger, references on public.%I to anon, authenticated', t);
--     end loop;
--   end $$;
--   commit;
--
-- Nothing in 066 is irreversible: it drops and grants only, and writes no data.
-- ─────────────────────────────────────────────────────────────────────────────
