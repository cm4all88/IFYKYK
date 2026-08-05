# Batch 0 — Deployment Runbook

**Nothing in this document has been executed.** No SQL was run, no migration applied, no deploy
triggered.

Read §0 and §1 before running anything.

---

## 0. ONE CHANGE WAS MADE WHILE WRITING THIS

Preparing the runbook surfaced a deployment-blocking inconsistency, so I invoked your exception
clause. This is the only change.

**The problem.** The original `064_emergency_rls_lockdown.sql` created the `creator_public` view
**and** dropped `"Creators are publicly readable"` in the same transaction. The code live in
production reads `creator_profiles` directly — `app/[creator]/CreatorWorld.tsx` (2 sites),
`explore`, `search`, `sitemap`, `recommendations`. From the moment that transaction committed
until the new code finished deploying, **every public creator page would have returned nothing**.
That window is the full CI cycle: typecheck, lint, tests, build, deploy.

**The fix.** Split into additive and destructive halves, so there is no window at all:

| File | Nature | When |
|---|---|---|
| `064_creator_public_projection.sql` | **additive only** — creates the view + the 5 narrow policies | before deploy |
| `065_tips_ledger_integrity.sql` | **additive** — tips schema | before deploy |
| *(deploy the application)* | | |
| `066_emergency_rls_lockdown.sql` | **destructive** — drops 22 policies, revokes grants | after deploy |

Every policy created in 064 is `PERMISSIVE`, so it ORs with the wide policies still in place.
064 therefore changes no behaviour — it only makes the new relations exist.

Files touched by the split: the old `064_emergency_rls_lockdown.sql` was replaced by the two
above; `lib/__tests__/creator-public.test.ts` and `_tools/policy-diff.js` were repointed to read
both. Re-validated: typecheck ✅, lint ✅, **227 tests pass**, build ✅, policy-diff **22/22
dropped, 5 created, 10/10 preserved**.

---

## 1. Irreversibility — direct answer

**064: fully reversible.** Creates a view and 5 policies. Writes no data, destroys nothing.
Rollback SQL is in the file footer.

**066: fully reversible.** Drops policies and revokes grants only. The file footer contains a
rollback that recreates every dropped policy at its exact pre-migration definition, taken from
the live `pg_policies` capture.

**065: contains ONE operation that becomes irreversible in practice.**

```sql
alter table public.tips alter column fan_user_id drop not null;   -- line 36
```

Reversing it (`set not null`) **fails if any row has a NULL `fan_user_id`** — i.e. as soon as the
first guest tip is recorded. Until then it is reversible.

Everything else in 065 is reversible with data loss confined to columns that did not previously
exist: `drop column currency`, `drop column stripe_event_id`, `drop index tips_stripe_session_id_key`,
`alter column ... drop default`.

`tips` currently holds **0 rows**, so at the moment of application 065 destroys nothing.

**No migration drops a table, drops a pre-existing column, truncates, or deletes rows.**
Mechanically verified: destructive-op count is 0 / 1 / 0 for 064 / 065 / 066, and the single hit
is the `drop not null` above.

The **claim rotation script is the only step that modifies existing data**, and it is not a
migration — see §7.

---

## 2. Pre-deployment backup checklist

Complete every line before §4.

- [ ] **Database backup taken and its restore verified.** Supabase Dashboard → Database → Backups.
      On a paid plan, take an on-demand backup; on Free, confirm PITR/daily coverage and note the
      timestamp. *Do not proceed on "there's probably a nightly".*
- [ ] **Policy inventory captured.** Re-run `audit/production-integrity/_tools/live-verify.sql`
      and save the output. This is your rollback source of truth; the one from 2026-08-05 is in
      `LIVE_VERIFICATION.md`.
- [ ] **Claim-code count recorded.** From that output: `unclaimed_with_code` (was 7). If it has
      changed, the rotation guard in §7 may abort — expected, and it means codes were issued or
      claimed since.
- [ ] **`tips` row count recorded.** Was 0. If non-zero, someone has already applied 065 or
      inserted manually — **stop and reconcile before continuing**.
