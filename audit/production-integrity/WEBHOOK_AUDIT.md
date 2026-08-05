# Stripe Webhook Audit (Phase 5)

Single handler: `app/api/webhooks/stripe/route.ts` (850 lines). Parallel processors: CCBill
(`/api/webhooks/ccbill`), Printful/Loudcap (`/api/webhooks/printful`), Supabase Auth
(`/api/webhooks/auth`).

## Signature verification

Hand-rolled at lines 10–21 rather than using `verifyWebhook()` from `lib/stripe.ts`, which
already exists and wraps the official SDK.

| Property | Status |
|---|---|
| HMAC-SHA256 over `${t}.${payload}` | ✅ correct |
| Raw body used (not re-serialised JSON) | ✅ correct — `await req.text()` before `JSON.parse` |
| Constant-time comparison | ✅ `crypto.timingSafeEqual` |
| Missing secret fails closed | ✅ returns 503 |
| **Timestamp tolerance** | ❌ **`t` is never compared to now** → SL-006 |
| Length-mismatch handling | ⚠️ `timingSafeEqual` throws `RangeError` on unequal lengths → 500 not 400 (SL-051) |
| Multiple `v1` signatures (during secret rotation) | ⚠️ only the last `v1` survives the `reduce`; rotation would break verification |

**The missing timestamp check is the significant one.** Stripe's own libraries enforce a
300-second default tolerance specifically to prevent replay. Without it, any captured
request line — body plus `stripe-signature` header — remains valid indefinitely.

## Event coverage

### Handled (7)

| Event | Handling | Assessment |
|---|---|---|
| `account.updated` | sets `stripe_onboarded = true` | ⚠️ never sets it back to false (SL-049) |
| `checkout.session.completed` | 14 sub-types by `metadata.type` | ⚠️ `payment_status` never checked (SL-032) |
| `customer.subscription.updated` | writes `sub.status` through | ❌ violates CHECK for `unpaid`/`paused`/`incomplete_expired` (SL-026) |
| `customer.subscription.deleted` | same handler | ❌ same |
| `customer.subscription.trial_will_end` | warning email, `trial_warning_sent` flag | ✅ correctly idempotent |
| `invoice.payment_succeeded` | ledger row + reactivate + tier auto-upgrade | ✅ ledger is the best-built path in the file |
| `invoice.payment_failed` | `past_due` + 7-day grace + email | ✅ grace set once per cycle (`?? new Date(...)`) |

### Not handled — and should be

| Event | Consequence of the gap | Severity |
|---|---|---|
| `charge.refunded` | Refunded money counted as creator earnings forever; digital download access never revoked | **critical** |
| `charge.dispute.created` | Chargebacks invisible; creator paid from disputed funds | **critical** |
| `charge.dispute.closed` | Dispute outcome never recorded | high |
| `checkout.session.async_payment_succeeded` | Async payments never confirmed | high |
| `checkout.session.async_payment_failed` | Failed async payments stay recorded as revenue and stay fulfilled | high |
| `checkout.session.expired` | Abandoned sessions never cleaned up | low |
| `payment_intent.payment_failed` | Failed payments leave no trace | medium |
| `customer.subscription.paused` / `.resumed` | Paused subs keep access and keep counting toward billing tier | medium |
| `invoice.payment_action_required` | 3DS/SCA challenges never surfaced to the creator | medium |
| `account.application.deauthorized` | A creator disconnecting Stripe leaves `stripe_onboarded = true`; checkouts then fail after the fan commits | high |
| `payout.paid` / `payout.failed` | No payout ledger exists at all (see `MONEY_FLOW_MAP.md`) | high |
| `radar.early_fraud_warning.created` | No fraud signal reaches the platform | medium |
| `customer.deleted` | Orphaned `creator_billing` rows | low |

## Idempotency

**There is no processed-event store.** No table keyed on `event.id`, and no unique constraint on
`stripe_session_id` for any money table. Per-handler status:

