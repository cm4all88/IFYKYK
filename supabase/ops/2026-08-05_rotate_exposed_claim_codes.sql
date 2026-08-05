-- ═════════════════════════════════════════════════════════════════════════════
-- CONTROLLED DATA REMEDIATION — rotate exposed claim codes
--
-- THIS IS NOT A SCHEMA MIGRATION. It lives in supabase/ops/ deliberately so
-- `supabase db push` never runs it. It changes DATA, once, under supervision.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
-- Until migration 064, `creator_profiles` carried
--     "Creators are publicly readable"  FOR SELECT TO public USING (true)
-- and `anon` held SELECT on the table. `claim_code` is a bearer credential:
-- whoever holds one can set the email and password on that creator's account
-- through /api/claim. The anon key ships in the browser bundle, so a single
-- PostgREST request returned every live code.
--
-- Verification on 2026-08-05 found 7 profiles holding a live, unclaimed code.
-- Every one must be treated as compromised. Age of the exposure is unknown.
--
-- ── ORDER OF OPERATIONS ──────────────────────────────────────────────────────
-- Run migration 064 FIRST. Rotating codes while the table is still publicly
-- readable would publish the new codes too.
--
-- ── DESIGN ───────────────────────────────────────────────────────────────────
-- Codes are NULLED, not regenerated. Reasons:
--   1. `/api/claim` treats a null code as "not found", so every exposed code
--      stops working the instant this runs. No window, no overlap.
--   2. Generating a replacement here would write it into query results, the SQL
--      Editor history, and any logging in front of the database — reintroducing
--      exactly the disclosure being remediated.
--   3. The admin console already has a first-class re-issue flow
--      (app/admin/creators/page.tsx -> "Generate claim link", which calls
--      generateClaimCode() from lib/claim.ts and sets claim_expires_at). Codes
--      re-issued that way are shown once to the admin and never selected by
--      anon. That is the correct delivery path, and it stays a human decision.
--
-- ── SAFETY ───────────────────────────────────────────────────────────────────
--   • Touches ONLY rows with `claimed_at is null`. A creator who has already
--     claimed their page keeps working — their code was consumed and set to
--     null by /api/claim at claim time, so they are not in scope at all.
--   • Idempotent: the WHERE clause matches nothing on a second run.
--   • Guarded: aborts if the count is wildly different from what was verified,
--     which would mean the database is not the one that was audited.
--   • Prints COUNTS ONLY. No code value is ever selected or returned.
--
-- ── WHAT THIS DOES NOT DO ────────────────────────────────────────────────────
-- It sends nothing. Notifying affected creators is a separate, approved action;
-- see audit/production-integrity/CLAIM_CODE_REMEDIATION.md.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ── STEP 1 — pre-flight, read only. Counts only, never values. ───────────────
select
  count(*) filter (where claim_code is not null and claimed_at is null) as unclaimed_with_code,
  count(*) filter (where claim_code is not null and claimed_at is not null) as claimed_with_code_anomaly,
  count(*) filter (where claim_code is null and claimed_at is not null) as already_claimed_clean
from public.creator_profiles;

-- `claimed_with_code_anomaly` should be 0. /api/claim nulls the code in the same
-- statement that sets claimed_at. A non-zero value means something wrote a code
-- back onto a claimed profile — investigate BEFORE continuing, and do not
-- assume this script is safe to run.

-- ── STEP 2 — guard. Abort if this is not the audited database. ───────────────
do $$
declare
  v_unclaimed integer;
  v_anomaly   integer;
begin
  select
    count(*) filter (where claim_code is not null and claimed_at is null),
    count(*) filter (where claim_code is not null and claimed_at is not null)
    into v_unclaimed, v_anomaly
  from public.creator_profiles;

  if v_anomaly > 0 then
    raise exception
      'ABORT: % profile(s) have a claim_code AND claimed_at set. That should be impossible. Investigate before rotating.',
      v_anomaly;
  end if;

  -- Verified count was 7 on 2026-08-05. Allow drift for codes legitimately
  -- issued or claimed since, but refuse to run against an unexpected database.
  if v_unclaimed > 50 then
    raise exception
      'ABORT: % unclaimed codes found, expected roughly 7. Wrong database, or something has issued codes in bulk.',
      v_unclaimed;
  end if;

  if v_unclaimed = 0 then
    raise notice 'Nothing to do: no unclaimed claim codes remain. (Already rotated? This script is idempotent.)';
  else
    raise notice 'Rotating % exposed unclaimed claim code(s).', v_unclaimed;
  end if;
end $$;

-- ── STEP 3 — invalidate. Only unclaimed rows. ────────────────────────────────
-- claim_expires_at is cleared alongside so no stale expiry lingers on a profile
-- with no code. claimed_at is deliberately NOT touched: these pages remain
-- unclaimed and re-issuable.
update public.creator_profiles
   set claim_code = null,
       claim_expires_at = null,
       updated_at = now()
 where claim_code is not null
   and claimed_at is null;

-- ── STEP 4 — verify. Must be 0. Counts only. ─────────────────────────────────
select
  count(*) filter (where claim_code is not null and claimed_at is null) as remaining_live_codes,
  count(*) filter (where claimed_at is null) as profiles_now_awaiting_reissue
from public.creator_profiles;

-- `remaining_live_codes` MUST be 0. If it is not, roll back and investigate.
-- `profiles_now_awaiting_reissue` is how many creators need a fresh link from
-- /admin/creators before they can claim their page.

-- ── STEP 5 — commit ──────────────────────────────────────────────────────────
-- Review the STEP 4 output BEFORE committing. To abandon: ROLLBACK;
commit;
