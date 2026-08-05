# Live Verification — Batch 0, Phase 1

**Status: COMPLETE. Stop condition reached before Phase 3. No code, migrations or configuration changed.**

**Date:** 2026-08-05 · **Repo commit:** 45f9916 · **Working tree:** clean apart from `audit/`
**Method:** `_tools/live-verify.sql` (one read-only SELECT, 25 UNION branches) run by the user in
the Supabase SQL Editor; full output returned and analysed here. Supplemented by read-only source
analysis of the routes that write the affected tables.

---

## Stop condition reached

> Stop and report before changing code if … **live policies differ materially from the repository**.

They do, in six material ways (detailed in §7). Three of the divergences would have made a
migration written from the repository **silently do nothing**, because the live policy names are
different. One would have removed a working code path. And the verification surfaced a **new
critical defect that is out of Batch 0's stated scope**.

Phase 3 is therefore not started. §9 contains the exact migration I would write, now grounded in
live state rather than repository assumptions.

---

## 1. Headline result

**RLS is enabled on all 22 audited tables**, including `creator_profiles`. My original SL-011
premise — that RLS might be off — is **wrong**.

That is the good news, and it is where it ends. Two live facts together mean RLS being "on"
provides much less protection than it appears to:

**a) `anon` and `authenticated` hold complete DML grants on every audited table.**

```
DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
```

Identical for all 22 tables, for both roles. This is the Supabase default
(`grant all on all tables in schema public to anon, authenticated`) and it means **RLS policies
are the only access control in the system**. The caveat I raised before running this — that a
missing `GRANT` might render a permissive policy inert — does not apply anywhere. Every
permissive policy is fully effective.

**b) 20 permissive policies grant WRITE to `{public}`, and 18 grant unrestricted READ.**

`{public}` in `pg_policies.roles` means the policy applies to *every* role, `anon` included. All
are `PERMISSIVE`, so they OR with the correctly-scoped policies beside them and win.

The audit predicted 20 write policies. The live count is exactly 20. The read-all count is 18,
higher than the 13 predicted.

---

## 2. THE MOST URGENT FINDING — not the one I expected

```
creator_profiles :: "Creators are publicly readable"
PERMISSIVE | cmd=SELECT | roles={public} | using=true
```

RLS is on. It does not matter. This policy makes **every column of every creator profile
readable by anyone holding the anon key** — which ships in the browser bundle.

`creator_profiles` columns confirmed live include:

`claim_code`, `claim_expires_at`, `claimed_at`, `stripe_account_id`, `ccbill_account_number`,
`date_of_birth`, `first_ip`, `last_ip`, `first_user_agent`, `last_user_agent`, `shipping_name`,
`shipping_address`, `shipping_city`, `shipping_state`, `shipping_zip`, `deleted_at`

**There are 7 profiles right now with a live, unclaimed `claim_code`.**

`/api/claim` accepts a claim code and sets the email and password on that creator's account. The
code is the entire credential. So a single anon-key request —

```
GET /rest/v1/creator_profiles?select=handle,claim_code&claim_code=not.is.null
```

— returns 7 working account-takeover credentials. This is live, unauthenticated, and needs no
exploit.

**Note on my earlier correction:** I previously reported that no anon-client path *reads*
`claim_code` (all app reads use the service role) and treated that as a mitigation. It is not a
mitigation. The application does not need to read the column for an attacker to; PostgREST
exposes the table directly. I was reasoning about the wrong perimeter.

The same policy also exposes creator `date_of_birth` and stored IP addresses — age/consent and
tracking data — to anyone.

---

## 3. THE NEW CRITICAL — every tip ever paid has been lost

Not in the original audit at this severity. Confirmed by live schema.