- [ ] **Stripe tip search done.** Dashboard → Payments → `metadata.type = tip`. Record the count.
      This is the one Batch 0 question still open and it is easier to answer before the schema
      changes.
- [ ] **Current deploy SHA noted**, for `vercel rollback`.
- [ ] **A second person is available**, or you have a clear 60-minute window. Steps 6→7 should not
      be interrupted.
- [ ] **Anon key to hand** (public, from Supabase → Settings → API) for the verification queries.

---

## 3. How to run SQL — read this once

`supabase` CLI is **not installed** and the project is **not linked**, so `npm run db:push` will
fail. Every SQL step below goes through:

> **Supabase Dashboard → SQL Editor → New query → paste → Run**

The migration files each carry their own `begin; … commit;`. The SQL Editor autocommits a
successful statement batch, so:

- **A failure mid-file rolls the whole file back automatically** — that is what the explicit
  transaction is for. There is no half-applied state to clean up.
- **To inspect before committing**, replace the trailing `commit;` with `rollback;`, run, read the
  output, then re-run with `commit;`. This is spelled out for the rotation script in §7, where it
  matters most.

---

## 4. STEP 1 — Apply migration 064 (additive)

**File:** `supabase/migrations/064_creator_public_projection.sql`
**Safe to run while the current code is live.** Changes no behaviour.

Paste the whole file. Run.

**Expect:** `Success. No rows returned.`

**Verify — the view exists and returns approved fields:**

```sql
select id, handle, display_name, avatar_url, subscription_price
from public.creator_public
limit 3;
```

Expect up to 3 rows, or 0 rows on an empty database. Either is fine — the point is that the
relation resolves.

**Verify — the view does NOT carry forbidden columns:**

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'creator_public'
  and column_name in ('claim_code','claim_expires_at','claimed_at','date_of_birth',
                      'first_ip','last_ip','shipping_zip','stripe_account_id',
                      'ccbill_account_number','user_id');
```

**Expect: 0 rows.**

**STOP IF:** any row is returned — the view is leaking a forbidden column. Roll back 064 and do
not proceed.

**Commit or roll back:** commit. This file is additive and reversible.

**Rollback:**

```sql
begin;
drop policy if exists "creator_billing_own_update"  on public.creator_billing;
drop policy if exists "creator_billing_own_insert"  on public.creator_billing;
drop policy if exists "live_streams_public_status"  on public.live_streams;
drop policy if exists "tips_fan_select"             on public.tips;
drop policy if exists "creator_profiles_own_select" on public.creator_profiles;
revoke select on public.creator_public from anon, authenticated;
drop view if exists public.creator_public;
commit;
```

---

## 5. STEP 2 — Apply migration 065 (additive, tips schema)

**File:** `supabase/migrations/065_tips_ledger_integrity.sql`
**Safe to run while the current code is live.** The current code does not write the new columns,
and they are nullable or defaulted.

**Before running, confirm `tips` is still empty** — this is the last easy moment:

```sql
select count(*) as tips_rows from public.tips;
```

**STOP IF** this is not `0` and you did not expect it. A non-zero count means the schema story
has changed since the audit; reconcile before continuing.

Paste the whole file. Run.

**Expect:** `Success. No rows returned.`

**Verify:**

```sql
select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='tips' and column_name='currency')          as has_currency,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='tips' and column_name='stripe_event_id')   as has_event_id,
  (select is_nullable from information_schema.columns
     where table_schema='public' and table_name='tips' and column_name='fan_user_id')       as fan_nullable,
  (select count(*) from pg_indexes
     where schemaname='public' and indexname='tips_stripe_session_id_key')                  as has_unique_index;
