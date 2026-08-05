# Batch 0 — Changes

**Prepared, not deployed.** No migration was run, no data changed, nothing published.
Built against the **live** schema captured in `LIVE_VERIFICATION.md`, not the repository.

**42 files modified · 13 files added · 2 migrations · 1 ops script**

---

## 1. Migrations

### `supabase/migrations/064_emergency_rls_lockdown.sql`

Every policy name taken from production `pg_policies`. Full diff in
`_tools/policy-diff.md`, verified mechanically: **22/22 dangerous policies dropped, 5 narrow
policies created, 10/10 correctly-scoped policies preserved.**

**Why the live names mattered.** Three repo-derived drops would have been silent no-ops:

| Repository name | Live name |
|---|---|
| `digital_purchases_service_insert` | **`dpur_insert`** |
| `digital_purchases_service_update` | **`dpur_update`** |
| `merch_orders_service_all` | **does not exist** — the live policy is `merch_orders_insert` |

A migration written from the repo would have reported success and left the paywall bypass open.
`merch_orders_service_all` is deliberately **not** referenced in any executable statement, and a
test asserts that.

**Dropped — write access for `{public}` (19):** `creator_billing_service_all`,
`billing_credits_service`, `dpur_insert`, `dpur_update`, `merch_orders_insert`,
`post_unlocks_service_insert`, `super_tips_insert`, `early_access_insert`,
`early_access_update`, `gift_sub_insert`, `gift_sub_update`, `live_streams_insert`,
`creator_referrals_insert`, `creator_referrals_update`, `subscriber_referrals_insert`,
`subscriber_referrals_update`, `wishlist_purchases_insert`, `Anyone can create order`,
`Anyone can create an order`.

**Dropped — unrestricted read (3):** `Creators are publicly readable`, `Tips publicly readable`,
`live_streams_select`.

**Created (5):** `creator_profiles_own_select`, `tips_fan_select`, `live_streams_public_status`,
`creator_billing_own_insert`, `creator_billing_own_update` — all `TO authenticated` (or `anon` for
the live-status read), all with ownership in `USING` **and** `WITH CHECK` where they permit writes.

No `*_service_*` policy is recreated. The service role bypasses RLS; those policies only ever
granted access to `anon` and `authenticated`.

**Grants (SL-068):** `revoke all on creator_profiles from anon`, and `revoke truncate, trigger,
references` from `anon`/`authenticated` on all 21 audited tables. TRUNCATE is not subject to RLS,
so the grant surface should not be wider than the policy surface.

### `supabase/migrations/065_tips_ledger_integrity.sql`

Makes it possible for a tip to be recorded. Live `tips` has `creator_receives`,
`platform_receives` and `fan_user_id` as **NOT NULL with no default**, and the webhook supplied
none of the first two — so every insert failed `23502`. The table holds 0 rows.

- `fan_user_id` → nullable. Guest tipping is a supported path and no ownership decision depends
  on the column; the fan-side policy (`fan_user_id = auth.uid()`) simply matches nothing for a
  guest row. **No placeholder fan id is invented.**
- `creator_receives` / `platform_receives` → `default 0`. A safety net, not a substitute: the
  webhook now writes both explicitly.
- `currency text not null default 'usd'` + a 3-character check.
- **`tips_stripe_session_id_key`** — partial unique index for idempotency. One tip per checkout
  session; every redelivery carries the same session id.
- `stripe_event_id` column + indexes on it and `stripe_payment_intent_id` for reconciliation.

No backfill. No existing row is modified.

---

## 2. Claim-code remediation (separate, not a migration)

### `supabase/ops/2026-08-05_rotate_exposed_claim_codes.sql`

Outside `supabase/migrations/` so `db push` never runs it. Full rationale in
`CLAIM_CODE_REMEDIATION.md`. Nulls the 7 exposed unclaimed codes; guarded, idempotent,
counts-only output, no code value ever selected. **Run after 064, never before.**

---

## 3. Creator profile exposure (Part 1)

**The projection.** `lib/creator-public.ts` defines `PUBLIC_CREATOR_COLUMNS` (34 columns) and
`FORBIDDEN_PUBLIC_COLUMNS` (31). Migration 064 creates the SQL view `public.creator_public` from
exactly that list, filtered to `deleted_at is null`. The view is not `security_invoker`, so it
reads the base table with the owner's rights — a curated projection that works even though anon
has no access to the table.

**Excluded, as required:** `claim_code`, `claim_expires_at`, `claimed_at`, `date_of_birth`,
`parental_consent_at`, `graduated_at`, all `first_*`/`last_*` IP and user-agent tracking, all
`shipping_*`, `stripe_account_id`, `ccbill_account_number`, `ccbill_sub_account`,
`blocked_regions`, `search_vector`, `deleted_at`, **and `user_id`** — verified that no public
surface consumes it.