```
6. TIPS COUNT   public.tips   0 rows

7. TIPS COLUMN  creator_profile_id   uuid    | nullable=NO | default=none
7. TIPS COLUMN  fan_user_id          uuid    | nullable=NO | default=none
7. TIPS COLUMN  amount               numeric | nullable=NO | default=none
7. TIPS COLUMN  creator_receives     numeric | nullable=NO | default=none
7. TIPS COLUMN  platform_receives    numeric | nullable=NO | default=none
```

The Stripe webhook's tip handler (`app/api/webhooks/stripe/route.ts:104`) inserts exactly four
columns:

```ts
await (supabase as any).from("tips").insert({
  fan_user_id: meta.fan_user_id || null,
  creator_profile_id: meta.creator_profile_id,
  amount,
  stripe_session_id: s.id,
});
```

`creator_receives` and `platform_receives` are **NOT NULL with no default** and are **never
supplied**. Every insert fails with `23502 not_null_violation`.

Worse, `fan_user_id` is **NOT NULL**, while `/api/tip` explicitly supports guest tipping
("Auth is optional — guests can tip without an account") and the webhook writes
`meta.fan_user_id || null`. A guest tip fails on that column too.

The result is never checked, and the handler returns `{ received: true }` → HTTP 200 (SL-014).
Stripe records the event as delivered and never retries.

**`tips` contains 0 rows.** Two readings, and only Stripe can distinguish them:

- No one has ever tipped → no money lost, but tipping has never worked and would fail on first use.
- Tips have been paid → **every one was taken from a fan, transferred to the creator's Connect
  account, and recorded nowhere.**

**To determine which:** in the Stripe Dashboard, search Payments for sessions with
`metadata.type = tip`. Any result is a lost tip. This is the first thing to check after reading
this document.

Note what this also means: `lib/earnings.ts` reports Tips as a **`failed: true`** source rather
than a silent zero — the one place the platform's own safety net worked. It has been reporting a
failure nobody read.

**Fixing this is webhook business logic, which your brief explicitly excluded from Batch 0.**
It needs a decision (see §10).

---

## 4. Findings CONFIRMED in production

| ID | Finding | Live evidence |
|---|---|---|
| **SL-001** | `creator_billing` writable by anon | `creator_billing_service_all` — `cmd=ALL, roles={public}, using=true, check=true`. Anon can set any creator's `status='active'`, `tier`, `trial_ends_at`. Free platform access; all entitlement gating bypassed. |
| **SL-002** | `billing_credits` mintable | `billing_credits_service` — `cmd=ALL, roles={public}, using=true, check=true`. |
| **SL-003** | Digital paywall bypass | `dpur_insert` (`INSERT, {public}, check=true`) + `dpur_update` (`UPDATE, {public}, using=true`). Forge a purchase with a chosen `download_token`, then fetch it. |
| **SL-004** | Download guards inert | `token_expires_at` **ABSENT**, `max_downloads` **ABSENT**, `download_count` present. Both guards in `/api/download/[token]` compare against `undefined` and always pass. |
| **SL-013** | Anon-forgeable paid records | Confirmed on `super_tips`, `post_unlocks`, `early_access_passes`, `gift_subscriptions`, `live_streams`, `marketplace_orders`, `social_addback_orders`, `merch_orders`, `wishlist_purchases`, `creator_referrals`, `subscriber_referrals`. |
| **SL-015** | `'cancelling'` violates CHECK | Live: `CHECK (status = ANY (ARRAY['trialing','active','past_due','canceled','incomplete']))`. `'cancelling'` absent → every cancellation write fails, route returns `{ ok: true }`. |
| **SL-016** | `/api/fan/me` broken | `subscriptions.canceled_at` **ABSENT** → that query errors → `?? []` → fan sees zero subscriptions. |
| **SL-025** | tips NOT NULL not supplied | See §3. Escalated to the most severe confirmed defect. |
| **SL-029** | `tips` publicly readable | `"Tips publicly readable"` — `SELECT, {public}, using=true`. Currently 0 rows, so nothing is exposed *yet*; it becomes a live privacy breach the moment tipping works. |
| SL-005, SL-006, SL-008, SL-014, SL-064 | referral route, webhook replay, no refunds, webhook 200-on-failure, unauthenticated AI routes | Confirmed from source; no database dependency. |