```

**Expect:** `has_currency=1`, `has_event_id=1`, `fan_nullable=YES`, `has_unique_index=1`.

**STOP IF:** `has_unique_index=0` — idempotency is not in place and duplicate tips become
possible the moment the new webhook goes live. Do not deploy.

**Commit or roll back:** commit.

**Rollback** (safe only while `tips` has no NULL `fan_user_id` — see §1):

```sql
begin;
drop index if exists public.tips_stripe_session_id_key;
drop index if exists public.tips_stripe_event_id_idx;
drop index if exists public.tips_stripe_payment_intent_idx;
alter table public.tips drop column if exists stripe_event_id;
alter table public.tips drop constraint if exists tips_currency_check;
alter table public.tips drop column if exists currency;
alter table public.tips alter column creator_receives  drop default;
alter table public.tips alter column platform_receives drop default;
-- Fails if any guest tip has landed. That is intentional — do not force it.
alter table public.tips alter column fan_user_id set not null;
commit;
```

---

## 6. STEP 3 — Deploy the application

**Only after 064 and 065 are committed.** The new code reads `creator_public` and writes
`tips.currency` / `tips.stripe_event_id`; deploying first would break both.

Per `CLAUDE.md`, deployment is GitHub Actions on push to `main`:

```bash
cd /c/dev/spotlightly
git checkout -b batch-0-emergency-lockdown
git add -A
git status                     # confirm: 42 modified, 14 new, no stray files
git commit -m "Batch 0: close creator profile exposure, repair the tip ledger, gate unauthenticated routes"
git push -u origin batch-0-emergency-lockdown
```

Open a PR and let CI run (`typecheck` → `lint` → `npm test` → preview deploy). All four pass
locally. **Merge to `main` only when the preview is green**; the push to `main` triggers the
production deploy.

**Verify after the production deploy completes:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.spotlightly.app/            # 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.spotlightly.app/explore     # 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.spotlightly.app/api/download/x   # 410
```

Then open one real creator page and confirm avatar, bio, tiers and posts render.

**STOP IF:** any public creator page is blank or 500. The `creator_public` read is failing — do
not proceed to 066, which would make it permanent.

**Rollback:** `vercel rollback <previous-deployment-url>`, or revert the merge commit and push.
064 and 065 are additive, so the previous code still works against the new schema — **rolling the
app back does not require rolling back the migrations.**

---

## 7. STEP 4 — Apply migration 066 (destructive)

**File:** `supabase/migrations/066_emergency_rls_lockdown.sql`
**Only after §6 is verified.** This is the step that closes the exposure.

Paste the whole file. Run.

**Expect:** `Success. No rows returned.`

### 7a. Verify `creator_profiles` is no longer publicly readable

Run against the **REST API with the ANON key** — not the SQL Editor, which runs as a superuser
and will always see rows:

```bash
export SB_URL="https://<project-ref>.supabase.co"
export SB_ANON="<anon key>"

# Expect: []
curl -s "$SB_URL/rest/v1/creator_profiles?select=handle&limit=1" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"

# Expect: []  — the account-takeover credential
curl -s "$SB_URL/rest/v1/creator_profiles?select=handle,claim_code&claim_code=not.is.null&limit=5" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"

# Expect: []  — fan tipping history
curl -s "$SB_URL/rest/v1/tips?select=amount,fan_user_id&limit=1" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"
```

**STOP IF:** any of these returns a row. The policy drop did not take effect; roll back 066 and
investigate before leaving production in a half-locked state.

Catalog cross-check (SQL Editor):

```sql
select count(*) as should_be_zero
from pg_policies
where schemaname = 'public'
  and permissive = 'PERMISSIVE'
  and (roles::text like '%public%' or roles::text like '%anon%')
  and (qual = 'true' or with_check = 'true')
  and tablename in (
    'creator_profiles','creator_billing','billing_credits','digital_purchases',
    'merch_orders','post_unlocks','super_tips','early_access_passes',
    'gift_subscriptions','live_streams','creator_referrals','subscriber_referrals',
    'wishlist_purchases','marketplace_orders','social_addback_orders','tips');
```

**Expect `0`.** Anything else means a policy survived — compare against
`_tools/policy-diff.md` to find which.

### 7b. Verify `creator_public` still returns approved public fields