| Handler | Mechanism | Replay-safe |
|---|---|---|
| `subscription_payments` (invoice) | unique `stripe_invoice_id`, duplicate-key error explicitly tolerated | ✅ **model implementation** |
| `social_addback` | guards on `status === 'pending'` before acting | ✅ |
| `post_unlock` | `upsert onConflict post_id,fan_user_id` | ✅ |
| `early_access` | `upsert onConflict fan_user_id,creator_profile_id` | ✅ |
| `subscription` | upsert — but the write fails on `updated_at` (SL-009) | ⚠️ moot |
| `platform_subscription` | `upsert onConflict user_id` | ✅ |
| `medal_pack` | plain insert **+ read-modify-write balance** | ❌ double-credits, and loses concurrent purchases (SL-028) |
| `tip` | plain insert | ❌ |
| `super_tip` | plain insert | ❌ |
| `campaign_donation` | plain insert **+ read-modify-write `raised_amount`** | ❌ double-counts and loses concurrent donations (SL-027) |
| `wishlist_gift` | plain insert | ❌ (and fails anyway — SL-010) |
| `gift_subscription` | plain insert | ❌ mints duplicate redemption codes |
| `merch` | plain insert | ❌ — Loudcap's `external_id: sl_${s.id}` limits duplicate *physical* orders, but a duplicate `merch_orders` row still double-counts earnings |
| `front_row_message` | insert + read-modify-write unread counter | ❌ |
| `comment_boost` | update, naturally idempotent | ✅ |

## Failure behaviour

**Only one branch of fourteen inspects its write result.** The digital-product handler
(lines 433–438) checks the error and returns 500 so Stripe retries — with a comment explaining
exactly why. Every other branch discards the result and falls through to
`return NextResponse.json({ received: true })` at line 848.

This is what converts each schema defect into permanent silent data loss: Stripe records the
event as delivered and never retries. → **SL-014**

Partial-write exposure is real in several branches. In `wishlist_gift`, `wishlist_items` is
marked purchased and the creator is emailed *before* the `wishlist_purchases` insert that fails
(SL-010) — so the visible state says the gift succeeded while no purchase record exists. In
`front_row_message`, thread creation, message insert and notification are three unguarded writes
with no transaction.

## Transaction ordering

There are no transactions. Every handler is a sequence of independent PostgREST calls, so any
mid-sequence failure leaves partial state. Supabase offers no client-side transaction primitive;
multi-write handlers should be Postgres functions invoked via `.rpc()`, as migrations 032–034
already do for medals and referrals.

## Amount and currency conversion

`amount_total / 100` and `amount_paid / 100` throughout, with no `currency` inspection. Correct
for USD, silently wrong by 100× for any zero-decimal currency (SL-050). Amounts otherwise come
from server-set metadata, never from the browser — verified.

## Other webhook handlers

| Handler | Verification | Assessment |
|---|---|---|
| `/api/webhooks/printful` | shared secret in query string | 🟠 Secret leaks into logs (SL-040). Correctly keys every update off its own stored `loudcap_order_id`, so forged order ids cannot match. Maps Printful statuses explicitly. Handles `refunded` — the only refund-aware path in the platform. |
| `/api/webhooks/auth` | `x-webhook-secret` header vs `SUPABASE_WEBHOOK_SECRET` | 🟢 Fails closed when unset. Correctly suppresses welcome email for concierge-built accounts. |
| `/api/webhooks/ccbill` | own secret | 🟡 Not deeply audited — parallel processor for adult accounts. Note it inserts `subscriptions` with `creator_id`, which conflicts with the live `creator_profile_id` naming. |

## Recommended fixes, in order

1. **Add a timestamp tolerance**, or replace the hand-rolled verifier with `verifyWebhook()` from
   `lib/stripe.ts`. One line, closes the replay window.
2. **Add a `stripe_events` table** keyed on `event.id`. Insert first; on conflict return 200
   immediately. This makes every handler replay-safe at once.
3. **Check every write result** and return non-2xx on failure so Stripe's retry schedule can
   recover it.
4. **Handle `charge.refunded` and `charge.dispute.created`**, writing reversing ledger rows.
5. **Require `payment_status === 'paid'`** before any write, and handle the async payment events.
6. Replace the two read-modify-write sequences (campaign totals, medal balance) with atomic SQL
   increments — `033_medal_balance.sql` already provides the pattern.
