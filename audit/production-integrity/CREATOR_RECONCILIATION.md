# Creator Reconciliation — April

**Status: NOT RUN. No data in this document is real.**

I have no Stripe key and no database credentials in this environment — the same blocker as the tip
reconciliation. This document contains the tool, the method, and what the audit already tells us
the result will look like. **The actual numbers must come from running the script.**

**Tool:** `audit/production-integrity/_tools/creator-reconciliation.mjs` — read only, dry run.

---

## How to run it

```bash
cd /c/dev/spotlightly

STRIPE_SECRET_KEY="rk_live_..." \
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
  node audit/production-integrity/_tools/creator-reconciliation.mjs --handle=<april's handle>
```

Options: `--since=2025-01-01` · `--json` · `--csv` (paste straight into a spreadsheet).

Use a **restricted read-only Stripe key** if you have one. The script needs read on checkout
sessions, invoices, transfers, refunds and disputes.

### Safety, enforced in code

- **No write verb exists in the file.** Verified: no `POST`/`PUT`/`PATCH`/`DELETE`, no
  `.insert(`/`.update(`/`.upsert(`/`.delete(`. Only `GET` and `SELECT`.
- **Refuses to start** without all three credentials, and without a creator.
- **Redaction is in the code, not the convention.** Customer names, emails, payment methods and
  addresses are never read into the report. Stripe ids are truncated to an 11-character prefix —
  enough for you to find the row in the Stripe dashboard, not a complete identifier.

---

## What it reconciles

Your six categories, plus the two that turned out to have no ledger at all.

| # | Category | Stripe source | Expected DB table |
|---|---|---|---|
| 1 | Subscription invoices | `invoices` where `transfer_data.destination` = her account | `subscription_payments` |
| 2 | Tips | `checkout.sessions` `metadata.type=tip` | `tips` |
| 3 | Digital purchases | `metadata.type=digital_product` | `digital_purchases` |
| 4 | Other payments tied to her | any session with her `creator_profile_id` **or** a transfer to her account | see the matrix below |
| 5 | Connect transfers | `transfers?destination=acct_…` | **none — no payout ledger exists** |
| 6 | Refunds and disputes | `refunds` per payment intent, `disputes` | **none — not handled** |

Category 4 catches sessions two ways — by `metadata.creator_profile_id` and by
`payment_intent.transfer_data.destination` — because campaign donations carry `campaign_id`
rather than the creator id, and would otherwise be missed.

---

## Where the gaps will be — predicted from the audit, to be confirmed by the run

This is the value I can add without credentials: you should not be surprised by the output.

| Revenue type | Table | Reaches DB? | On dashboard? | Why |
|---|---|---|---|---|
| **Tips** | `tips` | ❌ **No** | ❌ | Insert omitted two NOT NULL columns and returned 200. `tips` holds **0 rows**. Every tip April has received is unrecorded. |
| **Subscription invoices** | `subscription_payments` | ⚠️ **Forward only** | ⚠️ Partial | Migration 063 fills forward from the day it shipped. **Every invoice before that is absent and cannot be recovered from the database.** This is your "special attention" case — see below. |
| **Digital purchases** | `digital_purchases` | ✅ Yes | ✅ Yes | The one webhook branch that checked its write and returned 500 on failure. Also has a UNIQUE `stripe_session_id`. |
| **Super tips** | `super_tips` | ✅ Likely | ✅ Yes | Plain insert, unchecked — a failure would be silent, but no schema defect is known. |
| **Campaign donations** | `campaign_donations` | ✅ Likely | ✅ Yes | Unchecked insert; `campaigns.raised_amount` uses a lossy read-modify-write (SL-027). |
| **Merch** | `merch_orders` | ✅ Likely | ✅ Yes | Correctly settles on `stripe_payment_id`, not fulfilment state. |
| **Marketplace** | `marketplace_orders` | ✅ Likely | ✅ Yes | — |
| **Social add-backs** | `social_addback_orders` | ✅ Likely | ✅ Yes | — |
| **Wishlist** | `wishlist_purchases` | ✅ Yes | ❌ **No** | **SL-065.** `earnings.ts` settles on `paid_pending_purchase` / `creator_purchased`; the live CHECK permits only `pending` / `transferred` / `refunded`. Those statuses **cannot exist**, so wishlist revenue is structurally $0 on the dashboard while the rows sit in the table. |
| **Post unlocks** | `post_unlocks` | ✅ Yes | ❌ **No** | **SL-023.** Recorded, but the table is not in `earnings.ts` SOURCES. |
| **Gift subscriptions** | `gift_subscriptions` | ✅ Yes | ❌ **No** | **SL-023.** Same. |
| **Early access renewals** | `early_access_passes` | ⚠️ State only | ❌ **No** | **SL-035.** The ledger insert looks the subscription up in `subscriptions`; an early-access pass has no row there, so renewals write nothing. |
| **Front Row Messages** | **none** | ❌ **No ledger** | ❌ | **SL-023.** The 50% creator share is computed at `webhooks/stripe:260` and never stored. It exists only in an email body. |
| **Comment boosts** | **none** | ❌ **No ledger** | ❌ | Platform revenue; only a flag on `comments`. |
| **Connect transfers** | **none** | ❌ **No ledger** | ❌ | No payout table exists. Stripe is the sole record of what actually reached her bank. |
| **Refunds / disputes** | **none** | ❌ **Not handled** | ❌ | **SL-008.** No `charge.refunded` or `charge.dispute.created` handler. Five earnings sources are `settled: () => true`, so a refunded payment is counted as earnings **permanently**. |

