# Tip Reconciliation

**Status: SCRIPT PREPARED, NOT RUN.** I have no Stripe credentials in this environment.
**Whether historical tips exist is therefore UNKNOWN and must not be assumed either way.**

**Script:** `audit/production-integrity/_tools/tip-reconciliation.mjs` — read-only, dry run.

---

## Why zero rows is not an answer

`public.tips` contains **0 rows**. That has two possible explanations and the database cannot
distinguish them:

1. Nobody has ever tipped. Tipping has never worked, but no money was lost.
2. Tips have been paid — fans charged, creators transferred to via Connect — and **every one was
   recorded nowhere.**

The mechanism, confirmed against the live schema:

```
tips.creator_receives    numeric  NOT NULL, no default   ← webhook never supplied it
tips.platform_receives   numeric  NOT NULL, no default   ← webhook never supplied it
tips.fan_user_id         uuid     NOT NULL, no default   ← webhook wrote `|| null` for guests
```

The webhook inserted four columns, omitted two NOT NULL ones, **never checked the result**, and
returned `{received:true}` → HTTP 200. Stripe recorded the event as delivered and never retried.

Every failure was silent. `lib/earnings.ts` did the right thing — it reported Tips as
`failed: true` rather than a silent zero — and nobody read it.

**Only Stripe knows.** Stripe holds the payment records and the Connect transfers regardless of
what the database did.

---

## Running it

```bash
STRIPE_SECRET_KEY=rk_live_...            # a RESTRICTED read-only key is strongly preferred
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # optional — enables the DB comparison

node audit/production-integrity/_tools/tip-reconciliation.mjs
node audit/production-integrity/_tools/tip-reconciliation.mjs --since=2025-01-01 --json
```

### Safety

- **Never writes to Stripe.** No refunds, no transfer reversals, no metadata edits. Only
  `GET /v1/checkout/sessions` and `GET /v1/refunds`.
- **Never writes to Supabase.** No ledger rows, no backfill. One read of `tips`.
- **Prints no personal data.** Session ids are truncated; no email, name, card detail or full
  customer id is ever emitted.
- Aborts after 200 pages — narrow with `--since` rather than removing the guard.

---

## What it reports

Exactly the fields you asked for:

| Metric | Source |
|---|---|
| Total matching Stripe payments | sessions with `metadata.type = "tip"` |
| Total gross amount | sum of `amount_total` on paid sessions |
| Total Connect transfers | sum of `payment_intent.transfer_data.amount` |
| Total refunds | count + amount, per tip payment intent |
| Earliest / latest payment | session `created` |
| Number already represented in `tips` | join on `stripe_session_id` |
| Number missing from `tips` | the difference — **the money at risk** |

Plus two diagnostics that matter for any backfill:

- **`guestTipsAmongMissing`** — rows with no `fan_user_id`. These need migration 065's nullable
  column; they cannot be inserted without it.
- **`missingCreatorProfileId`** — sessions whose metadata lacks `creator_profile_id`. These cannot
  be attributed automatically and need manual resolution from the Connect transfer destination.

---

## Interpreting the result

### If `missingFromTips` is 0

Tipping has never been used. No money was lost. Migration 065 plus the webhook repair mean the
first real tip will record correctly. Nothing further to do.

### If `missingFromTips` is greater than 0

Money was taken from fans and transferred to creators with no record on the platform. Consequences
to be clear about:

- Creator dashboards under-report earnings by exactly that amount.
- The creators **were paid** — Stripe's destination charge moved the money at payment time,
  independent of the webhook. This is a **records** problem, not a "creators are owed money"
  problem. That distinction matters and should be stated plainly to any creator who asks.
- Any refund issued against those payments is also unrecorded.

**Then stop and get approval.** The backfill plan below is written, not executed.

---

## Backfill plan — for approval, not to run now

**Preconditions**

1. Migration 065 applied. Without nullable `fan_user_id` and the money-column defaults, guest tips
   cannot be inserted at all.
2. Migration 064 applied. Otherwise anon could read the rows you are about to create.
3. The reconciliation report reviewed and `missingCreatorProfileId` resolved.

**Properties the backfill must have**

- **Idempotent.** Keyed on the `tips_stripe_session_id_key` unique index (migration 065). Re-running
  inserts nothing new. Use `on conflict (stripe_session_id) do nothing`.
- **Derived only from Stripe**, never from a guess. `amount` from `metadata.amount_usd`, falling
  back to `amount_total` only when metadata is absent — matching `buildTipLedgerRow()` exactly, so
  backfilled rows are indistinguishable from live ones.
- **`creator_receives = amount`, `platform_receives = 0`** — the platform takes 0% of tips
  (`lib/fees.ts`), and the gross-up is a pass-through.
- **Refunded tips excluded, or inserted and immediately marked.** `tips` has no status column;
  the honest options are to skip refunded payments or add one. Skipping is simpler and does not
  overstate earnings. Decide before running.
- **Marked as backfilled.** Set `stripe_event_id = 'backfill:<runId>'` so these rows are
  distinguishable forever. Do not fabricate an event id.
- **Dry-run first**, with a diff of what it would insert, reviewed before the live run.
- **Creators notified?** Their dashboard earnings will jump. That is a communications decision,
  not a technical one, and needs your approval before anything sends.

**What the backfill must NOT do**

- Not create or reverse any Stripe object.
- Not issue refunds.
- Not touch `campaigns.raised_amount`, `medal_balances`, or any other aggregate.
- Not run before the reconciliation report has been read by a human.

I have not written the backfill script. It should be written against the actual reconciliation
output, so its shape is decided by what is found — not guessed in advance.

---

## First thing to do

Run the script, or failing that, open the Stripe Dashboard → Payments and search
`metadata.type = tip`. Any result at all means §"If `missingFromTips` is greater than 0" applies.

That single lookup determines whether this is a bug that never bit, or a live incident.
