# Findings

Every finding with severity, file, line, evidence, impact and recommended fix.
Machine-readable equivalent: `AUDIT_EVIDENCE.json`.

| Severity | Count |
|---|---|
| critical | 14 |
| high | 25 |
| medium | 20 |
| low | 10 |
| **total** | **69** |

**Verification levels**

- **CONFIRMED** — proven by comparing code against committed SQL and/or generated types. No runtime access needed.
- **CONFIRMED-SCHEMA-DIVERGENCE-RISK** — proven against every schema artifact in the repository, but the live database has documented out-of-band drift. One SQL query confirms or clears it.
- **RISK** — requires runtime or configuration verification to confirm exploitability.


---

## CRITICAL (14)

### SL-001 — creator_billing RLS policy grants full read/write to the anon key

**Severity:** critical · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `supabase/migrations/012_creator_billing.sql:36`

**Evidence**

```
create policy "creator_billing_service_all" on public.creator_billing for all using (true) with check (true);
```

**Detail** — No TO clause means TO PUBLIC, which includes the anon and authenticated roles. RLS policies are OR'ed (no policy in this repo is declared AS RESTRICTIVE), so this permissive policy overrides creator_billing_own_select. The anon key is published in the browser bundle.

**Impact** — Anyone can read every creator's stripe_customer_id and stripe_subscription_id, and can UPDATE their own billing row to status='active', tier='starter', trial_ends_at=<far future> - unlimited free use of every paid platform feature. isBillingLocked() reads this table, so all entitlement gating is bypassable.

**Fix** — Drop the policy. The service role bypasses RLS entirely and never needed one. If a policy is genuinely required, scope it: TO service_role.

### SL-002 — billing_credits RLS policy lets anyone mint account credit

**Severity:** critical · **Category:** money · **Verification:** CONFIRMED

**Location:** `supabase/migrations/019_referrals.sql:70`

**Evidence**

```
create policy "billing_credits_service" on public.billing_credits for all using (true) with check (true);
```

**Detail** — Same TO PUBLIC defect. billing_credits rows carry amount_usd and are presented to creators as '$29 off next bill'.

**Impact** — Any holder of the anon key can insert arbitrary billing credits for any creator profile, directly against PostgREST, with no application route involved.

**Fix** — Drop the permissive policy; keep only billing_credits_own (select). All writes go through the service role.

### SL-003 — digital_purchases INSERT/UPDATE open to anon - complete paid-content paywall bypass

**Severity:** critical · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `supabase/migrations/017_digital_products.sql:76`

**Evidence**

```
create policy "digital_purchases_service_insert" ... for insert with check (true);
create policy "digital_purchases_service_update" ... for update using (true);
```

**Detail** — An attacker inserts a digital_purchases row with a download_token of their choosing and any digital_product_id. Both download routes look a purchase up by token alone using the service role, so the fabricated row is honoured. The UPDATE policy additionally allows resetting download_count to defeat any limit.

**Impact** — Every paid digital product on the platform is downloadable for free by anyone, with no payment and no account.

**Fix** — Drop both policies. Writes belong to the Stripe webhook under the service role.

### SL-004 — /api/download/[token] - all three access guards silently disabled by missing columns

**Severity:** critical · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `app/api/download/[token]/route.ts:29`

**Evidence**

```
if (new Date(purchase.token_expires_at) < new Date()) { ... }
if (purchase.download_count >= purchase.max_downloads) { ... }
if (purchase.product?.status === "deleted") { ... }
```

**Detail** — digital_purchases has no token_expires_at and no max_downloads column - neither appears in any migration nor in lib/database.types.ts. new Date(undefined) yields Invalid Date, and every comparison against NaN returns false, so the expiry check always passes. 0 >= undefined is false, so the download limit never triggers. digital_products.status is CHECK-constrained to active/draft/archived, so 'deleted' is unreachable. The route is unauthenticated and uses the service role.

**Impact** — Unauthenticated, unlimited, never-expiring downloads of every purchased product. A single leaked or shared link works forever.

**Fix** — This route duplicates /api/digital/download with weaker checks. Delete it, or add the columns and enforce them.

### SL-005 — /api/referrals/creator is unauthenticated and issues $29 credits on demand