Also confirmed live: `creator_profiles` public-read (§2), and `live_streams_select`
(`SELECT, {public}, using=true`) exposing `stream_key` and `rtmp_url` — the credentials to
broadcast to any creator's stream. That was not in the original audit.

---

## 5. Findings NOT PRESENT in production — schema drift in our favour

| ID | Original claim | Live reality |
|---|---|---|
| **SL-009** | `subscriptions.updated_at` missing → fan subscriptions never recorded | **Column EXISTS.** The upsert is valid. Fan subscriptions record correctly. Same for `/api/gift-subscription/redeem`. **Withdrawn.** |
| **SL-010** | Wishlist insert `status:'pending'` violates CHECK | Live CHECK is `('pending','transferred','refunded')`, **not** the repo's `('paid_pending_purchase','creator_purchased','refunded')`. `'pending'` is valid. **Withdrawn** — but see SL-066 below, which inverts it. |
| **SL-012** | `merch_orders` buyer addresses readable by anon | **No `merch_orders_service_all` exists live.** Live `merch_orders_select` is correctly scoped to `creator owns OR fan_user_id = auth.uid()`. Shipping addresses are **not** exposed. Downgraded: only `merch_orders_insert` (`{public}, check=true`) is open, so orders can be *forged*, not *read*. **critical → high.** |
| **SL-024** | `tips` uses `creator_id`; `stripe_session_id` absent | **Both wrong.** Live `tips` has `creator_profile_id` *and* `stripe_session_id`. `lib/earnings.ts` and the webhook use correct names. **Withdrawn.** |
| **SL-011** (as written) | `creator_profiles` RLS disabled | **RLS is ENABLED.** The premise was wrong — but the exposure is real via a public-read policy instead. **Re-stated, not withdrawn** (§2). |
| SL-007 (partial) | No idempotency anywhere | Live UNIQUE constraints exist on `digital_purchases.stripe_session_id`, `merch_orders.loudcap_order_id`, `subscription_payments.stripe_invoice_id`, `post_unlocks(post_id,fan_user_id)`, `early_access_passes(fan_user_id,creator_profile_id)`, `subscriptions(fan_user_id,creator_profile_id)`. **Narrowed** to `tips`, `super_tips`, `campaign_donations`, `wishlist_purchases`, `medal_purchases`. |

Also withdrawn: my claim that `app/api/wishlist/confirm/route.ts:62` writes a non-existent
column. The live column **is** `transfer_stripe_id`, exactly as the code writes it. The
repository migration is what disagrees.

---

## 6. NEW findings, discovered only by looking at production

| ID | Severity | Finding |
|---|---|---|
| **SL-065** | high | `lib/earnings.ts` settles wishlist revenue on `status IN ('paid_pending_purchase','creator_purchased')`. Neither value can exist — the live CHECK permits only `('pending','transferred','refunded')`. **Wishlist revenue is structurally always $0** in every earnings figure. This is the mirror image of SL-010: the code is fine, the *earnings module* is wrong. |
| **SL-066** | critical | `tips.fan_user_id` is NOT NULL, but `/api/tip` supports guest tipping and the webhook writes `|| null`. Even after SL-025 is fixed, **guest tips can never be recorded.** |
| **SL-067** | high | `live_streams_select` (`SELECT, {public}, using=true`) exposes `stream_key` and `rtmp_url` for every stream. Anyone with the anon key can obtain the broadcast credentials for any creator's live stream and stream as them. |
| **SL-068** | medium | `anon` holds `TRUNCATE` and `DELETE` on all 22 tables. `TRUNCATE` is **not subject to RLS**. Not reachable through PostgREST (which never issues TRUNCATE), so not currently exploitable — but it means the grant surface is far wider than the policy surface, and any future direct-connection path would be catastrophic. |
| **SL-069** | low | `social_addback_purchases` (migration 020) **does not exist** in production. Dead migration; the live table is `social_addback_orders`. |

