# Money Flow Map (Phase 4)

Every way money enters or leaves Spotlightly, traced from the Stripe event through the database
to the dashboard, admin console and payout.

## Master table

| Source | Stripe trigger | Table | Gross field | Creator net field | Platform rev field | Settlement condition | In `earnings.ts` | Idempotent | Refund reversal |
|---|---|---|---|---|---|---|---|---|---|
| Tips | `checkout.session.completed` type=`tip` | `tips` | `amount` | `amount - platform_receives` | none (0%) | **unconditional** | ✅ | ❌ plain insert | ❌ |
| Super Tips | `…completed` type=`super_tip` | `super_tips` | `amount_usd` | `creator_receives` | `platform_receives` (recognition fee) | **unconditional** | ✅ | ❌ plain insert | ❌ |
| Subscriptions (recurring) | `invoice.payment_succeeded` | `subscription_payments` | `gross_usd` | `creator_receives` | `platform_fee_usd` | `status='paid'` | ✅ | ✅ unique `stripe_invoice_id` | ❌ (`refunded` state unreachable) |
| Subscriptions (initial) | `…completed` type=`subscription` | `subscriptions` | `price` | — | — | state only, no ledger | ➖ state row | ⚠️ upsert, **but write fails** (SL-009) | ❌ |
| Digital purchases | `…completed` type=`digital_product` | `digital_purchases` | `amount_paid` | `creator_receives` | `platform_fee` (0) | **unconditional** | ✅ | ❌ plain insert | ❌ |
| Campaign donations | `…completed` type=`campaign_donation` | `campaign_donations` | `amount` | `amount` (100%) | none | **unconditional** | ✅ | ❌ plain insert | ❌ |
| Live stream tips | `/api/live/tip` | `live_stream_tips` | `amount_usd` | `amount_usd` | none | **unconditional** | ✅ | ❌ | ❌ |
| Marketplace orders | `…completed` | `marketplace_orders` | `amount_usd` | `amount_usd - platform_fee_usd` | `platform_fee_usd` | `status in (paid, shipped, delivered)` | ✅ | ❌ | ❌ |
| Merch orders | `…completed` type=`merch` | `merch_orders` | `retail_price` | `creator_earnings` | `platform_earnings` | `stripe_payment_id` set **and** status not cancelled/refunded | ✅ | ❌ plain insert | ⚠️ partial — Printful webhook can set `refunded` |
| Wishlist purchases | `…completed` type=`wishlist_gift` | `wishlist_purchases` | `total_charged` | `item_price` | `service_fee` | `status in (paid_pending_purchase, creator_purchased)` | ✅ | ❌ | ❌ |
| Social add-backs | `…completed` type=`social_addback` | `social_addback_orders` | `amount_usd` | `amount_usd` | none | `status in (paid, delivered)` | ✅ | ✅ guards on `status='pending'` | ❌ |
| **Post unlocks** | `…completed` type=`post_unlock` | `post_unlocks` | `amount_paid` | — | — | — | ❌ **MISSING** | ✅ upsert | ❌ |
| **Gift subscriptions** | `…completed` type=`gift_subscription` | `gift_subscriptions` | `amount_paid` | — | — | — | ❌ **MISSING** | ❌ | ❌ |
| **Front Row Messages** | `…completed` type=`front_row_message` | **none** | — | computed 50%, **never stored** | — | — | ❌ **NO LEDGER** | ❌ | ❌ |
| **Comment boosts** | `…completed` type=`comment_boost` | `comments` (flag only) | `boost_amount_usd` | — | 100% platform | — | ❌ **NO LEDGER** | ❌ | ❌ |
| Medal packs | `…completed` type=`medal_pack` | `medal_purchases` | `amount_usd` | — | 100% platform | — | ➖ correctly excluded (platform revenue) | ❌ | ❌ |
| Early access passes | `…completed` type=`early_access` | `early_access_passes` | — | — | — | state only | ❌ **renewals never recorded** (SL-035) | ✅ upsert | ❌ |
| Creator platform billing | `…completed` type=`platform_subscription`, `invoice.payment_succeeded` | `creator_billing` | — | — | the plan fee | `status` | ➖ platform revenue, uncounted | ✅ upsert | ❌ |
| Live usage charges | cron `/api/cron/live-billing` | `live_usage_charges` | — | — | infra cost billed to creator | — | ❌ not counted | ❌ | ❌ |
| **Refunds** | — | — | — | — | — | — | ❌ **NOT HANDLED** | — | — |
| **Disputes** | — | — | — | — | — | — | ❌ **NOT HANDLED** | — | — |
| **Creator payouts** | Stripe Connect destination charges / daily automatic payouts | **none** | — | — | — | — | ❌ **no payout table, no payout function** | — | — |
| Referral rewards (cash) | — | `billing_credits` | `amount_usd` | — | platform cost | `applied` | ❌ never applied (SL-019) | ❌ | ❌ |
| Referral rewards (medals) | — | `referral_rewards_claimed` | — | — | platform cost | — | ➖ | ✅ unique (referrer, milestone) | ❌ |

## Answers to the required questions