```bash
# Expect: a JSON array (rows, or [] on an empty DB) — NOT an error object
curl -s "$SB_URL/rest/v1/creator_public?select=handle,display_name,avatar_url&limit=3" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"

# Expect: {"code":"42703",...} — column does not exist on the view
curl -s "$SB_URL/rest/v1/creator_public?select=claim_code&limit=1" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"
```

**STOP IF:** the first returns a permission error — anon has lost the view too, and every public
page is down. Roll back 066 immediately.

Then re-check the live site: `/`, `/explore`, one creator page. All must still render.

**Commit or roll back:** commit, but only once 7a and 7b both pass. If either fails, run the
rollback block from the footer of `066_emergency_rls_lockdown.sql` — it restores every dropped
policy to its exact pre-migration definition and re-grants the revoked privileges.

---

## 8. STEP 5 — Rotate the exposed claim codes

**File:** `supabase/ops/2026-08-05_rotate_exposed_claim_codes.sql`
**This is the only step that modifies existing data.** It is not a migration and
`supabase db push` will never run it.

**Order matters: 066 must be committed first.** Rotating while the table is still publicly
readable would publish nothing useful — the codes are being nulled, not replaced — but the
verification in §8b is only meaningful once the read is closed.

### 8a. Dry run first

Open the file, change the final `commit;` to `rollback;`, and run it. This executes the
pre-flight, the guard and the UPDATE, shows you STEP 4's counts, then discards everything.

**Expect from STEP 1:**

| Column | Expected |
|---|---|
| `unclaimed_with_code` | ~7 |
| `claimed_with_code_anomaly` | **0** |
| `already_claimed_clean` | informational |

**STOP IF `claimed_with_code_anomaly` > 0.** `/api/claim` nulls the code in the same statement
that sets `claimed_at`, so a row with both is impossible. Something wrote a code back onto a
claimed profile. Investigate before rotating — the script will raise and abort anyway.

**STOP IF the script raises** `ABORT: N unclaimed codes found, expected roughly 7` — you are
connected to the wrong database, or something issued codes in bulk.

**Expect from STEP 4 (dry run):** `remaining_live_codes = 0`.

### 8b. Real run

Restore `commit;` and run again.

**Confirm `remaining_live_codes = 0`:**

```sql
select
  count(*) filter (where claim_code is not null and claimed_at is null) as remaining_live_codes,
  count(*) filter (where claimed_at is null)                           as profiles_awaiting_reissue
from public.creator_profiles;
```

**`remaining_live_codes` MUST be `0`.** If it is not, `rollback;` and investigate — do not commit
a partial rotation.

`profiles_awaiting_reissue` is how many creators now need a fresh link from `/admin/creators`.

**Verify an old code no longer works** — only with a code you already hold from before rotation:

```bash
curl -s -X POST https://www.spotlightly.app/api/claim \
  -H "Content-Type: application/json" \
  -d '{"code":"<an old code>","email":"you+test@example.com","password":"correcthorsebattery"}'
```

**Expect:** `{"error":"This link is not valid."}` — the `not_found` branch.
**STOP IF** it returns `{"ok":true}`. The rotation did not take effect and an exposed code is
still live.

**Commit or roll back:** commit only after `remaining_live_codes = 0` in the same transaction.

**Rollback:** none, by design. The old codes are compromised; restoring them would be wrong.
If you rotate prematurely, the recovery is to **re-issue** from `/admin/creators` — the codes were
already worthless. Re-issuing is a human action and **sends nothing automatically**
(`CLAIM_CODE_REMEDIATION.md` §Delivery).

---

## 9. STEP 6 — RLS integration tests

Anonymous pass — needs only the public anon key:

```bash
cd /c/dev/spotlightly
SUPABASE_URL="$SB_URL" \
SUPABASE_ANON_KEY="$SB_ANON" \
APP_URL="https://www.spotlightly.app" \
  npx vitest run lib/__tests__/rls-integration.test.ts
```

Authenticated pass — add a **throwaway fan account** (not a creator, not the admin):

