# Tip fraud audit and hardening (September 2026)

Companion to migration `068_tip_trust_safety.sql` and `lib/trust/*`.

## 1. Incident

Four creator profiles (Angelina, HOLLYHOLLY, MICHAEL, ERNEST): zero posts, Stripe onboarding
minutes after signup, published immediately, first IPs in 103.135.100.x, then bursts of $9
tips (about 28 in 17 minutes on one). Stripe rated the accounts elevated or highest risk and
rejected one.

## 2. Architecture as found

| Step | Implementation |
|---|---|
| Tip button | `TipButton` hidden form POST to `/api/tip`; `CreatorStageClient` and `PostCarousel` called `/api/tip` with fetch (both broken, see §4) |
| Session | `/api/tip`: Checkout Session, **destination charge** (`transfer_data.destination`, amount = tip), fan pays gross up |
| Eligibility | `stripe_account_id && stripe_onboarded` only |
| Ledger | Webhook `checkout.session.completed` inserted `tips` (4 columns) |
| Accounts | **Express**, created in `/api/stripe/connect/{start,session}` with Stripe default payout schedule |
| Payouts | **Automatic** (Stripe default daily). Spotlightly controlled nothing |
| Refund / dispute | Not handled. Platform is merchant of record; refunds do not reverse transfers; disputes debit the platform |

### The 20 questions

1. Tips rows were inserted by the webhook on `checkout.session.completed`.
2. After the session completed, but `payment_status` was never checked.
3. Abandoned / failed sessions left no record; `checkout.session.expired` unhandled.
4. No status column.
5. PaymentIntent never written back.
6. `stripe_event_id` never written.
7. Same event: blocked by the 065 unique index on session id; no event log; no replay window on the hand rolled verifier.
8. Zero post creators could receive tips.
9. Unpublished creators could receive tips.
10. Tips were possible immediately after signup.
11. Guests could tip; the endpoint was a plain form POST (scriptable).
12. No rate limits.
13. Nothing limited by card, session, IP or creator.
14. `account.updated` only ever set `stripe_onboarded = true`, never false.
15. Restricted / rejected creators could keep generating sessions.
16. Payouts automatic.
17. Stripe controlled timing.
18. New creators could withdraw after Stripe's own first payout delay only.
19. Destination charges.
20. Refunds and disputes were not recorded; transfers were not reversed.

**Correction to the incident hypothesis:** tip rows were NOT checkout attempts. They were paid
sessions. The null PaymentIntent / event id / creator_receives came from the Batch 0 webhook fix
never shipping: `lib/tips.ts` and migration 065 exist and the audit says the webhook was fixed,
but the route still ran the old 4 column insert and the hand rolled HMAC. 065's defaults made
that insert succeed with zeros. Every tip on the platform has the same missing fields.

## 3. Root causes

1. Stripe onboarding was the only gate. No content, age, publish, or Stripe status check.
2. No velocity limits anywhere on a guest, unauthenticated, form POST endpoint.
3. Automatic payouts on new accounts: funds could leave before anyone looked.
4. Stripe restrictions never flowed back into Spotlightly.
5. Ledger could not distinguish attempt, pending, paid, refunded, disputed.
6. No refund, dispute or early fraud warning handling, with the platform carrying the liability.

## 4. Other defects found

- **Possible public exposure of IPs.** `065_creator_profiles_public_read.sql` grants public
  SELECT on full `creator_profiles` rows where `published = true` (includes `first_ip`,
  `last_ip`, `date_of_birth`, `stripe_account_id`). Whether it is live depends on the order the
  two 065 files and 066 ran. Check with `supabase/verify/068_trust_safety_verify.sql` §4 or the
  existing `rls-integration` test "cannot read creator_profiles at all". NOT changed here:
  narrowing it would break public pages; the fix is moving private columns to a side table.
- `PostCarousel` sent JSON to a `formData()` route (500). `CreatorStageClient` used fetch on a
  303 redirect (fails). Neither sent `post_id`, so post tips were never attributable. Fixed.
- `/api/tip` notified the creator before payment (SL-022). Fixed: notification is in the webhook.
- `live_stream_tips` rows are inserted before payment, never confirmed, shown publicly, and
  counted in earnings. Gated by the new guard; the ledger itself is NOT fixed here (§8).

## 5. Protections added

- `canCreatorReceiveTips` (`lib/trust/eligibility.ts`): active, published, not deleted, spotlight,
  creator has tips on, not admin held, Stripe connected, Stripe status fresh and not rejected /
  restricted / charges disabled (refreshed from Stripe when stale, fails closed), at least N live
  posts, and the new creator risk period rule.