---

## 7. Where live differs materially from the repository

This is the stop condition, and it is the most important operational lesson in this document.

| # | Repository says | Production says | Consequence for a repo-derived migration |
|---|---|---|---|
| 1 | `digital_purchases_service_insert` / `_update` | **`dpur_insert` / `dpur_update`** | `drop policy if exists "digital_purchases_service_insert"` → **silent no-op. The paywall stays open.** |
| 2 | `merch_orders_service_all` exists | **Does not exist**; `merch_orders_insert` does | Drop → silent no-op; the actual open policy survives |
| 3 | `wishlist_purchases.status CHECK ('paid_pending_purchase','creator_purchased','refunded')` | **`('pending','transferred','refunded')`** | SL-010 was a false positive; SL-065 is the real defect |
| 4 | `subscriptions` has no `updated_at` | **Has `updated_at`** | SL-009 false positive |
| 5 | `tips.creator_id`, `stripe_payment_intent_id` | **`creator_profile_id`, and both `stripe_payment_intent_id` and `stripe_session_id`** | SL-024 false positive |
| 6 | `creator_profiles` has no RLS statement | **RLS enabled, 3 policies** | SL-011 premise wrong; real exposure is a public-read policy |

**Three of the six would have caused a migration written from the repository to appear to succeed
while changing nothing.** That is precisely the failure mode this verification phase existed to
catch, and it is the strongest possible argument for the baseline-schema migration (SL-036).

---

## 8. Phase 2 — safe exploit verification

Not executed. The Supabase anon key was never supplied, so `_tools/anon-probe.mjs` did not run.

It is also **no longer necessary for the confirmed findings.** A probe infers policy state from
an error code; §1 and §4 give the policy definitions and role grants directly, which is strictly
stronger evidence. Every Phase 2 item is therefore resolved by policy analysis:

| Phase 2 item | Verdict | Basis |
|---|---|---|
| 1. Anon updates `creator_billing` to active | **VULNERABLE** | `creator_billing_service_all`: `ALL, {public}, using=true, check=true`; anon holds `UPDATE` grant |
| 2. Anon inserts fake `digital_purchases` | **VULNERABLE** | `dpur_insert`: `INSERT, {public}, check=true`; anon holds `INSERT` grant |
| 3. Read another buyer's merch address | **NOT VULNERABLE** | `merch_orders_select` correctly scoped; no permissive read policy exists |
| 4. Read creator claim fields | **VULNERABLE — live, 7 codes** | `"Creators are publicly readable"`: `SELECT, {public}, using=true` |
| 5. Download without a verified purchase | **VULNERABLE** | Chain: item 2 forges the row with a chosen `download_token`; `token_expires_at`/`max_downloads` absent so `/api/download/[token]` has no guard. **Verified by policy analysis only** — not executed, as it would create persistent financial data. |

---

## 9. The migration I would write — for approval, not applied

Grounded in live policy names. Every dropped policy's legitimate path was traced first: **all
writes to these tables come from server routes under `app/api/**`, none from browser code**, and
the four routes that use the cookie/anon client (`/api/billing`, `/api/live/start`,
`/api/marketplace/purchase`, `/api/social-addbacks/purchase`) all require `getUser()` and write
only rows scoped to that user. So narrow `authenticated` + ownership policies are a complete
replacement. No guest-write path exists.

