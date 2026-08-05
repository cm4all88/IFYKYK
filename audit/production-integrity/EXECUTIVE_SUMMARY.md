# Executive Summary — Production Integrity Audit

**Repository:** spotlightly · **Branch:** main · **Commit:** 45f9916 · **Date:** 2026-08-05

**63 findings: 14 critical, 21 high, 19 medium, 9 low.**
55 are confirmed against committed SQL. 5 need one database query to confirm or clear. 3 depend on runtime configuration.

---

## The short version

The patterns you found in earnings and referrals are not isolated. They repeat across the
whole application, and in several places they are worse. Three things stand out.

**1. Row Level Security is effectively off for money.**
Twenty RLS policies grant write access to the *anonymous* key — the one published in every
browser bundle. They were written as `for all using (true)` with the intent of letting the
service role through, but Postgres reads a missing `TO` clause as `TO PUBLIC`. Because every
policy in this repository is permissive (none is `AS RESTRICTIVE`), and permissive policies are
OR'ed together, each of these overrides the correct owner-scoped policy sitting next to it.

The practical result: anyone can set their own billing to `active` and use the platform for
free, mint themselves referral credit, fabricate a digital-product purchase and download any
paid file, unlock any paid post, and read every merch buyer's home address. No exploit is
needed — these are ordinary PostgREST calls with the public key.

**2. Money is recorded on a best-effort basis.**
The Stripe webhook never checks whether its writes succeeded, then returns `200`. Stripe takes
that as "processed" and never retries. So every schema mismatch inside the webhook becomes
permanent, silent data loss — the fan is charged and no record exists. At least two such
mismatches are live right now: the fan-subscription upsert writes a column that does not exist,
and the wishlist purchase insert writes a status its own CHECK constraint forbids.

Separately, the webhook has no replay protection (the Stripe timestamp is fed into the HMAC but
never checked for freshness) and most handlers are not idempotent. A captured webhook request
stays valid forever and can be replayed to mint unlimited tips, donations and medals.

And there is no refund handling of any kind. `lib/earnings.ts` marks tips, super tips, digital
purchases, donations and live tips as settled unconditionally. Refunded and charged-back money
is counted as creator earnings permanently.

**3. Broken features report success.**
`lib/earnings.ts` was clearly written in response to the earlier audit and it is good work — it
flags failed sources instead of returning zero. But it is the *only* consumer of that
discipline. The creator dashboard uses it; nothing else does. The analytics pane still queries
`tips.amount_usd`, a column that does not exist, so every creator's revenue chart reads $0
forever. The admin dashboard's "monthly revenue" sums `tips.platform_receives` — but the
platform takes 0% of tips, so that number is structurally zero and excludes every real revenue
stream. `/api/fan/me` has five broken queries out of six, so a paying fan sees zero
subscriptions, zero tips, zero purchases and $0.00 spent, behind an HTTP 200.

---

## What is dangerous right now

| # | Issue | Why it matters |
|---|---|---|
| 1 | `creator_billing` writable by anon (SL-001) | Free use of every paid feature; all entitlement gating bypassed |
| 2 | `digital_purchases` insertable by anon (SL-003) | Every paid digital product downloadable free |
| 3 | `/api/referrals/creator` unauthenticated (SL-005) | Five unauthenticated POSTs mint $29 of credit, repeatable |
| 4 | `/api/download/[token]` guards all disabled (SL-004) | Unauthenticated, unlimited, never-expiring downloads |
| 5 | `merch_orders` readable by anon (SL-012) | Every buyer's physical address exposed |
| 6 | Webhook replay + non-idempotency (SL-006, SL-007) | Duplicate money rows, duplicate physical merch orders |
| 7 | Subscription upsert writes a missing column (SL-009) | Fan pays, gets nothing, no record, no retry |
| 8 | No refund handling (SL-008) | Clawed-back money counted as earnings forever |

## What is broken but not dangerous

Cancellation does not persist (the status value violates a CHECK constraint, so the row stays
`active` while the fan is told it worked). Digital products and channels cannot be created at
all — both writes name columns that do not exist. Referral credits are issued, displayed, and
never applied to a bill. Four revenue streams — post unlocks, gift subscriptions, Front Row
Messages, comment boosts — are invisible to every earnings figure and every payout.

## What is actually solid

Worth saying, because it shows the pattern is fixable rather than endemic:

- `lib/earnings.ts` is the right model — one definition, explicit failure reporting.
- `migration 063_subscription_payments.sql` is the right model for schema — proper RLS,
  a unique invoice id for idempotency, and deliberately *no* insert policy.
- `/api/claim` is genuinely well-hardened; the atomic single-use claim closes a real
  account-takeover race, and the reasoning is documented in the code.
- The referral RPCs in `034_referral_rewards.sql` have every control the REST referral routes
  lack: unique attribution, a self-referral check, idempotent reward rungs.
- Cron routes are properly gated. Lint passes. The production build passes. All 160 unit
  tests pass.

## The structural cause

`creator_profiles` — the central table of the product — has **no `CREATE TABLE` anywhere in
version control**. It exists only in the live database. Legacy tables were renamed
(`creators` → `creator_profiles`, `creator_id` → `creator_profile_id`) out of band, and those
renames were never committed. So `supabase db reset` cannot reproduce production, there is no
environment to integration-test against, and every column reference in this audit had to be
adjudicated by hand against three disagreeing sources.

That is why the same class of bug keeps recurring: there is no mechanism that could catch it.

## Where to start

Do the RLS policies first. They are a handful of `drop policy` statements, they need no
application changes, and they close five of the fourteen criticals in one migration. Then the
unauthenticated referral route, then webhook idempotency and replay. Full ordering in
`REMEDIATION_PLAN.md`.

**Before any of it, run the five verification queries in `SCHEMA_REFERENCE_AUDIT.md`.** They
resolve the five findings that depend on out-of-band drift, and they will tell you whether tips
are being recorded at all — which is the single most important unknown in this report.
