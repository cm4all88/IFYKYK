-- ─────────────────────────────────────────────────────────────────────────────
-- 068a_fraud_review_four_accounts.sql   (run AFTER 068, by hand, in two steps)
--
-- Places the four accounts from the September 2026 incident under review.
-- PRESERVES EVERYTHING: no profile, tip, Stripe id, timestamp or IP value is
-- modified or deleted. Only creator_trust rows are inserted / updated, and each
-- action is recorded in creator_trust_events.
--
-- This does NOT call Stripe. Holding their payouts on Stripe is a separate,
-- approved step (admin trust page "Hold payouts", or the dashboard).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1. LOOK. Confirm these are exactly the four, and nobody else. ─────
select cp.id, cp.handle, cp.display_name, cp.created_at, cp.published,
       cp.first_ip, cp.first_country, cp.last_ip, cp.stripe_account_id,
       (select count(*) from public.posts p where p.creator_profile_id = cp.id) as post_count,
       (select count(*) from public.tips t where t.creator_profile_id = cp.id) as tip_rows,
       (select coalesce(sum(t.amount),0) from public.tips t where t.creator_profile_id = cp.id) as tip_total
  from public.creator_profiles cp
 where cp.display_name in ('Angelina','HOLLYHOLLY','MICHAEL','ERNEST')
    or cp.first_ip like '103.135.100.%'
    or cp.last_ip  like '103.135.100.%'
 order by cp.created_at;

-- ── STEP 2. MARK. Paste the four ids from step 1 into the array. ───────────
-- begin;
-- with target as (
--   select unnest(array[
--     '00000000-0000-0000-0000-000000000000'::uuid  -- Angelina
--    ,'00000000-0000-0000-0000-000000000000'::uuid  -- HOLLYHOLLY
--    ,'00000000-0000-0000-0000-000000000000'::uuid  -- MICHAEL
--    ,'00000000-0000-0000-0000-000000000000'::uuid  -- ERNEST
--   ]) as id
-- ), upserted as (
--   insert into public.creator_trust (creator_profile_id, tips_disabled, monetization_status, review_reason, review_started_at, updated_at)
--   select id, true, 'under_review', 'Sept 2026 incident: zero posts, fast onboarding, repeated $9 tips, Stripe elevated risk', now(), now()
--     from target
--   on conflict (creator_profile_id) do update
--     set tips_disabled = true, monetization_status = 'under_review',
--         review_reason = excluded.review_reason, review_started_at = now(), updated_at = now()
--   returning creator_profile_id
-- )
-- insert into public.creator_trust_events (creator_profile_id, kind, actor, reason, detail)
-- select creator_profile_id, 'place_under_review', 'admin:sql', 'Sept 2026 incident, evidence preserved',
--        jsonb_build_object('source','068a_fraud_review_four_accounts.sql')
--   from upserted;
-- commit;