```sql
-- Drop the anon-writable policies (LIVE names, verified 2026-08-05)
drop policy if exists "creator_billing_service_all"      on public.creator_billing;
drop policy if exists "billing_credits_service"          on public.billing_credits;
drop policy if exists "dpur_insert"                      on public.digital_purchases;
drop policy if exists "dpur_update"                      on public.digital_purchases;
drop policy if exists "merch_orders_insert"              on public.merch_orders;
drop policy if exists "post_unlocks_service_insert"      on public.post_unlocks;
drop policy if exists "super_tips_insert"                on public.super_tips;
drop policy if exists "early_access_insert"              on public.early_access_passes;
drop policy if exists "early_access_update"              on public.early_access_passes;
drop policy if exists "gift_sub_insert"                  on public.gift_subscriptions;
drop policy if exists "gift_sub_update"                  on public.gift_subscriptions;
drop policy if exists "live_streams_insert"              on public.live_streams;
drop policy if exists "creator_referrals_insert"         on public.creator_referrals;
drop policy if exists "creator_referrals_update"         on public.creator_referrals;
drop policy if exists "subscriber_referrals_insert"      on public.subscriber_referrals;
drop policy if exists "subscriber_referrals_update"      on public.subscriber_referrals;
drop policy if exists "wishlist_purchases_insert"        on public.wishlist_purchases;
drop policy if exists "Anyone can create order"          on public.marketplace_orders;
drop policy if exists "Anyone can create an order"       on public.social_addback_orders;

-- Close the claim-code and PII exposure (SL-011). Public creator pages still work:
-- only published, non-deleted profiles are readable.
drop policy if exists "Creators are publicly readable" on public.creator_profiles;
create policy "public reads published creator pages" on public.creator_profiles
  for select using (published is true and deleted_at is null);

-- Close the tip privacy hole (SL-029)
drop policy if exists "Tips publicly readable" on public.tips;

-- Close the stream-credential leak (SL-067)
drop policy if exists "live_streams_select" on public.live_streams;
create policy "public reads live stream status" on public.live_streams
  for select using (status = 'live');

-- Narrow replacement for the one route that genuinely needs an authenticated write
create policy "creator_billing_own_write" on public.creator_billing
  for insert to authenticated with check (user_id = auth.uid());
create policy "creator_billing_own_update" on public.creator_billing
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

`live_streams_creator_manage` (`cmd=ALL`, `using = creator owns`) already covers creator inserts —
for an `ALL` policy Postgres reuses `USING` as the `WITH CHECK` — so dropping `live_streams_insert`
breaks nothing.

**Two items need your decision before I would apply this:**

1. **`live_streams_select`** — replacing `using(true)` with `using(status='live')` still exposes
   `stream_key` for *live* streams. The correct fix is a column-restricted view, which is a larger
   change than Batch 0. The stopgap above narrows the window but does not close it.
2. **`/api/marketplace/purchase` and `/api/social-addbacks/purchase`** insert orders via the anon
   client. They authenticate, but the inserted row's ownership column (`buyer_user_id` /
   `fan_user_id`) would need a matching `authenticated` policy, or the routes should move to the
   service role. I lean toward moving them to the service role — it matches every other payment
   route — but that edits route code, which your brief scoped tightly.

---

## 10. Finding status summary

| Status | Count | IDs |
|---|---|---|
| **Confirmed in production** | 13 | SL-001, 002, 003, 004, 005, 006, 008, 011*, 013, 014, 015, 016, 025, 029, 064 (*re-stated) |
| **Not present in production** | 4 | SL-009, SL-010, SL-012 (read side), SL-024 |
| **Narrowed** | 2 | SL-007 (idempotency partly present), SL-012 (critical → high) |
| **New, from live data** | 5 | SL-065, SL-066, SL-067, SL-068, SL-069 |
| **Unable to verify** | 0 | — |
| **Fixed** | 0 | Phase 3 not started |

---

## 11. What I recommend, and what I need from you

**Immediately, before any code change — check Stripe.** Search Payments for
`metadata.type = tip`. That single lookup tells you whether §3 is "a feature that has never
worked" or "money taken from fans and lost". It changes the priority of everything else.

**Then, three decisions:**

1. **Apply the §9 migration?** It closes 6 confirmed criticals and 2 new highs, is pure SQL, and
   I have traced every legitimate path it touches. The two open questions above need your steer.
2. **Rotate the 7 live claim codes?** They have been readable by anyone with the anon key for as
   long as that policy has existed. Rotating is one `UPDATE`, but it is a data change and your
   brief excluded those, so I have not proposed it as part of the migration.
3. **Does the tip fix (SL-025 / SL-066) come into this batch?** It is webhook business logic,
   which you explicitly excluded. It is also the most severe confirmed defect. I would not widen
   the batch without you saying so.

Phase 3 remains unstarted. `git status` shows only the untracked `audit/` directory.

---

# Batch 0 outcome (appended 2026-08-05)

Emergency Batch 0 is **prepared, not deployed**. Migrations written, code changed, tests passing,
nothing applied to production. Detail in `BATCH_0_CHANGES.md`.

## Findings addressed

| ID | Status after Batch 0 | How |
|---|---|---|
| SL-011 | **fixed (pending deploy)** | `Creators are publicly readable` dropped; `creator_public` view; 11 public reads repointed; `revoke all ... from anon` |
| SL-001 | **fixed (pending deploy)** | `creator_billing_service_all` dropped; narrow own-insert/own-update policies |
| SL-002 | **fixed (pending deploy)** | `billing_credits_service` dropped |
| SL-003 | **fixed (pending deploy)** | `dpur_insert` / `dpur_update` dropped — **live names**, not the repo's |
| SL-004 | **fixed (pending deploy)** | `/api/download/[token]` returns 410, no fallback |
| SL-005 | **fixed (pending deploy)** | Route requires a session; caller is the referred party; duplicates refused |
| SL-006 | **fixed (pending deploy)** | Hand-rolled HMAC replaced with the SDK verifier, 300s tolerance |
| SL-013 | **fixed (pending deploy)** | 11 forgeable-write policies dropped |
| SL-025 | **fixed (pending deploy)** | Migration 065 + `buildTipLedgerRow()`; insert checked; 500 on failure |
| SL-029 | **fixed (pending deploy)** | `Tips publicly readable` dropped; fan-scoped policy added |
| SL-064 | **fixed (pending deploy)** | 6 routes session-gated; `/api/advisor/signup` rate limited (pre-auth by necessity) |
| SL-066 | **fixed (pending deploy)** | `tips.fan_user_id` nullable; guest tips record with `null`, never a fake id |
| SL-067 | **partially fixed** | `live_streams_select USING(true)` dropped, replaced with `status='live'`. **Rows narrowed, columns not** — `stream_key` still selectable for live streams. Needs a column-restricted view. |
| SL-068 | **partially fixed** | `truncate/trigger/references` revoked on 21 tables; broader grant reduction not attempted |
| SL-007 | **partially fixed** | Tips now idempotent via `tips_stripe_session_id_key`. Super tips, campaign donations, wishlist purchases, medal packs still not. |
| SL-012 | **fixed (pending deploy)** | `merch_orders_insert` dropped; the correctly-scoped read policy preserved |
| SL-046 | **fixed incidentally** | `/api/tip` creator email now uses the service client; it previously always failed silently |
| SL-052 | **fixed** | Clean typecheck verified from a cold start after deleting `.next` |

## Deliberately not addressed

SL-008 (refunds/disputes), SL-014 (webhook 200-on-failure for non-tip branches), SL-015
(`'cancelling'`), SL-016 (`/api/fan/me`), SL-017/SL-018 (analytics and admin revenue), SL-019
(billing credits never applied), SL-020, SL-021, SL-022 (tip notified before payment), SL-030
(Next.js CVE), SL-065 (wishlist settle statuses).

## Still exposed after Batch 0 deploys

1. **`stream_key` / `rtmp_url` for currently-live streams** (SL-067). Window reduced from every
   stream ever created to streams live right now.
2. **Anthropic spend on `/api/advisor/signup`** — bounded per warm instance, not globally.
3. **Everything in "deliberately not addressed"**, notably no refund handling, so a refunded
   payment is still counted as earnings forever.
