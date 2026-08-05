# Remediation Plan

Ordered by risk, not by effort. Each batch is independently shippable.

---

## Batch 0 — Verify before fixing (30 minutes, read-only)

Five findings depend on out-of-band database drift. Run the queries in
`SCHEMA_REFERENCE_AUDIT.md` first — they may promote or clear these, and they change what
Batch 1 needs to contain.

```sql
-- 1. tips columns             → resolves SL-024, SL-025
-- 2. subscriptions columns    → resolves SL-009
-- 3. subscriptions uniques    → resolves the upsert conflict-target question
-- 4. RLS on 9 tables          → resolves SL-011, SL-056
-- 5. permissive policies      → resolves SL-001/002/003/012/013/029
```

**Query 5 is the one that matters most.** If `roles` reads `{public}`, Batch 1 is a production
incident, not a scheduled fix.

**Also run, to size the damage:**

```sql
-- Have any tips actually been recorded? If this is 0 and Stripe shows tip charges,
-- SL-024/SL-025 are live and money has been taken with no record.
select count(*), min(created_at), max(created_at) from public.tips;

-- Fan subscriptions that should exist. Compare against Stripe's subscription count.
select status, count(*) from public.subscriptions group by status;

-- Wishlist purchases: expected to be 0 rows if SL-010 has been live.
select count(*) from public.wishlist_purchases;

-- Fabricated purchases (SL-003): rows with no Stripe session are forged.
select count(*) from public.digital_purchases where stripe_session_id is null;

-- Forged referral credit (SL-005 / SL-002).
select creator_profile_id, count(*), sum(amount_usd) from public.billing_credits group by 1;
```

---

## Batch 1 — Immediate production blockers

These are exploitable now, with the public anon key, by anyone who reads the browser bundle.

### 1.1 One migration closes five criticals

A single migration dropping the mis-scoped policies. No application changes — the service role
bypasses RLS and never needed these policies to exist.

```sql
-- SL-001, SL-002, SL-003, SL-012, SL-013
drop policy if exists "creator_billing_service_all"          on public.creator_billing;
drop policy if exists "billing_credits_service"              on public.billing_credits;
drop policy if exists "merch_orders_service_all"             on public.merch_orders;
drop policy if exists "digital_purchases_service_insert"     on public.digital_purchases;
drop policy if exists "digital_purchases_service_update"     on public.digital_purchases;
drop policy if exists "post_unlocks_service_insert"          on public.post_unlocks;
drop policy if exists "super_tips_insert"                    on public.super_tips;
drop policy if exists "early_access_insert"                  on public.early_access_passes;
drop policy if exists "early_access_update"                  on public.early_access_passes;
drop policy if exists "gift_sub_insert"                      on public.gift_subscriptions;
drop policy if exists "gift_sub_update"                      on public.gift_subscriptions;
drop policy if exists "live_streams_insert"                  on public.live_streams;
drop policy if exists "creator_referrals_insert"             on public.creator_referrals;
drop policy if exists "creator_referrals_update"             on public.creator_referrals;
drop policy if exists "subscriber_referrals_insert"          on public.subscriber_referrals;
drop policy if exists "subscriber_referrals_update"          on public.subscriber_referrals;
drop policy if exists "social_addback_purchases_insert"      on public.social_addback_purchases;
drop policy if exists "social_addback_purchases_update"      on public.social_addback_purchases;
drop policy if exists "Anyone can create an order"           on public.social_addback_orders;
drop policy if exists "Anyone can create order"              on public.marketplace_orders;

-- SL-029: tips are not public information
drop policy if exists "Tips publicly readable" on public.tips;
create policy "tips_own" on public.tips for select using (
  fan_user_id = auth.uid()
  or creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
);
```

> **Check first.** `live_streams_insert` and the marketplace/add-back order inserts may be relied
> on by an anon-client write path. Grep for client-side inserts to those tables before dropping;
> if one exists, move the write behind a route rather than keeping the policy.

### 1.2 Enable RLS on `creator_profiles` (SL-011)

Only if Batch 0 query 4 shows it disabled. `claim_code` must never be readable by a public-select
policy — that is a direct account-takeover path.

### 1.3 Authenticate `/api/referrals/creator` (SL-005)

Require a session, derive the referrer from it, add
`unique (referrer_profile_id, referred_user_id)`, and reject a null `referredUserId`. Then
reconcile existing `billing_credits` against real signups before anything applies them.

### 1.4 Delete `/api/download/[token]` (SL-004)

It duplicates `/api/digital/download` with all three guards silently disabled. Deleting it is
strictly safer than repairing it. Check for inbound links in previously sent emails first.

### 1.5 Stripe webhook replay window (SL-006)

```ts
const ts = Number(t) * 1000;
if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 300_000) return false;
```

Or switch to `verifyWebhook()` from `lib/stripe.ts`, which already wraps the official SDK.

### 1.6 Authenticate the seven AI routes (SL-064)

`/api/advisor/bio`, `/api/advisor/signup`, `/api/campaigns/assist`, `/api/tiers/assist`,
`/api/posts/tags`, `/api/onboarding`, `/api/studio/build`. Unmetered Anthropic spend, remotely
triggerable.

### 1.7 Upgrade Next.js (SL-030)

`next@14.2.35` — critical cache-poisoning advisory. Also `sharp@0.35.x`.

