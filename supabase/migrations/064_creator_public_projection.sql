-- ─────────────────────────────────────────────────────────────────────────────
-- 064_creator_public_projection.sql
--
-- PHASE 1 of 2 — ADDITIVE ONLY. Safe to apply while the CURRENT code is live.
--
-- This file adds the public projection and the narrow replacement policies.
-- It removes NOTHING. The dangerous policies are dropped by 066, which must run
-- only AFTER the new application code is deployed.
--
-- WHY SPLIT
-- The originally-drafted 064 created the view and dropped
-- "Creators are publicly readable" in the same transaction. The code live in
-- production reads `creator_profiles` directly (app/[creator]/CreatorWorld.tsx,
-- explore, search, sitemap, recommendations). Committing both together would
-- have broken every public creator page from the moment of COMMIT until the new
-- code finished deploying — a guaranteed outage window spanning the whole CI
-- run. Splitting removes the window entirely:
--
--   1. apply 064   (additive — old code unaffected, new relations now exist)
--   2. apply 065   (additive — tips schema)
--   3. deploy code (reads creator_public, writes the new tip columns)
--   4. apply 066   (destructive — old code is gone by now)
--
-- Every policy created here is PERMISSIVE and therefore ORs with the existing
-- permissive policies. Adding them cannot reduce anyone's access, so this file
-- is a no-op for behaviour until 066 removes the wide ones.
--
-- Idempotent. Re-runnable. Reversible — see the rollback block at the foot.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 — the public projection
-- ═══════════════════════════════════════════════════════════════════════════
-- Column list mirrors PUBLIC_CREATOR_COLUMNS in lib/creator-public.ts; the test
-- suite asserts the two agree in both directions.
--
-- The view is owned by the migration role and is NOT security_invoker, so it
-- reads the base table with the owner's rights. That is the point: a curated
-- projection that keeps working after 066 removes anon's access to the table.
-- Row filtering is baked in — soft-deleted profiles are never visible.
create or replace view public.creator_public as
  select
    id,
    handle,
    display_name,
    bio,
    avatar_url,
    cover_url,
    bg_url,
    location,
    location_city,
    location_country,
    niche,
    tags,
    kind,
    creator_type,
    subscription_price,
    published,
    is_active,
    founded,
    veriff_verified,
    stripe_onboarded,
    linked,
    offers_services,
    booking_url,
    booking_label,
    wishlist_url,
    social_links,
    free_tier_name,
    free_tier_blurb,
    free_tier_perks,
    first_month_offer_pct,
    medal_count_total,
    medal_points_total,
    onboarding_completed_at,
    created_at,
    updated_at
  from public.creator_profiles
  where deleted_at is null;

comment on view public.creator_public is
  'Public projection of creator_profiles. Excludes claim_code, claim state, date_of_birth, IP/user-agent tracking, shipping address, Stripe/CCBill identifiers and user_id. Anonymous reads go here; after migration 066 the base table is not readable by anon. See lib/creator-public.ts.';

grant select on public.creator_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 — narrow replacement policies (additive; the wide ones still exist)
-- ═══════════════════════════════════════════════════════════════════════════

-- A creator reads their own full row (settings, billing, onboarding). Until 066
-- drops "Creators are publicly readable", this is redundant but harmless.
drop policy if exists "creator_profiles_own_select" on public.creator_profiles;
create policy "creator_profiles_own_select" on public.creator_profiles
  for select to authenticated
  using (user_id = auth.uid());

-- A fan reads the tips they sent. "Creators can view tips they received" already
-- covers the other side.
drop policy if exists "tips_fan_select" on public.tips;
create policy "tips_fan_select" on public.tips
  for select to authenticated
  using (fan_user_id = auth.uid());

-- Public visibility of live streams, narrowed to streams actually live.
--
-- NOTE: narrowing rows does not hide columns. `stream_key` and `rtmp_url` remain
-- selectable for a live stream. A column-restricted view is the real fix
-- (SL-067); this reduces the exposure from every stream ever created to those
-- live right now.
drop policy if exists "live_streams_public_status" on public.live_streams;
create policy "live_streams_public_status" on public.live_streams
  for select to anon, authenticated
  using (status = 'live');

-- /api/billing upserts the caller's OWN billing row through the cookie client.
-- Ownership enforced in both directions. There is deliberately no policy letting
-- a user write someone else's row; the Stripe webhook (service role) remains the
-- authority that sets status and tier.
drop policy if exists "creator_billing_own_insert" on public.creator_billing;
create policy "creator_billing_own_insert" on public.creator_billing
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "creator_billing_own_update" on public.creator_billing;
create policy "creator_billing_own_update" on public.creator_billing
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (paste and run to undo this file completely)
--
--   begin;
--   drop policy if exists "creator_billing_own_update" on public.creator_billing;
--   drop policy if exists "creator_billing_own_insert" on public.creator_billing;
--   drop policy if exists "live_streams_public_status" on public.live_streams;
--   drop policy if exists "tips_fan_select"            on public.tips;
--   drop policy if exists "creator_profiles_own_select" on public.creator_profiles;
--   revoke select on public.creator_public from anon, authenticated;
--   drop view if exists public.creator_public;
--   commit;
--
-- Nothing here is irreversible: no data is written, read or destroyed.
-- ─────────────────────────────────────────────────────────────────────────────