- Guard (`lib/trust/tip-guard.ts`) on `/api/tip`, `/api/super-tip`, `/api/live/tip`:
  eligibility, velocity, attempt log. Refusal means no Stripe call.
- Tip lifecycle: row created `checkout_created`, only a verified webhook sets `succeeded`.
  Guarded transitions (`lib/trust/tip-state.ts`). Earnings, analytics, sales, fan history and
  admin totals read `succeeded` only.
- Webhook: official `constructEvent` with 300s tolerance; processed event log; handles
  completed / async / expired / payment_failed / refunded / dispute created, updated, closed /
  radar early fraud warning / account.updated / deauthorized.
- Post linking: `post_id` validated server side; `tip_source` profile | post | live_stream |
  other; `unknown` only for legacy rows.
- Fraud context in `tip_checkout_attempts` (service role only): IP, country, region, user
  agent, outcome, and after payment the card fingerprint, card country and Stripe risk level.
  No card data.
- Risk flags (`lib/trust/risk-flags.ts`), computed, never a verdict. Location alone is never a flag.
- Admin: `/admin/trust` list and `/admin/trust/[id]` detail, with disable / enable tips,
  review / release, block / unblock, hold / release payouts. Reason required, audit logged,
  append only history. No financial record is ever changed by these.
- Payout holds (§6).

## 6. How payout holds work

Express + destination charges: money lands in the creator's Connect balance at charge time.
Spotlightly controls when that balance goes to the bank, via `settings.payouts.schedule`:

- **New accounts** are created with `interval: manual` (`lib/trust/new-account.ts`). Stripe will
  not pay out until Spotlightly releases.
- **Risk period:** a new creator may accept tips only while Stripe reports `manual`. If it
  cannot be guaranteed (for example an account created before this deploy with automatic
  payouts) tips stay off until the risk period ends.
- **Automatic release:** `/api/cron/trust-payout-release` (daily) switches `new_account` holds
  back to `daily` once `payoutHoldDays` have passed since the risk period start, the creator has
  a live post, and no hold flag is present. `?dry=1` reports without calling Stripe.
- **Automatic hold:** a dispute or Radar early fraud warning puts the creator under review and
  switches payouts to manual (`autoHoldOnDispute`).
- **Manual:** admin actions. Releasing a review does not release payouts; that is a separate action.
- A hold never moves, refunds or reverses money.

## 7. Thresholds (defaults, all in `lib/trust/config.ts`)

Override without a deploy: `platform_settings` key `TRUST_SAFETY_CONFIG`, JSON, merged over defaults.

| Setting | Default |
|---|---|
| newCreatorRiskHours | 24 |
| minPublishedPostsForTips | 1 |
| payoutHoldDays | 7 |
| holdPayoutsForNewAccounts | true |
| autoHoldOnDispute | true |
| stripeStatusMaxAgeMinutes | 360 |
| tipSessionExpiryMinutes | 30 (Stripe minimum) |
| establishedCreatorDays / Posts | 30 / 3 |
| sameNetworkCreatorThreshold / WindowDays | 2 / 14 |
| velocity.creatorAttempts10m / 1h | 5 / 10 |
| velocity.guestIpAttempts10m / 1h | 5 / 10 |
| velocity.fanAttempts10m / 1h | 5 / 15 |
| velocity.creatorUncompletedSessions1h | 8 (with zero successes) |
| velocity.creatorSucceeded10m / 1h (flag only) | 5 / 10 |
| velocity.establishedCreatorMultiplier | 3 (creator limits only) |

## 8. Remaining exposure

- **Other payment routes are not gated.** `/api/subscribe`, `/api/digital/purchase`,
  `/api/marketplace/purchase`, `/api/campaigns/donate`, `/api/gift-subscription`,
  `/api/merch/checkout`, `/api/medals/purchase`, wishlist, social add backs still check only
  `stripe_onboarded`. The same fraud pattern can pivot to a $9.99 subscription. The payout hold
  on new accounts still covers them for money leaving; the eligibility gate does not.
- **Existing accounts keep automatic payouts**, including the four. Holding them is a Stripe
  change needing approval.
- **Transfers are not reversed on refund or dispute.** Destination charge disputes debit the
  platform; recovering from the creator needs a transfer reversal. Policy decision.
- `live_stream_tips` ledger still pre payment.
- Velocity is read then write; a tight concurrent burst can exceed a limit by a few.
- The `creator_profiles` public read exposure in §4.
- Legacy tip rows are `legacy_unverified`; reconcile against Stripe.