**Severity:** critical · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/referrals/creator/route.ts:7`

**Evidence**

```
export async function POST(req: NextRequest) {
  const supabase = await createServiceClient();
  const { referrerHandle, referredUserId, referredHandle } = await req.json();
```

**Detail** — No authentication, no rate limit, no proof the referred account exists. Every call inserts a creator_referrals row; every 5 rows issues a $29 billing credit. The self-referral guard is doubly broken: it is skipped entirely when referredUserId is falsy (the field is optional), and when present it looks up creator_profiles by .eq('id', referrer.id) - the referrer's own row - so it only rejects the case where the caller passes the referrer's own user id.

**Impact** — curl -X POST /api/referrals/creator -d '{"referrerHandle":"anyhandle"}' five times mints $29 of credit. Repeat without limit. Directly monetisable fraud against platform revenue.

**Fix** — Require an authenticated session, derive the referred user from that session, add a unique constraint on (referrer_profile_id, referred_user_id), and require referredUserId to be non-null.

### SL-006 — Stripe webhook has no replay protection - timestamp is never validated

**Severity:** critical · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:10`

**Evidence**

```
const t = parts["t"];
const v1 = parts["v1"];
if (!t || !v1) return false;
const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
```

**Detail** — The timestamp t is fed into the HMAC but never compared against the current time. Stripe's own libraries enforce a default 5-minute tolerance precisely to stop replay. This hand-rolled verifier omits it.

**Impact** — Any captured webhook body plus its signature header stays valid forever. Combined with SL-007 (non-idempotent inserts), replaying one captured tip or donation event fabricates unlimited money rows that pass signature verification.

**Fix** — Reject events where Math.abs(now - t) > 300 seconds, or replace the hand-rolled verifier with stripe.webhooks.constructEvent from lib/stripe.ts, which already exists.

### SL-007 — Stripe webhook handlers are not idempotent - duplicate delivery double-counts money

**Severity:** critical · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:104`

**Evidence**

```
await (supabase as any).from("tips").insert({...});  // line 104
await (supabase as any).from("super_tips").insert({...});  // line 125
await (supabase as any).from("campaign_donations").insert({...});  // line 203
await (supabase as any).from("wishlist_purchases").insert({...});  // line 235
await (supabase as any).from("medal_purchases").insert({...});  // line 354
await (supabase as any).from("merch_orders").insert({...});  // line 588
```

**Detail** — There is no processed-event table and no unique constraint on stripe_session_id for any of these tables. Stripe retries delivery on any non-2xx response and on network timeouts, and can deliver the same event more than once by design. Only social_addback (status guard), post_unlocks / early_access / subscriptions (upsert) and subscription_payments (unique stripe_invoice_id) are protected.

**Impact** — A retried checkout.session.completed creates a second tip, super tip, donation, wishlist purchase, medal grant and merch order. Creator earnings, campaign progress bars and merch fulfilment all double. merch_orders additionally triggers a second physical Loudcap order.

**Fix** — Add a stripe_events table keyed on event.id, insert-then-process, and return 200 early on conflict. Add unique constraints on stripe_session_id for each money table as a second line of defence.

### SL-008 — No refund or dispute handling anywhere in the platform

**Severity:** critical · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:33`

**Evidence**

```
Handled events: account.updated, checkout.session.completed, customer.subscription.deleted, customer.subscription.updated, customer.subscription.trial_will_end, invoice.payment_succeeded, invoice.payment_failed. No charge.refunded, charge.dispute.created, charge.dispute.closed, charge.refund.updated, or radar.early_fraud_warning.
```

**Detail** — lib/earnings.ts marks tips, super_tips, digital_purchases, campaign_donations and live_stream_tips as settled: () => true - unconditionally. subscription_payments.status has a 'refunded' value in its CHECK constraint that no code ever writes. wishlist_purchases has a 'refunded' status no code ever writes.

**Impact** — A refunded or charged-back payment is counted as creator earnings permanently. Creators are told they earned money that was clawed back, and any payout built on these numbers over-pays. Refund access removal for digital products also never happens.

**Fix** — Handle charge.refunded and charge.dispute.created: write a reversing ledger row (or set status='refunded'), and teach every SOURCES entry in lib/earnings.ts to exclude it.

### SL-009 — Fan subscription upsert writes subscriptions.updated_at, which does not exist

**Severity:** critical · **Category:** schema · **Verification:** CONFIRMED-SCHEMA-DIVERGENCE-RISK

**Location:** `app/api/webhooks/stripe/route.ts:147`

**Evidence**

```
await (supabase as any).from("subscriptions").upsert({
  creator_profile_id: meta.creator_profile_id,
  ...
  updated_at: new Date().toISOString(),
}, { onConflict: "fan_user_id,creator_profile_id" });
```

**Detail** — subscriptions has no updated_at column in 001_initial.sql, in any of 011/018 which alter it, or in lib/database.types.ts (which does reflect the live rename to creator_profile_id, so it is not simply stale on this point). PostgREST rejects unknown columns with 42703. The result is never inspected and the handler returns 200.

**Impact** — A fan pays for a subscription through Stripe and no subscription row is created. The fan gets no access, the creator sees no subscriber, and Stripe is told the webhook succeeded so it never retries. Same defect at app/api/gift-subscription/redeem/route.ts:25.

**Fix** — Remove updated_at from both writes, or add the column in a migration. Then check the upsert error and return 500 so Stripe retries.

### SL-010 — Wishlist purchase insert violates its own CHECK constraint

**Severity:** critical · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:235`

**Evidence**

```
await (supabase as any).from("wishlist_purchases").insert({ ..., status: "pending", ... });
```

**Detail** — supabase/migrations/007_launch_columns.sql:171 constrains status to ('paid_pending_purchase','creator_purchased','refunded'). 'pending' is not a member, so the INSERT is rejected with 23514. The result is not checked and the webhook returns 200.

**Impact** — The fan is charged, wishlist_items is marked purchased, the creator is emailed 'a fan funded your wish list item' - and no purchase record exists. The creator is owed a reimbursement the platform has no record of. lib/earnings.ts would not count it either, since it settles only on paid_pending_purchase / creator_purchased.

**Fix** — Insert status 'paid_pending_purchase'. Check the error and return 500.

### SL-011 — creator_profiles has no RLS statement anywhere in the repository

**Severity:** critical · **Category:** authorization · **Verification:** CONFIRMED-SCHEMA-DIVERGENCE-RISK

**Location:** `supabase/migrations`

**Evidence**

```
grep for 'creator_profiles' combined with 'enable row level security' or 'create policy' across supabase/migrations/*.sql and 01-migrations.sql returns zero matches. The table also has no CREATE TABLE - it is only ever ALTERed.
```

**Detail** — creator_profiles is the central table of the product. Columns include claim_code, claim_expires_at, stripe_account_id, ccbill_account_number, first_ip, last_ip, first_user_agent, last_user_agent, shipping_name, shipping_address, shipping_zip.

**Impact** — If RLS is not enabled out-of-band on the live table, the anon key can SELECT every claim_code and claim any unclaimed creator page (full account takeover via /api/claim), read every creator's Stripe account id and stored IP addresses, and UPDATE any creator's handle, prices or payout account.

**Fix** — Verify immediately with: select relrowsecurity from pg_class where relname='creator_profiles'; then commit a migration that enables RLS with explicit policies and never exposes claim_code to a public-read policy.

### SL-013 — Anon INSERT policies let anyone fabricate paid records across six money tables

**Severity:** critical · **Category:** money · **Verification:** CONFIRMED

**Location:** `supabase/migrations/010_monetization_features.sql`

**Evidence**

```
super_tips_insert (with check true), early_access_insert / early_access_update, gift_sub_insert / gift_sub_update, post_unlocks_service_insert (009), marketplace_orders 'Anyone can create order' (026), social_addback_orders 'Anyone can create an order' (036), social_addback_purchases insert/update (020), creator_referrals insert/update (019), subscriber_referrals insert/update (019).
```

**Detail** — All are TO PUBLIC with USING/WITH CHECK true. lib/earnings.ts counts super_tips, post_unlocks-adjacent revenue and social_addback_orders as settled.

**Impact** — Free access: post_unlocks and early_access_passes bypass paid-content and early-access gating outright. Reporting corruption: forged super_tips inflate a creator's reported earnings; forged referrals feed the credit ladder. gift_subscriptions can be minted and then redeemed for real subscription access.

**Fix** — Drop every '*_service_*' and 'Anyone can create...' write policy. These tables are only ever written by the Stripe webhook under the service role, which bypasses RLS.

### SL-014 — Stripe webhook acknowledges events after failed or partial writes

**Severity:** critical · **Category:** silent-failure · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:848`

**Evidence**

```
return NextResponse.json({ received: true });
```

**Detail** — Only the digital_product branch inspects its write result and returns 500. Every other branch - tip, super_tip, subscription, post_unlock, campaign_donation, wishlist_gift, front_row_message, comment_boost, medal_pack, early_access, gift_subscription, merch - discards the insert result entirely and falls through to a 200.

**Impact** — Every schema defect in this report that lives in the webhook (SL-009, SL-010) is converted into permanent silent data loss, because Stripe is told the event was processed and never retries. Money is taken with no record.

**Fix** — Capture { error } on every webhook write and return a non-2xx when any required write fails, so Stripe's retry schedule can recover it.

### SL-066 — tips.fan_user_id is NOT NULL but guest tipping is supported

**Severity:** critical · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:105`

**Evidence**

```
fan_user_id: meta.fan_user_id || null
Live: tips.fan_user_id uuid | nullable=NO | default=none
/api/tip:24 — "Auth is optional — guests can tip without an account"
```

**Detail** — A guest tip carries no fan_user_id, so the webhook writes NULL into a NOT NULL column.

**Impact** — Even after SL-025 is fixed, guest tips can never be recorded. Guests are an explicitly supported tipping path.

**Fix** — Make tips.fan_user_id nullable, or reject guest tips at checkout. The first matches the product intent.


---

## HIGH (25)

### SL-012 — merch_orders RLS grants anon full read/write, exposing every buyer's shipping address

**Severity:** high · **Category:** privacy · **Verification:** CONFIRMED

**Location:** `supabase/migrations/015_merch.sql:67`

**Evidence**

```
create policy "merch_orders_service_all" on public.merch_orders for all using (true) with check (true);
```

**Detail** — TO PUBLIC. merch_orders holds shipping_name, shipping_line1, shipping_city, shipping_state, shipping_zip, shipping_country, stripe_payment_id, creator_earnings.

**Impact** — Full physical-address PII of every merch buyer on the platform is readable with the public anon key, and every order is modifiable (status, tracking, earnings).

**Fix** — Drop the policy; merch_orders_own already scopes creator and fan access correctly.

### SL-015 — Subscription cancellation writes a status its CHECK constraint forbids

**Severity:** high · **Category:** state-machine · **Verification:** CONFIRMED

**Location:** `app/api/subscription/cancel/route.ts:34`

**Evidence**

```
await (supabase as any).from("subscriptions").update({ status: "cancelling" }).eq("id", subscriptionId);
return NextResponse.json({ ok: true });
```

**Detail** — 001_initial.sql constrains subscriptions.status to ('trialing','active','past_due','canceled','incomplete'). 'cancelling' is not a member, so the UPDATE fails with 23514. The result is not checked and the route returns { ok: true }. Same value written at app/api/subscription/route.ts:37 and lib/billing.ts:186.

**Impact** — The fan is told the subscription was cancelled; the database still says active. lib/billing.ts:196 then searches for status='cancelling' to resume subscriptions and finds nothing, so resumeFanSubscriptionsForCreator is a permanent no-op. Stripe is set to cancel_at_period_end while Spotlightly still counts the subscriber - which drives the creator's billing tier.

**Fix** — Add 'cancelling' to the CHECK constraint in a migration, or use 'canceled'. Check the update error and return 500.

### SL-016 — /api/fan/me - five of six queries reference columns or relationships that do not exist

**Severity:** high · **Category:** schema · **Verification:** CONFIRMED

**Location:** `app/api/fan/me/route.ts:12`

**Evidence**

```
subscriptions: select("... canceled_at, creator:creator_profiles!creator_id(...)")  // canceled_at does not exist
tips: creator_profiles!creator_profile_id  // tips FK column is creator_id
super_tips: select("id, amount, ...")  // column is amount_usd
post_unlocks: post:posts(title, caption, creator:creator_profiles!creator_profile_id(...))  // posts has no title
digital_purchases: product:digital_products(title, creator:creator_profiles!creator_profile_id(...))
```

**Detail** — Every failed query is absorbed by `?? []` at lines 63-76, and totalTipped / totalSpent are computed from the resulting empty arrays.

**Impact** — The fan account page (app/(platform)/account/page.tsx:111) and the public creator page's AudienceRail (app/[creator]/AudienceRail.tsx:50) show a logged-in fan zero subscriptions, zero tips, zero purchases and $0.00 total spent, while returning HTTP 200. A paying fan sees no evidence they ever paid.

**Fix** — Fix each column and FK hint against the real schema, and surface a failure flag the way lib/earnings.ts does rather than defaulting to [].

### SL-017 — /api/analytics reads tips.amount_usd, which does not exist - creator revenue chart is permanently $0

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/analytics/route.ts:39`

**Evidence**

```
.from("tips").select("amount_usd, created_at")
...
days[key].revenue += Number(t.amount_usd ?? 0);
const totalRevenue = (tips ?? []).reduce((s, t) => s + Number(t.amount_usd ?? 0), 0);
```

**Detail** — The tips column is `amount`. lib/earnings.ts:74 documents this exact bug as fixed, but the analytics route was never updated. The PostgREST error makes tips null, `?? []` turns it into an empty array, and the reduce yields 0.

**Impact** — Every creator's analytics pane reports $0 revenue and a flat chart forever, contradicting the dashboard's own earnings card which uses lib/earnings.ts.

**Fix** — Replace this route's bespoke maths with creatorEarnings() from lib/earnings.ts.

### SL-018 — Admin platform revenue counts only tips.platform_receives, which is structurally zero

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/admin/page.tsx:56`

**Evidence**

```
const monthlyRevenue = (tipStats ?? []).reduce((sum, t) => sum + (parseFloat(t.platform_receives) || 0), 0);
```

**Detail** — lib/fees.ts states the platform takes 0% of tips. Actual platform revenue - Super Tip recognition fees, medal pack sales, marketplace platform_fee_usd, merch platform_earnings, comment boosts, Front Row Message share - is not included in this figure at all.

**Impact** — The admin dashboard reports approximately $0 monthly revenue regardless of actual platform earnings. There is no correct platform revenue figure anywhere in the application.

**Fix** — Add a platformRevenue() function to lib/earnings.ts covering every platform-revenue source and use it here.

### SL-019 — Referral billing credits are issued and displayed but never applied to a bill

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/referrals/creator/route.ts:87`

**Evidence**

```
billing_credits is INSERTed here and SELECTed at app/api/referrals/stats/route.ts:33-34. No code anywhere sets applied = true or reduces a Stripe invoice.
```

**Detail** — The dashboard advertises '$29 off next bill' and shows a pending credit balance that will never be redeemed.

**Impact** — Creators are promised a monetary reward the platform has no mechanism to deliver. A recruitment promise the system cannot honour.

**Fix** — Apply pending credits in the billing cycle (Stripe customer balance or a coupon) and set applied = true transactionally.

### SL-020 — Digital product creation writes digital_products.file_type, which does not exist

**Severity:** high · **Category:** schema · **Verification:** CONFIRMED

**Location:** `app/(platform)/dashboard/page.tsx:2847`

**Evidence**

```
file_size_bytes: fileSizeBytes || null, file_type: fileType || null, category,
```

**Detail** — digital_products has file_url, file_name, file_size_bytes - no file_type, in any migration or in database.types.ts.

**Impact** — Every attempt to create a digital product fails with a raw Postgres column error shown to the creator, after they have already uploaded the file to storage. The uploaded object is orphaned in the bucket.

**Fix** — Remove file_type from the insert, or add the column in a migration.

### SL-021 — Channel creation writes channels.is_free, which does not exist

**Severity:** high · **Category:** schema · **Verification:** CONFIRMED

**Location:** `app/(platform)/dashboard/page.tsx:4126`

**Evidence**

```
subscription_price: form.is_free ? 0 : parseFloat(form.subscription_price) || 9.99,
is_free: form.is_free,
```

**Detail** — is_free appears in no migration. The UI reads ch.is_free at lines 4166-4167 to render a Free/paid badge.

**Impact** — Channel creation fails outright, and the free/paid badge would always render 'paid' even if it succeeded.

**Fix** — Add is_free in a migration, or derive it from subscription_price === 0.

### SL-022 — Creator is notified of a tip before any payment occurs

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/tip/route.ts:88`

**Evidence**

```
const session = await stripeRes.json();
// Notify creator
await createNotification({ userId: cp.user_id, type: "tip", title: `New tip - $${amountUsd.toFixed(0)}`, link: "/dashboard" });
```

**Detail** — This fires on checkout session creation, not on payment. The route requires no authentication ('guests can tip without an account'). The Stripe webhook also notifies on genuine success, so real tips notify twice.

**Impact** — Anyone can POST this endpoint in a loop to flood a creator with fake tip notifications and emails. Creators see income that never arrives.

**Fix** — Move all notification to the webhook's tip branch. Add rate limiting to the checkout route.

### SL-023 — Four revenue streams are invisible to lib/earnings.ts and to every payout figure

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `lib/earnings.ts:70`

**Evidence**

```
SOURCES omits: post_unlocks (amount_paid), gift_subscriptions (amount_paid), Front Row Messages, comment boosts.
```

**Detail** — The Stripe webhook records post_unlocks (line 186) and gift_subscriptions (line 386) with real amounts. Front Row Messages compute creatorShare = amount * 0.5 at line 260 and never persist it to any money table - only a messages row. Comment boosts only mutate the comments row.

**Impact** — Creators are underpaid relative to what fans actually spent. Front Row Message revenue in particular has no ledger at all: the 50% creator share exists only in an email body.

**Fix** — Add post_unlocks and gift_subscriptions to SOURCES. Create a ledger table for Front Row Messages and comment boosts.

### SL-024 — lib/earnings.ts filters tips by creator_profile_id and the webhook writes stripe_session_id

**Severity:** high · **Category:** schema · **Verification:** CONFIRMED-SCHEMA-DIVERGENCE-RISK

**Location:** `lib/earnings.ts:79`

**Evidence**

```
{ key: "tips", table: "tips", creatorCol: "creator_profile_id", select: "amount, platform_receives, created_at" }
```

**Detail** — 001_initial.sql defines tips.creator_id and tips.stripe_payment_intent_id, with no creator_profile_id and no stripe_session_id. The live database has documented out-of-band renames (database.types.ts shows subscriptions.creator_profile_id), so tips was likely renamed too - but tips is absent from database.types.ts, so nothing in the repository confirms it. The webhook insert at line 104 uses both creator_profile_id and stripe_session_id.

**Impact** — If the rename did not reach tips, every tip insert fails silently (SL-014) and the dashboard's Tips row is flagged failed. This is the single highest-value item to verify against the live database.

**Fix** — Run: select column_name from information_schema.columns where table_name='tips'; then regenerate lib/database.types.ts and commit a migration that records the historical renames.

### SL-025 — tips.creator_receives and platform_receives are NOT NULL with no default and are never supplied

**Severity:** high · **Category:** money · **Verification:** CONFIRMED-SCHEMA-DIVERGENCE-RISK

**Location:** `app/api/webhooks/stripe/route.ts:104`

**Evidence**

```
await (supabase as any).from("tips").insert({ fan_user_id, creator_profile_id, amount, stripe_session_id });
```

**Detail** — 001_initial.sql:120 declares creator_receives and platform_receives as decimal(10,2) not null with no default. The insert omits both. lib/earnings.ts computes tip net as amount - platform_receives.

**Impact** — If the NOT NULL constraints still hold, every tip insert fails with 23502 and no tip is ever recorded. If they were relaxed live, platform_receives is NULL and net silently equals gross - which happens to be correct at 0% but is accidental.

**Fix** — Supply both columns explicitly in the webhook insert.

### SL-026 — Stripe subscription statuses are written straight through into a narrower CHECK constraint

**Severity:** high · **Category:** state-machine · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:623`

**Evidence**

```
await supabase.from("subscriptions").update({ status: sub.status }).eq("stripe_subscription_id", sub.id);
```

**Detail** — subscriptions.status is constrained to ('trialing','active','past_due','canceled','incomplete'). Stripe also emits 'unpaid', 'incomplete_expired' and 'paused'. Any of those makes the UPDATE fail with 23514. The result is not checked.

**Impact** — A subscription that goes unpaid or is paused at Stripe stays 'active' in Spotlightly. The fan keeps paid access without paying, and the inflated active-subscriber count drives the creator's platform billing tier upward at invoice.payment_succeeded (line 771).

**Fix** — Map Stripe statuses onto the allowed set explicitly, as the creator_billing branch already does at line 629, and check the error.

### SL-027 — Campaign totals use a read-modify-write and lose concurrent donations

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:215`

**Evidence**

```
const newRaised = Number(camp.raised_amount) + amount;
await (supabase as any).from("campaigns").update({ raised_amount: newRaised, status: newStatus }).eq("id", meta.campaign_id);
```

**Detail** — Two donations processed concurrently both read the same raised_amount and the second write overwrites the first.

**Impact** — Campaign progress under-reports during any burst of donations, and a campaign can miss its 'funded' transition. The donation rows survive, so campaigns.raised_amount permanently disagrees with sum(campaign_donations.amount).

**Fix** — Replace with an atomic increment in a SQL function, or derive raised_amount from the donations table rather than storing it.

### SL-028 — Medal balance credit uses a read-modify-write and loses concurrent purchases

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:362`

**Evidence**

```
const { data: bal } = await ...select("balance, lifetime_purchased")...
await ...upsert({ balance: (bal?.balance ?? 0) + medals, ... }, { onConflict: "fan_user_id" });
```

**Detail** — Same lost-update pattern. Note migration 033 provides award_medal as a SECURITY DEFINER function that does this atomically; the webhook does not use it.

**Impact** — A fan buying two medal packs in quick succession is credited for one. Paid-for goods silently lost.

**Fix** — Use an atomic SQL increment, following the pattern already established in 033_medal_balance.sql.

### SL-029 — tips table is publicly readable

**Severity:** high · **Category:** privacy · **Verification:** CONFIRMED

**Location:** `01-migrations.sql:160`

**Evidence**

```
create policy "Tips publicly readable" on public.tips for select using (true);
```

**Detail** — TO PUBLIC. tips holds fan_user_id, amount, message and stripe_payment_intent_id.

**Impact** — Anyone with the anon key can enumerate every tip on the platform: who tipped whom, how much, and the message text. Fan tipping behaviour is private information, especially on adult creator pages.

**Fix** — Scope to the creator who received it and the fan who sent it, following the merch_orders_own pattern.

### SL-030 — Next.js 14.2.3 carries a critical cache-poisoning advisory

**Severity:** high · **Category:** dependency · **Verification:** CONFIRMED

**Location:** `package.json:24`

**Evidence**

```
npm audit: 'next  critical  Next.js Cache Poisoning'. Fix available in 14.2.35. Also high: sharp <0.35.0 (libvips CVEs), ws 8.0.0-8.20.1 (uninitialised memory disclosure), form-data (CRLF injection).
```

**Detail** — 19 advisories total across the tree: 2 critical, 13 high, 4 moderate. next, sharp and ws are production dependencies.

**Impact** — Cache poisoning on a Next.js deployment can serve attacker-influenced content to other users.

**Fix** — Upgrade next to 14.2.35 and sharp to 0.35.x, then re-run the full build and test suite.

### SL-031 — Legacy Bunny-hosted digital products are served as unsigned public URLs

**Severity:** high · **Category:** authorization · **Verification:** RISK

**Location:** `app/api/digital/download/route.ts:68`

**Evidence**

```
} else {
  // Legacy products still on BunnyCDN.
  target = purchase.product.file_url;
}
```

**Detail** — digital_products.storage_provider defaults to 'bunny' for all pre-062 rows. CLAUDE.md records that bunnySignUrl() in lib/bunny.ts is a no-op until BUNNY_TOKEN_KEY is set and token auth is enabled on the pull zone.

**Impact** — Every legacy paid digital product is a permanent public URL. Once one buyer shares it, the product is free to everyone, with no purchase check.

**Fix** — Enable Bunny token authentication and sign these URLs, or migrate legacy files into the private Supabase bucket.

### SL-032 — checkout.session.completed is trusted without checking payment_status

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:67`

**Evidence**

```
if (event.type === "checkout.session.completed") { const s = event.data.object; ... }
```

**Detail** — For asynchronous payment methods the session completes with payment_status 'unpaid' or 'processing'; checkout.session.async_payment_succeeded and async_payment_failed are the events that resolve it, and neither is handled.

**Impact** — Unpaid or subsequently failed payments are recorded as completed revenue and fulfilled - digital downloads delivered, merch ordered from Loudcap, medals credited.

**Fix** — Require s.payment_status === 'paid' before any write, and handle the async_payment_* events.

### SL-033 — Three disagreeing sources of admin identity

**Severity:** high · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `components/site-header.tsx:5`

**Evidence**

```
const ADMIN_ID = "9b5ac2dc-ea4f-4bac-b2ef-70608562568a";  // also app/(platform)/dashboard/page.tsx:56
lib/admin.ts: user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
005_admin_tables.sql / 01-migrations.sql: using (auth.uid() = '9b5ac2dc-...'::uuid)
```

**Detail** — Server authorization uses an email env var; RLS policies on admin_messages, coupons and platform_settings use a hardcoded UUID; two client components use the same hardcoded UUID for UI gating.

**Impact** — Changing the admin via NEXT_PUBLIC_ADMIN_EMAIL - documented as an env-var-only change - grants page access while every admin RLS policy silently returns zero rows. The credentials page appears empty rather than forbidden, which reads as data loss.

**Fix** — Choose one source of truth. An admin_users table checked by both isAdmin() and the RLS policies is the least surprising.

### SL-034 — 150 database writes discard their result entirely

**Severity:** high · **Category:** silent-failure · **Verification:** CONFIRMED

**Location:** `audit/production-integrity/_tools/silent.json`

**Evidence**

```
Machine count across app/, lib/, components/: 150 insert/update/upsert/delete calls where no { error } is destructured within three lines, and 38 API routes that perform writes without referencing an error result anywhere in the file.
```

**Detail** — The pattern is systemic rather than isolated. Combined with RLS denials (which surface as errors, not exceptions) any write blocked by a policy is indistinguishable from success.

**Impact** — Every RLS or constraint failure in the application becomes a silent no-op behind a success response. This is the mechanism behind SL-010, SL-015 and SL-026.

**Fix** — Adopt a checked write helper in lib/ and require its use for any write on a money, auth or permission path.

### SL-035 — Early access pass renewals are never recorded as revenue

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:713`

**Evidence**

```
const { data: fanSub } = await ...from("subscriptions").select(...).eq("stripe_subscription_id", invoice.subscription).maybeSingle();
if (fanSub?.creator_profile_id && ...) { insert into subscription_payments }
```

**Detail** — Early access passes are stored in early_access_passes with their own stripe_subscription_id and no matching subscriptions row, so the ledger lookup returns null and no subscription_payments row is written.

**Impact** — Recurring early-access revenue is invisible to creator earnings, admin reporting and any payout calculation, on every renewal.

**Fix** — Fall back to early_access_passes when the subscriptions lookup misses, and record the ledger row against that creator.

### SL-064 — Seven Anthropic-backed routes are completely unauthenticated

**Severity:** high · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `app/api/studio/build/route.ts:134`

**Evidence**

```
No getUser(), isAdmin(), cron secret or signature check in: app/api/advisor/bio, app/api/advisor/signup, app/api/campaigns/assist, app/api/tiers/assist, app/api/posts/tags, app/api/onboarding, app/api/studio/build. Each POSTs to the Anthropic API, e.g. model: 'claude-haiku-4-5-20251001', max_tokens: 2600.
```

**Detail** — These routes accept a request body and forward it into a model call billed to ANTHROPIC_API_KEY. There is no session requirement, no rate limit, and no per-user quota.

**Impact** — Unmetered, remotely triggerable spend on the platform's Anthropic account. A trivial loop against /api/studio/build runs up the bill without limit. The request body also reaches the model prompt directly, so these are the natural targets for prompt injection against any downstream use of the output.

**Fix** — Require an authenticated session on all seven, and add per-user rate limiting. /api/studio/build writes creator page content and should additionally be admin- or owner-gated.

### SL-065 — lib/earnings.ts settles wishlist revenue on statuses that cannot exist

**Severity:** high · **Category:** money · **Verification:** CONFIRMED

**Location:** `lib/earnings.ts:169`

**Evidence**

```
settled: (r) => ["paid_pending_purchase", "creator_purchased"].includes(r.status)
Live CHECK: wishlist_purchases.status IN ('pending','transferred','refunded')
```

**Detail** — Neither settle value is permitted by the live constraint, so no wishlist_purchases row can ever satisfy it. The inverse of SL-010: the webhook is correct and the earnings module is wrong.

**Impact** — Wishlist revenue is structurally $0 in every earnings figure, on every surface, permanently.

**Fix** — Settle on ['pending','transferred'] and exclude 'refunded'.

### SL-067 — live_streams public-read policy exposes stream_key and rtmp_url

**Severity:** high · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `supabase/migrations/010_monetization_features.sql`

**Evidence**

```
live_streams_select — SELECT {public} using=true. Live columns include stream_key, rtmp_url, bunny_stream_id, playback_url.
```

**Detail** — Not in the original audit. stream_key and rtmp_url are the credentials required to broadcast to a creator's stream.

**Impact** — Anyone with the anon key can read the broadcast credentials for any creator's live stream and stream as that creator.

**Fix** — Replace with a column-restricted view for public consumption. A using(status='live') narrowing is a stopgap, not a fix — it still exposes keys for live streams.


---

## MEDIUM (20)

### SL-036 — creator_profiles has no CREATE TABLE in version control

**Severity:** medium · **Category:** schema · **Verification:** CONFIRMED

**Location:** `supabase/migrations/004_remove_opening_act.sql:7`

**Evidence**

```
The first reference to creator_profiles is an UPDATE in 004. 001_initial.sql creates public.creators instead. Later migrations only ALTER creator_profiles.
```

**Detail** — A clean `supabase db reset` cannot reproduce the production database. 47 columns come from ALTERs; the base columns exist only in the live database and partially in lib/database.types.ts.

**Impact** — No reproducible environment, so no integration testing against a real schema is possible. It is also why every column reference in this audit needed manual adjudication.

**Fix** — Dump the live schema and commit it as a baseline migration.

### SL-037 — FKs on posts, channels and subscriptions still point at the legacy creators table

**Severity:** medium · **Category:** schema · **Verification:** CONFIRMED

**Location:** `supabase/migrations/001_initial.sql:30`

**Evidence**

```
posts.creator_id uuid references public.creators(id); channels.creator_id references public.creators(id); subscriptions.creator_id references public.creators(id); posts.collab_creator_id references public.creators(id)
```

**Detail** — The application uses creator_profile_id on all three (357 occurrences of creator_profile_id versus 39 of creator_id across app/, lib/, components/).

**Impact** — Committed migrations describe a schema the application does not use. Any new engineer reading supabase/migrations will write incorrect queries.

**Fix** — Commit the historical rename migrations.

### SL-038 — subscription_payments and wishlist_purchases have a 'refunded' state no code can reach

**Severity:** medium · **Category:** state-machine · **Verification:** CONFIRMED

**Location:** `supabase/migrations/063_subscription_payments.sql:28`

**Evidence**

```
status text not null default 'paid' check (status in ('paid', 'refunded'))
```

**Detail** — No code path writes 'refunded' to either table, because no refund event is handled (SL-008).

**Impact** — The schema implies refund support that does not exist, which is misleading during incident response.

**Fix** — Implement the refund path; the schema is already correct.

### SL-039 — Cron routes fail open when CRON_SECRET is unset

**Severity:** medium · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `app/api/cron/billing-dunning/route.ts:10`

**Evidence**

```
if (auth !== `Bearer ${process.env.CRON_SECRET}`) { ... }
```

**Detail** — With CRON_SECRET unset the comparison target becomes the literal string 'Bearer undefined', which an attacker can send. Same pattern in cron/live-billing and cron/publish-scheduled.

**Impact** — In any environment missing the variable, dunning, live billing and scheduled publishing can be triggered by anyone.

**Fix** — Return 503 when the secret is unset, as the Stripe webhook already does for STRIPE_WEBHOOK_SECRET.

### SL-040 — Printful webhook secret is passed in the URL query string

**Severity:** medium · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/printful/route.ts:44`

**Evidence**

```
Documented setup: https://spotlightly.app/api/webhooks/printful?key=YOUR_SECRET
```

**Detail** — Query strings are recorded in access logs, proxy logs and Vercel request logs.

**Impact** — The shared secret is likely to be persisted in plaintext in several log stores. The route does correctly key updates off its own stored loudcap_order_id, which limits the damage.

**Fix** — Move the secret to a request header.

### SL-041 — Digital download count increments non-atomically, so limits are bypassable

**Severity:** medium · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/digital/download/route.ts:71`

**Evidence**

```
await ...update({ download_count: purchase.download_count + 1 }).eq("id", purchase.id);
```

**Detail** — Concurrent requests all read the same count and write the same incremented value.

**Impact** — download_limit is enforceable only against serial requests. Parallel requests get unlimited downloads.

**Fix** — Use an atomic SQL increment and check the returned value before minting the signed URL.

### SL-042 — Two independent referral systems with separate storage and reward logic

**Severity:** medium · **Category:** referral · **Verification:** CONFIRMED

**Location:** `app/api/referrals/creator/route.ts:1`

**Evidence**

```
System A: creator_referrals / subscriber_referrals / billing_credits, driven by unauthenticated REST routes, rewards $29 credits.
System B: referral_codes / referral_signups / referral_rewards_claimed, driven by SECURITY DEFINER RPCs from 034, rewards medals and a shirt.
```

**Detail** — They share no attribution data. A single signup can be recorded in both, one, or neither. System B is well built - unique referred_user_id, self-referral check, idempotent reward rungs. System A has none of those controls.

**Impact** — Referral reporting cannot be reconciled, and the weaker system is the one that pays cash.

**Fix** — Retire System A and express the $29 credit as another rung on System B's ladder.

### SL-043 — Subscriber referrals are recorded on every page view with no deduplication

**Severity:** medium · **Category:** referral · **Verification:** CONFIRMED

**Location:** `app/[creator]/ReferralTracker.tsx:11`

**Evidence**

```
fetch("/api/referrals/subscriber", { method: "POST", body: JSON.stringify({ referrerHandle: creatorHandle }) });
```

**Detail** — Fires from a useEffect on every mount when ?ref= is present. The route's else-branch inserts a fresh subscriber_referrals row each time with fan_user_id null.

**Impact** — Reloading a creator page N times creates N referral rows. The dashboard's referral totals and conversion rate are meaningless.

**Fix** — Deduplicate on (referrer_profile_id, fan_user_id) with a unique constraint, and skip the call for anonymous visitors.

### SL-044 — Referral verification requires only a session, not a confirmed email

**Severity:** medium · **Category:** referral · **Verification:** RISK

**Location:** `app/api/referrals/me/route.ts:12`

**Evidence**

```
await (supabase as any).rpc("verify_referral", { p_referred: user.id });
```

**Detail** — The migration comment states rewards fire on 'VERIFIED referrals (referred account confirms + opens the app)', but the only check is that a session exists. The RPC does not consult email_confirmed_at.

**Impact** — If Supabase is configured to issue sessions before email confirmation, a referrer can self-verify fake signups and climb the reward ladder.

**Fix** — Check user.email_confirmed_at in the route, or read auth.users inside verify_referral.

### SL-045 — referral_status and verify_referral are granted to authenticated with an arbitrary uuid parameter

**Severity:** medium · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `supabase/migrations/034_referral_rewards.sql:213`

**Evidence**

```
grant execute on function public.referral_status(uuid) to authenticated, service_role;
grant execute on function public.verify_referral(uuid) to authenticated, service_role;
```

**Detail** — Both are SECURITY DEFINER and take the target user id as a parameter rather than using auth.uid(). The application routes pass user.id correctly, but the grant permits any authenticated user to call them with any uuid directly through PostgREST.

**Impact** — Any logged-in user can read any other user's referral code and progress, and can mark another user's pending referral verified - firing that referrer's rewards early.

**Fix** — Use auth.uid() inside the functions instead of a caller-supplied parameter, or revoke from authenticated and call only under the service role.

### SL-046 — Tip route calls auth.admin on a non-service client, so creator tip emails never send

**Severity:** medium · **Category:** silent-failure · **Verification:** CONFIRMED

**Location:** `app/api/tip/route.ts:92`

**Evidence**

```
const { data: { user: creatorUser } } = await (supabase as any).auth.admin.getUserById(cp.user_id).catch(() => ({ data: { user: null } }));
```

**Detail** — supabase here is the cookie-bound anon client from createClient(). The admin API requires the service role key; the call fails and the .catch collapses it to null.

**Impact** — The creator tip email is silently never sent, and the failure leaves no trace.

**Fix** — Use createServiceClient() for the admin lookup, or move the notification into the webhook (SL-022).

### SL-047 — Failed product save orphans the uploaded file in the storage bucket

**Severity:** medium · **Category:** storage · **Verification:** CONFIRMED

**Location:** `app/(platform)/dashboard/page.tsx:2843`

**Evidence**

```
uploadFile() writes to the digital-products bucket and sets local state; saveProduct() inserts the row separately and returns early on error without removing the object.
```

**Detail** — Given SL-020 the insert currently always fails, so every upload attempt leaves a 500 MB-capable object behind.

**Impact** — Unbounded storage growth from orphaned files with no reconciliation process.

**Fix** — Remove the uploaded object when the insert fails, and add a periodic sweep for bucket objects with no matching digital_products row.

### SL-048 — No MIME type or extension allowlist on digital product uploads

**Severity:** medium · **Category:** storage · **Verification:** CONFIRMED

**Location:** `app/(platform)/dashboard/page.tsx:2806`

**Evidence**

```
const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
await supabase.storage.from("digital-products").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
```

**Detail** — contentType is taken from the browser. The bucket is private and downloads are served through a signed URL with a download disposition, which mitigates stored XSS, but nothing constrains what is uploaded. The file input's accept attribute is client-side only.

**Impact** — The bucket can be used to host arbitrary content up to 500 MB per object.

**Fix** — Enforce an allowlist server-side and set allowed_mime_types on the bucket.

### SL-049 — account.updated never revokes stripe_onboarded

**Severity:** medium · **Category:** state-machine · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:56`

**Evidence**

```
if (acct?.id && acct.details_submitted && acct.charges_enabled) { update({ stripe_onboarded: true }) }
```

**Detail** — There is no else branch. A Connect account that later loses charges_enabled - restricted, disabled, or under review - keeps stripe_onboarded true.

**Impact** — Tip and subscription checkouts continue to be offered against an account that can no longer accept charges, so payments fail at Stripe after the fan has committed.

**Fix** — Set stripe_onboarded to the boolean value of the condition rather than only writing true.

### SL-050 — No currency validation anywhere in the money path

**Severity:** medium · **Category:** money · **Verification:** RISK

**Location:** `app/api/webhooks/stripe/route.ts:414`

**Evidence**

```
const priceTotal = (s.amount_total ?? 0) / 100;
```

**Detail** — Every amount is divided by 100 and stored as USD without inspecting s.currency or invoice.currency. Checkout routes hardcode currency=usd, so today this is consistent.

**Impact** — Latent: enabling any non-USD price, or a zero-decimal currency such as JPY, silently corrupts every stored amount by a factor of 100.

**Fix** — Assert currency === 'usd' in the webhook and reject otherwise.

### SL-051 — timingSafeEqual throws on a length mismatch, turning a bad signature into a 500

**Severity:** medium · **Category:** silent-failure · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:20`

**Evidence**

```
return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
```

**Detail** — Node throws RangeError when the buffers differ in length. A malformed v1 produces an unhandled exception rather than the intended 400.

**Impact** — Fails closed, so not a security hole, but it converts a clear 'invalid signature' into an opaque 500 and pollutes error monitoring.

**Fix** — Compare lengths first and return false.

### SL-052 — npm run typecheck fails against a stale .next/types directory

**Severity:** medium · **Category:** reliability · **Verification:** CONFIRMED

**Location:** `tsconfig.json:1`

**Evidence**

```
npx tsc --noEmit exits 1 with six TS2307 errors referencing app/api/admin/acquisition/run/route.js, app/api/cron/acquisition/route.js and app/api/webhooks/resend/route.js - none of which exist in the repository.
```

**Detail** — .next is gitignored, so CI (which checks out fresh) is unaffected. Excluding .next, the typecheck is clean. Deleted routes leave orphaned generated type files behind.

**Impact** — The command CLAUDE.md names as a gate fails on any developer machine with a stale build, training people to ignore its output.

**Fix** — Exclude .next from tsconfig, or clean it as part of the typecheck script.

### SL-053 — 01-migrations.sql recreates parental_tokens with an ineffective read policy

**Severity:** medium · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `01-migrations.sql:130`

**Evidence**

```
create policy "Token holders can read" on public.parental_tokens for select using (revoked_at is null);
```

**Detail** — The policy is not scoped to the token at all - it grants read of every non-revoked row. Migration 004 drops this table, but 01-migrations.sql is applied by hand and is idempotent, so running it after 004 restores both table and policy.

**Impact** — If the bundle is ever re-run, every child_user_id and parent_email becomes readable with the anon key.

**Fix** — Remove the parental_tokens section from 01-migrations.sql; it was deliberately dropped in 004.

### SL-054 — CLAUDE.md documents creator_type values the database forbids

**Severity:** medium · **Category:** documentation · **Verification:** CONFIRMED

**Location:** `CLAUDE.md`

**Evidence**

```
CLAUDE.md: "creator_type (sfw | adult | young)". Migration 004: check (creator_type in ('spotlight', 'backstage')). Application code writes 'spotlight' and 'backstage'.
```

**Detail** — The code and the constraint agree; the documentation is wrong. CLAUDE.md also states date_of_birth and parental_consent_at exist for compliance, but 004 drops both columns.

**Impact** — The onboarding document for engineers and agents describes a schema that would be rejected by the database, and claims age-verification columns that no longer exist.

**Fix** — Correct CLAUDE.md, and confirm separately whether dropping the age-consent columns was intended.

### SL-068 — anon and authenticated hold TRUNCATE and DELETE on every audited table

**Severity:** medium · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `supabase`

**Evidence**

```
information_schema.role_table_grants: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE — identical for anon and authenticated across all 22 audited tables.
```

**Detail** — Supabase default grants. TRUNCATE is not subject to RLS. PostgREST never issues TRUNCATE, so it is not reachable with the anon key today.

**Impact** — Not currently exploitable, but the grant surface is far wider than the policy surface. RLS is the sole control on every table, and any future direct-connection path would be catastrophic.

**Fix** — Revoke TRUNCATE, TRIGGER and REFERENCES from anon and authenticated; grant only the DML each role genuinely needs.


---

## LOW (10)

### SL-055 — Six tables have RLS enabled with zero policies

**Severity:** low · **Category:** reliability · **Verification:** CONFIRMED

**Location:** `supabase/migrations`

**Evidence**

```
records_2257, referral_invite_sends, creator_media_analysis, email_opt_outs, creator_prospects, prospect_outreach
```

**Detail** — RLS with no policies denies all access to anon and authenticated. All six are written only under the service role, so this is correct-by-accident rather than wrong.

**Impact** — None today. Any future attempt to read these from a user session will fail with an empty result rather than an error.

**Fix** — Add an explicit deny-all comment so the intent is legible.

### SL-056 — Nine tables have no RLS enabled

**Severity:** low · **Category:** reliability · **Verification:** CONFIRMED-SCHEMA-DIVERGENCE-RISK

**Location:** `supabase/migrations`

**Evidence**

```
ccbill_subscriptions, referrals, live_offers, live_offer_claims, moderation_events, pii_blocks, creator_profiles, live_viewer_pings, live_usage_charges
```

**Detail** — creator_profiles is tracked separately as SL-011. moderation_events and pii_blocks hold moderation and PII-detection records. live_usage_charges holds creator billing amounts.

**Impact** — If RLS is genuinely absent live, moderation history and PII-block records are readable and writable with the anon key.

**Fix** — Enable RLS on all nine with explicit policies.

### SL-057 — Fourteen tables are defined but never referenced by application code

**Severity:** low · **Category:** dead-code · **Verification:** CONFIRMED

**Location:** `supabase/migrations`

**Evidence**

```
creators, wallets, ccbill_subscriptions, referrals, live_offers, live_offer_claims, pii_blocks, records_2257, fan_activity, social_addback_purchases, medal_awards, referral_rewards_claimed, referral_invite_sends, parental_tokens
```

**Detail** — medal_awards is written by the apply_medal_award trigger and read through the creator_medal_month view, so it is live. referral_rewards_claimed is written by RPCs. The remainder appear genuinely dead.

**Impact** — Dead schema enlarges the audit surface and misleads readers about what the platform does.

**Fix** — Drop what is dead, and note the trigger/RPC-only tables in a comment.

### SL-058 — 47 empty catch blocks and 32 promise-swallowing .catch handlers

**Severity:** low · **Category:** silent-failure · **Verification:** CONFIRMED

**Location:** `audit/production-integrity/_tools/silent.json`

**Evidence**

```
Machine count across app/, lib/, components/. Examples: app/api/webhooks/stripe/route.ts:30 (notifyCreator), :87, :653, :763.
```

**Detail** — Most are on genuinely non-fatal notification paths and are annotated as such. They are listed for completeness rather than as individual defects.

**Impact** — Reduced observability. Notification and email failures leave no trace anywhere.

**Fix** — Log at minimum; the digital-purchase delivery path at line 466 is a good model.

### SL-059 — 34 floating promises not awaited

**Severity:** low · **Category:** reliability · **Verification:** CONFIRMED

**Location:** `audit/production-integrity/_tools/silent.json`

**Evidence**

```
Machine count of unawaited supabase/fetch/send* calls in statement position.
```

**Detail** — In a serverless function the runtime may freeze before an unawaited promise settles.

**Impact** — Intermittent, unreproducible loss of notifications and secondary writes under load.

**Fix** — Await them, or use waitUntil where fire-and-forget is genuinely intended.

### SL-060 — Unbounded queries on admin and import listing paths

**Severity:** low · **Category:** api-contract · **Verification:** CONFIRMED

**Location:** `app/api/marketplace/import/drafts/route.ts:20`

**Evidence**

```
.limit(500) on drafts and .limit(50) on runs; several admin pages select with no limit at all.
```

**Detail** — Import drafts are capped but with no pagination beyond the cap, so rows beyond 500 are silently invisible.

**Impact** — Silent truncation reads as 'nothing more to review'.

**Fix** — Add explicit pagination and surface the total count.

### SL-061 — Internal error text returned to clients

**Severity:** low · **Category:** api-contract · **Verification:** CONFIRMED

**Location:** `app/api/social-posts/route.ts:24`

**Evidence**

```
if (error) return NextResponse.json({ error: error.message }, { status: 500 });
```

**Detail** — Raw PostgREST messages include column and table names. Same pattern in dashboard client code via setErr(error.message).

**Impact** — Schema disclosure. CLAUDE.md explicitly asks that internal error text not leak to fans.

**Fix** — Log the detail server-side, return a generic message.

### SL-062 — /api/social-posts authorizes on getSession() rather than getUser()

**Severity:** low · **Category:** authorization · **Verification:** CONFIRMED

**Location:** `app/api/social-posts/route.ts:28`

**Evidence**

```
Uses auth.getSession() for the POST/DELETE paths.
```

**Detail** — getSession() reads the cookie without revalidating the JWT against the auth server. Supabase documents getUser() as the correct choice for server-side authorization.

**Impact** — Weaker guarantee than every other route in the codebase; relies on cookie integrity alone.

**Fix** — Switch to getUser().

### SL-063 — Front Row Message creator share is a magic number, not a lib/fees.ts constant

**Severity:** low · **Category:** money · **Verification:** CONFIRMED

**Location:** `app/api/webhooks/stripe/route.ts:260`

**Evidence**

```
const creatorShare = Math.round(amount * 0.5 * 100) / 100;
```

**Detail** — lib/fees.ts is documented as the single source of truth for fee handling. This 50% split appears nowhere in it, and the computed value is never persisted.

**Impact** — The split can drift from the rest of the platform, and there is no record of what was owed.

**Fix** — Move the constant into lib/fees.ts and persist the share alongside a ledger row (see SL-023).

### SL-069 — social_addback_purchases does not exist in production

**Severity:** low · **Category:** dead-code · **Verification:** CONFIRMED

**Location:** `supabase/migrations/020_social_addbacks.sql`

**Evidence**

```
Absent from information_schema.tables, pg_class and pg_policies in production. The live table is social_addback_orders.
```

**Detail** — Migration 020 defines a table that was never applied or was later dropped.

**Impact** — Dead migration; two of the 20 predicted permissive policies do not exist because their table does not.

**Fix** — Remove from the migration history when the baseline schema is committed (SL-036).