---

## Batch 2 — Before recruiting creators

Everything here is a promise the product currently cannot keep.

| # | Fix | Finding |
|---|---|---|
| 2.1 | Remove `updated_at` from both `subscriptions` upserts, or add the column | SL-009 |
| 2.2 | Insert wishlist purchases as `paid_pending_purchase` | SL-010 |
| 2.3 | Add `'cancelling'` to the `subscriptions.status` CHECK, or use `'canceled'` | SL-015 |
| 2.4 | Check every webhook write result; return non-2xx on failure | SL-014 |
| 2.5 | Map Stripe subscription statuses onto the allowed set | SL-026 |
| 2.6 | Fix `/api/fan/me` — five broken queries | SL-016 |
| 2.7 | Point `/api/analytics` at `lib/earnings.ts` | SL-017 |
| 2.8 | Add `platformRevenue()` to `lib/earnings.ts`; use it in admin | SL-018 |
| 2.9 | Remove `file_type` from the digital product insert | SL-020 |
| 2.10 | Fix `channels.is_free` | SL-021 |
| 2.11 | Move tip notification into the webhook | SL-022 |
| 2.12 | Either apply `billing_credits` to bills, or stop advertising them | SL-019 |
| 2.13 | Add post unlocks + gift subscriptions to `earnings.ts` `SOURCES` | SL-023 |
| 2.14 | Fail cron routes closed when `CRON_SECRET` is unset | SL-039 |

**Also in this batch: commit a baseline schema migration (SL-036).** Dump the live schema, commit
it as `000_baseline.sql`, and regenerate `lib/database.types.ts`. Nothing else in this plan is
verifiable without it, and it is the root cause of the recurring bug class.

---

## Batch 3 — Before significant payment volume

At current volume these are tolerable. At scale they become unrecoverable.

| # | Fix | Finding |
|---|---|---|
| 3.1 | `stripe_events` table keyed on `event.id`; insert-then-process | SL-007 |
| 3.2 | Handle `charge.refunded` and `charge.dispute.created`; write reversing rows | SL-008 |
| 3.3 | Teach every `earnings.ts` source to exclude refunded rows | SL-008 |
| 3.4 | Require `payment_status === 'paid'`; handle async payment events | SL-032 |
| 3.5 | Atomic increments for campaign totals and medal balances | SL-027, SL-028 |
| 3.6 | Record early-access renewals in the ledger | SL-035 |
| 3.7 | Ledger table for Front Row Messages and comment boosts | SL-023, SL-063 |
| 3.8 | Handle `account.application.deauthorized`; make `stripe_onboarded` revocable | SL-049 |
| 3.9 | Payout ledger reconciled against Stripe transfers | `MONEY_FLOW_MAP.md` |
| 3.10 | Sign or migrate legacy Bunny digital product URLs | SL-031 |
| 3.11 | Atomic download-count increment | SL-041 |
| 3.12 | Assert `currency === 'usd'` in the webhook | SL-050 |
| 3.13 | Single source of admin identity | SL-033 |
| 3.14 | Retire the REST referral system in favour of the RPC system | SL-042 |

**Add the schema-shape test to `npm test` here** (see `TEST_GAPS.md` item 1). `_tools/schema.js`
and `_tools/refs.js` from this audit are a working implementation and would have caught six of
these findings pre-merge.

---

## Batch 4 — Later

- Checked-write helper in `lib/`, required on money/auth paths (SL-034)
- Unit tests for `lib/earnings.ts`, `lib/fees.ts`, `lib/entitlements.ts`, `lib/billing.ts`
- Integration tests against `supabase db reset` (unblocked by the Batch 2 baseline)
- Remove the `parental_tokens` section from `01-migrations.sql` (SL-053)
- Drop the 14 dead tables (SL-057)
- Printful secret to a header (SL-040)
- `getUser()` in `/api/social-posts` (SL-062)
- Stop returning raw PostgREST messages to clients (SL-061)
- Fix `wishlist_purchases.transfer_stripe_id` → `stripe_transfer_id`
- `auth.uid()` inside `verify_referral` / `referral_status` instead of a caller-supplied uuid (SL-045)
- Deduplicate subscriber referral tracking (SL-043)
- Exclude `.next` from `tsconfig` so `npm run typecheck` passes locally (SL-052)
- Correct CLAUDE.md's `creator_type` values and the age-column claim (SL-054)
- MIME allowlist on digital uploads; orphaned-object sweep (SL-047, SL-048)

---

## Suggested first repair batch

If you want one PR to start with, this is it — highest risk reduction, lowest regression surface,
and it touches no business logic:

1. **The RLS migration (1.1)** — closes SL-001, 002, 003, 012, 013, 029. Pure SQL, additive-safe,
   reversible. Five criticals in one file.
2. **`/api/referrals/creator` authentication (1.3)** — one route, ~15 lines.
3. **The webhook timestamp check (1.5)** — three lines.
4. **Delete `/api/download/[token]` (1.4)** — one file removed.
5. **Authenticate the seven AI routes (1.6)** — one guard each.

That is six criticals and one high, in changes that are individually small and independently
revertible. It does not touch `lib/earnings.ts`, `lib/fees.ts`, or any payment calculation — so
the blast radius on live payments is close to zero.

Run Batch 0 first regardless. If tips are not being recorded, that outranks everything here.