### The pre-ledger subscription problem, specifically

`subscription_payments` (migration 063) is written by `invoice.payment_succeeded`. It has no
backfill and its own header says so: *"It cannot backfill: Stripe has the history, the database
never did."*

The script reports `subscriptionLedgerStarts` — the date of April's earliest
`subscription_payments` row — and flags every Stripe invoice before it as **PRE-LEDGER**.

Two consequences worth being precise about:

1. **Her dashboard understates lifetime subscription earnings** by the sum of all pre-ledger
   invoices. It is not wrong about the money she was *paid* — Stripe moved that at payment time —
   it is wrong about what the platform can *show* her.
2. **This is recoverable.** Unlike tips, the money reached her correctly and Stripe holds a
   complete record. A backfill is a reporting fix, not a payments fix.

---

## Report shape

One row per transaction, exactly the fields you asked for:

```
date        kind                type                 gross            creator net      db    dash  table
2026-03-14  invoice.payment_su… subscription_invoice USD 12.00        USD 12.00        NO    NO    subscription_payments
            └─ PRE-LEDGER: predates subscription_payments (migration 063 fills forward only)
2026-04-02  checkout.session    tip                  USD 10.53        USD 10.00        NO    NO    tips
2026-04-02  transfer            connect_transfer     —                USD 10.00        N/A   NO    (no payout ledger exists)
            └─ MONEY_FLOW_MAP.md: Spotlightly keeps no payout ledger. Stripe is the only record.
```

*(Illustrative formatting only — these are not April's transactions.)*

Then three headline counts: **missing from the database**, **in the database but invisible on the
dashboard**, and **subscription invoices pre-ledger**. Those three numbers are the answer.

---

## What to do with the result — nothing yet

Per your instruction, this stops at a dry run. When you have the output:

- **`missingFromDatabase = 0`** and **`preLedgerSubscriptionInvoices = 0`** — April's records are
  complete. Batch 0 can be called done for her.
- **Tips missing** — expected. Confirms the tip defect was live rather than dormant, and moves
  the tip backfill (`TIP_RECONCILIATION.md`) from hypothetical to required.
- **Pre-ledger invoices present** — a separate, idempotent subscription backfill is needed, keyed
  on the UNIQUE `subscription_payments.stripe_invoice_id` so it cannot double count.
- **Refunds or disputes present** — the most urgent finding, because her dashboard is currently
  *overstating* earnings by that amount and will keep doing so until SL-008 is fixed.

I have not written either backfill script. Both should be shaped by what the reconciliation
actually finds rather than guessed at in advance, and both need your approval first.

---

## One caution about running this on a live creator

The script reads her Stripe history and her rows. It writes nothing and prints no personal data.
But it does require the **service role key** on your machine to read the database side. If you
would rather not put that key in a shell, run it with only `STRIPE_SECRET_KEY` set — the Stripe
side still works and the report will show `inDb: N/A` throughout, which still answers "what did
Stripe actually process for her".