**Every public read repointed (11 sites, 10 files).** No `select("*")` remains against a public
profile anywhere:

| File | Change |
|---|---|
| `app/[creator]/page.tsx` | → view; explicit columns |
| `app/[creator]/CreatorWorld.tsx` | `select("*")` → `PUBLIC_CREATOR_SELECT`; founder count → view |
| `app/[creator]/CampaignFirstPage.tsx` | `select("*")` → `PUBLIC_CREATOR_SELECT` |
| `app/preview/[creator]/page.tsx` | `select("*")` → `PUBLIC_CREATOR_SELECT` |
| `hooks/useCreator.ts` | by-handle `select("*")` → view; by-user_id left on the base table |
| `app/explore/page.tsx`, `app/sitemap.ts`, `app/api/search/route.ts`, `lib/discovery.ts`, `app/api/recommendations/route.ts` (×3) | → view |
| `app/(auth)/signup/page.tsx`, `app/api/early-access/route.ts`, `app/api/posts/publish/route.ts` | → view |

**Two behavioural notes, stated plainly:**

1. `app/[creator]/page.tsx` previously called `isUnclaimedPreview({ published, claimed_at })` to
   decide `robots: noindex`. `claimed_at` is claim state and is no longer public, so the check is
   now `published !== true` — a **strict superset**: everything the old check noindexed is still
   noindexed, plus claimed-but-unpublished pages, which should not be indexed anyway. No page
   loses indexing it previously had.
2. The `deleted_at` guards in the three page loaders are now enforced by the view's `WHERE`
   clause rather than in TypeScript. Same outcome, one layer earlier.

**Privileged reads moved to the service role.** 14 payment routes read another creator's
`stripe_account_id`, six directly and eight through a `creator:creator_profile_id(...)` embed.
That embed resolves against `creator_profiles` and returns nothing once anon loses read. New
helper `lib/payee.ts` (`getPayeeCreator`, `canReceivePayments` as a type predicate) does one
narrow service-role lookup.

**The parent row deliberately stays on the RLS-enforcing client** — that is what stops a draft
product or another creator's listing being purchased. Only "where does the money go" is
privileged. Routes changed: `tip`, `super-tip`, `gift-subscription`, `messages/front-row`,
`subscribe`, `subscribe/tier`, `live/tip`, `campaigns/donate`, `digital/purchase`,
`marketplace/purchase`, `merch/checkout`, `posts/unlock`, `social-addbacks/purchase`,
`wishlist/confirm`.

**Admin surfaces → service role.** `app/admin/page.tsx`, `admin/ads`, `admin/moderation` read
across all creators and were on the cookie client; RLS cannot see the `isAdmin()` gate. All three
also gained `export const dynamic = "force-dynamic"` — an admin page must never be prerendered,
and without it the production build failed trying to prerender `/admin` with a service client.

`lib/billing.ts` `isCreatorProfileLocked()` reads a *different* creator's billing state on behalf
of a fan; both lookups moved to the service role. The `supabase` parameter is retained for
call-site compatibility and is now unused.

**Verification:** `_tools/check-owner-scope.js` walks every `creator_profiles` read and classifies
it. Result: 35 service-role, 40 owner-scoped, 37 writes, **0 unscoped reads remaining**.

---

## 4. Tip ledger repair (Part 4)

**Flow traced end to end.** `/api/tip` grosses the charge up (`grossUpForStripe`), sets
`payment_intent_data[transfer_data][amount]` to the tip and `[destination]` to the creator's
Connect account, and puts `type=tip`, `creator_profile_id`, `amount_usd` and (when signed in)
`fan_user_id` in metadata. Stripe charges the fan, transfers the tip, and delivers
`checkout.session.completed`.

**`lib/tips.ts`** — `buildTipLedgerRow()`, pure and unit-tested, produces:

| Field | Value |
|---|---|
| `amount` | the tip (gross to the creator), **not** `amount_total` |
| `creator_receives` | the tip — creator keeps 100% |
| `platform_receives` | `0` — the gross-up is a pass-through, not a cut |
| `fan_user_id` | the fan, or **`null`** for a guest |
| `currency` | from the session; **non-USD is refused**, never divided by 100 |
| `stripe_session_id` / `stripe_payment_intent_id` / `stripe_event_id` | reconciliation |

This agrees with `lib/earnings.ts` by construction: `amount - platform_receives === creator_receives`.

**Webhook changes** (`app/api/webhooks/stripe/route.ts`) — confined to the verifier and the tip
branch:

1. Hand-rolled HMAC replaced with `verifyWebhook` from `lib/stripe.ts` (the official SDK), which
   enforces the signature, a **300s timestamp tolerance**, and the raw body. On failure it returns
   400 and **never falls through to `JSON.parse`**.