**Can double count?** Yes — every source marked ❌ in *Idempotent*: tips, super tips, digital
purchases, campaign donations, wishlist purchases, merch orders, medal packs, gift subscriptions,
live stream tips. Stripe retries on any non-2xx and can redeliver by design. Compounded by
SL-006: a captured request can be replayed deliberately, forever. → **SL-006, SL-007**

**Can be missed?** Yes.
- Fan subscriptions: the upsert writes a non-existent column and the error is discarded (SL-009).
- Wishlist purchases: the insert violates its own CHECK constraint (SL-010).
- Early access renewals: the ledger lookup misses and no row is written (SL-035).
- Every webhook write, because the handler returns 200 regardless (SL-014).

**Has no ledger?** Front Row Messages (a 50% creator share computed at
`app/api/webhooks/stripe/route.ts:260` and stored nowhere), comment boosts, and **creator payouts** —
there is no payout table, no payout record, and no reconciliation against Stripe transfers.

**Uses fulfilment state as payment state?** `merch_orders` is the one source that gets this
right, and says so: `settled: (r) => !!r.stripe_payment_id && !["cancelled","refunded"].includes(r.status)`.
`marketplace_orders` and `social_addback_orders` use fulfilment status (`shipped`, `delivered`) as
a proxy for payment, which works only because nothing ever ships unpaid.

**Counts pending or failed payments?** Yes. `checkout.session.completed` is trusted without
checking `payment_status`, and the async payment events are unhandled — so an asynchronous
payment method that later fails is still recorded and fulfilled (SL-032).

**Does not reverse refunds?** All of them. No refund or dispute event is handled anywhere
(SL-008). Five sources are `settled: () => true` — unconditionally counted forever.

**Mixes cents and dollars?** No confirmed defect. `lib/fees.ts` works in integer cents; DB columns
are `decimal(10,2)`; the webhook converts once at the boundary (`amount_total / 100`). The
convention is correct and consistently applied.

**Assumes USD?** Yes, everywhere, and never checks. All checkout routes hardcode `currency=usd`,
so it is consistent today — but nothing would catch a change (SL-050).

**Trusts a browser-supplied amount?** **No.** This was checked specifically.
`app/api/merch/checkout/route.ts:71` reads `Number(product.retail_price)` from the database and
puts it in metadata; the browser never supplies it. `/api/tip` clamps to
`Math.max(1, Math.min(1000, …))`. Amounts in webhook metadata originate server-side. This is
handled correctly.

**Calculates creator net differently between routes?** Yes — this is the pattern you flagged, and
it persists:

| Surface | Method | Result |
|---|---|---|
| Creator dashboard | `creatorEarningsSummary()` from `lib/earnings.ts` | ✅ correct, flags failures |
| Creator analytics pane | bespoke sum of `tips.amount_usd` | ❌ column doesn't exist → **always $0** (SL-017) |
| Admin dashboard | bespoke sum of `tips.platform_receives` | ❌ 0% on tips → **structurally $0**, excludes all real platform revenue (SL-018) |
| Fan account page | bespoke sum in `/api/fan/me` | ❌ 5 of 6 queries broken → **always $0.00** (SL-016) |
| Admin video-studio creator view | `Math.max(campaign.raised_amount, sum(donations))` | ⚠️ a third definition of campaign totals |
| Payout | — | **does not exist** |

**Can create a payment record before Stripe confirms payment?** Yes, in two ways. `/api/tip`
notifies the creator of a tip at checkout-session-creation time, before any payment (SL-022).
And `checkout.session.completed` is treated as payment confirmation without checking
`payment_status` (SL-032).

## Reconciliation against `lib/earnings.ts`

`lib/earnings.ts` is the correct model and its header comment states the intent precisely. Three
gaps remain:

1. **Only one surface uses it** — the creator dashboard. Analytics, admin and the fan view each
   reimplement earnings, and all three are wrong.
2. **Four sources are missing** from `SOURCES`: post unlocks, gift subscriptions, Front Row
   Messages, comment boosts (SL-023).
3. **Five sources are `settled: () => true`** — unconditional, so refunds and chargebacks can
   never be excluded even once refund handling is added (SL-008).

One internal risk: `SOURCES[0]` filters `tips` by `creator_profile_id` and selects
`platform_receives`, neither of which appears in the committed `tips` DDL (SL-024). If the live
rename did not reach `tips`, the dashboard's Tips row reports `failed: true` — visibly wrong
rather than silently zero, which is the module working as designed. Confirm with query 1 in
`SCHEMA_REFERENCE_AUDIT.md`.

## Payout

There is no payout system to audit. Creator money moves through Stripe Connect destination
charges with automatic daily payouts (`lib/stripe.ts` `createConnectAccount()`), so Stripe holds
the ledger and Spotlightly holds none. Nothing in the database records what was paid out, and
nothing reconciles `creator_receives` totals against Stripe transfers.

This is survivable at current volume and becomes untenable at scale — particularly once refunds
exist, since a refunded destination charge reverses at Stripe with no corresponding change
anywhere in Spotlightly's numbers.