```bash
SUPABASE_URL="$SB_URL" \
SUPABASE_ANON_KEY="$SB_ANON" \
APP_URL="https://www.spotlightly.app" \
TEST_EMAIL="fan+batch0@example.com" \
TEST_PASSWORD="<that account's password>" \
  npx vitest run lib/__tests__/rls-integration.test.ts
```

**Expect:** 26 tests pass (17 anon + 9 authenticated). None skipped.

**Never supply the service role key** — it bypasses RLS and every assertion would pass
meaninglessly. The script guards against a key that looks like one, but do not rely on that.

**Safety:** every write probe uses a nil uuid that satisfies no foreign key. Postgres evaluates
the RLS policy before constraints, so `42501` means denied and `23xxx` means the policy allowed
it — and **no probe can commit a row**.

**STOP IF:** any write probe reports VULNERABLE. A policy survived 066; check `_tools/policy-diff.md`
and consider rolling 066 back until it is understood.

---

## 10. STEP 7 — Stripe tip reconciliation (read only)

```bash
cd /c/dev/spotlightly
STRIPE_SECRET_KEY="rk_live_..."                       # a RESTRICTED read-only key is preferred
NEXT_PUBLIC_SUPABASE_URL="$SB_URL" \
SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
  node audit/production-integrity/_tools/tip-reconciliation.mjs
```

Narrow a large history with `--since=2025-01-01`; add `--json` for machine output.

**It never writes.** No refunds, no transfer reversals, no metadata edits, no ledger rows. Only
`GET /v1/checkout/sessions`, `GET /v1/refunds`, and one read of `tips`.

**Two outcomes:**

- **`missingFromTips: 0`** — tipping was never used. Nothing further to do. The repair means the
  first real tip records correctly.
- **`missingFromTips > 0`** — money was taken from fans and transferred to creators with no record
  on the platform. **Stop.** The creators *were* paid (Stripe's destination charge moved the money
  at payment time, independent of the webhook), so this is a records problem, not an unpaid-money
  problem — say that plainly to anyone who asks. Then read the backfill plan in
  `TIP_RECONCILIATION.md` and **get approval before running anything**.

**Do not run a backfill from this runbook.** No backfill script exists yet, deliberately — it
should be shaped by what reconciliation actually finds.

---

## 11. Rollback summary

| Step | Rollback | Cost |
|---|---|---|
| 064 | Footer of `064_creator_public_projection.sql` | None. Nothing written. |
| 065 | Footer of §5 above | None **while `tips` has no NULL `fan_user_id`**. After the first guest tip, `set not null` fails — see §1. |
| Deploy | `vercel rollback <sha>` or revert the merge | None. 064/065 are additive, so old code runs fine against the new schema. |
| 066 | Footer of `066_emergency_rls_lockdown.sql` | Re-opens every exposure. Use only to restore service, never as a resting state. |
| Claim rotation | None by design | Re-issue from `/admin/creators`. The old codes were compromised anyway. |
| Tip reconciliation | N/A | Read only. |

**The one-way door:** `alter column fan_user_id drop not null` in 065, once a guest tip lands.
Everything else can be undone.

---

## 12. Post-deployment

- [ ] `remaining_live_codes = 0`
- [ ] 26 RLS integration tests pass (anon + authenticated)
- [ ] Public creator page, `/explore`, `/` all render
- [ ] `/api/download/<anything>` returns **410**
- [ ] A test tip records a row in `tips` with `creator_receives`, `platform_receives`, `currency`
      and `stripe_session_id` populated
- [ ] Stripe webhook deliveries show 200s (Dashboard → Developers → Webhooks)
- [ ] Reconciliation run and its output filed
- [ ] Claim links re-issued to prospects still being pursued
- [ ] `LIVE_VERIFICATION.md` updated with the post-deploy policy capture

**Known still-exposed after all of this** (unchanged, all out of Batch 0 scope):
`stream_key`/`rtmp_url` for currently-live streams (SL-067) · per-instance-only rate limit on
`/api/advisor/signup` · no refund or dispute handling (SL-008) · webhook does not check
`payment_status === 'paid'` (SL-032) · Next.js cache-poisoning CVE (SL-030).