2. The tip insert is checked. `23505` on the session-id index → `200 {deduplicated:true}` and no
   second notification. Any other error → **500**, so Stripe retries.
3. Unprocessable metadata → **422** (retrying will not help) with a structured log.
4. Structured JSON logs carrying only ids and error codes — no email, name, amount or secret.

**Connect transfer safety:** the transfer is created by Stripe at payment time from
`payment_intent_data[transfer_data]` on the checkout session. It is **not** created by this
handler, so a database retry cannot produce a second transfer. Retrying is safe, and the unique
index makes it non-duplicating.

`lib/stripe.ts` `verifyWebhook()` gained optional `secret` and `toleranceSeconds` parameters —
additive, so the existing CCBill caller is unaffected.

---

## 5. Route protections (Part 6)

| Route | Change |
|---|---|
| `/api/referrals/creator` | Rewritten. Requires a session; the **caller is the referred party** and the body can no longer name who gets credited; `referredUserId` is mandatory so the self-referral check always runs; duplicate pair → 409; every write checked; credit issuance consumes exactly the rows it pays for and rolls back the `credited` flag if the credit insert fails. |
| `/api/download/[token]` | **HTTP 410 Gone**, GET and POST. No fallback, no redirect — a compatibility shim would reinstate the bypass. `/api/digital/download` remains the only path; it verifies the purchase server-side, enforces `download_limit`, and mints a 5-minute signed URL. |
| 6 AI routes | `requireCreatorSession()` guard. `campaigns/assist`, `tiers/assist`, `posts/tags`, `studio/build` additionally require a spotlight profile. |
| `/api/advisor/signup` | **Cannot** be session-gated — it runs before an account exists. Rate limited instead: 20 requests / 10 min / IP. |

**`/api/referrals/creator` caller change:** `app/(auth)/signup/page.tsx` still posts
`referrerHandle`; `referredUserId` is now ignored in favour of the session. The stored
`spotlightly_creator_ref` is only cleared on a 2xx, so an attribution made before email
confirmation can be retried rather than lost.

---

## 6. Known limitations — stated, not hidden

- **The signup advisor rate limiter is per warm serverless instance**, not global. It converts
  unbounded Anthropic spend into bounded-per-instance spend. A durable limiter (Upstash via the
  Vercel Marketplace, or BotID on that route) is the real fix.
- **`live_streams_public_status` narrows rows, not columns.** `stream_key` and `rtmp_url` are
  still selectable for streams that are currently live. A column-restricted view is the real fix
  (SL-067); this reduces the window from "every stream ever" to "streams live right now".
- **`/api/tip` still notifies the creator before payment** (SL-022). Moving it into the webhook is
  a behavioural change to a payment path and was out of scope. A comment marks it in the code.
- **`billing_credits` are still never applied to a bill** (SL-019). Out of scope.
- **The tip email in `/api/tip` now uses the service client** — it previously called `auth.admin`
  on the cookie client, which always failed silently (SL-046). It will now actually send. That is
  a fix, but it is a behaviour change worth knowing about before deploy.

---

## 7. Explicitly NOT in this batch

Per instruction: refunds and disputes (SL-008), webhook idempotency for sources other than tips
(SL-007), payout ledger, marketplace/subscription backfill, analytics and admin revenue
(SL-017/SL-018), `lib/earnings.ts` wishlist settle statuses (SL-065), `subscriptions.status =
'cancelling'` (SL-015), `/api/fan/me` (SL-016), `digital_products.file_type` (SL-020),
`channels.is_free` (SL-021), Next.js upgrade (SL-030).

---

## Addendum — gap-closing pass

Re-auditing this batch against the spec found three requirements not genuinely met. Closed:

1. **`lib/tips.ts` gained `tipWebhookOutcome()`** — the retry contract as a pure, tested function:
   malformed metadata → 422 no-retry; duplicate key → 200 no-retry **no second notification**; any
   other write error (incl. `23502`, `42501`, a codeless connection reset) → **500, retryable**;
   success → 200 + notify. The webhook now calls it instead of branching inline, so the log line,
   the status and the notify decision come from one place and cannot drift.
2. **7 new tests** for failed-insert-is-retryable and retry-after-temporary-failure.
3. **9-test authenticated pass** in the integration suite. The dropped policies were `TO {public}`,
   which covers `authenticated` as well as `anon`; probing only as `anon` left half the surface
   unverified.

**Part 6.3 confirmed:** `/api/digital/download` looks up by unique `download_token`, enforces
`download_limit`, and mints a 300s signed URL from a private bucket, incrementing the counter only
after signing. `digital_purchases` has no status column — settlement is implied by row existence,
and after 064 drops `dpur_insert`/`dpur_update` **no anon or authenticated role can create one**,
so the token becomes a real proof of purchase. Residual, both out of scope: the webhook does not
check `payment_status === 'paid'` (SL-032), and there is no refund revocation (SL-008).
