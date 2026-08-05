# Silent Failures (Phase 2)

Every place where an error can be hidden or converted into apparent success.
Scanner: `_tools/silent.js` · raw data: `_tools/silent.json`.

## Machine counts

| Pattern | Count | What it means |
|---|---|---|
| `?? []` / `\|\| 0` / `?? 0` style fallbacks | 940 | most benign; 48 are on money/auth/permission paths |
| Supabase result destructured without `error` | 266 | `const { data } = await …` — the error is discarded at the language level |
| **Writes whose result is never captured** | **150** | insert/update/upsert/delete with no `{ error }` within 3 lines |
| Empty catch blocks | 47 | `catch {}` or `catch { /* … */ }` |
| `.catch(() => {})` swallows | 32 | promise rejections discarded |
| Routes performing writes that never reference `error` | 38 | whole-file: the route cannot detect its own failure |
| Floating promises (unawaited) | 34 | serverless may freeze before they settle |
| `{ ok: true }` / `{ received: true }` responses | 71 | success envelopes, many unconditional |
| `Promise.allSettled` unchecked | 0 | not used in this codebase |

The counts matter less than the interaction: **Supabase does not throw on a failed write.** RLS
denials and constraint violations arrive as `{ error }` on a resolved promise. A `try/catch`
around them catches nothing, and 150 writes never look at the value. Combined with the RLS
findings, any policy-blocked write is indistinguishable from success.

---

## Critical — money, auth, authorization, irreversible loss

### 1. Stripe webhook: 13 of 14 handlers ignore their write result, then return 200
`app/api/webhooks/stripe/route.ts:848` — `return NextResponse.json({ received: true })`

Only the digital-purchase branch (lines 433–438) checks and returns 500. Stripe treats 200 as
processed and never retries, so every failure here is permanent. This is the mechanism that turns
SL-009 and SL-010 into money taken with no record. → **SL-014**

### 2. Fan subscription upsert — unchecked, and currently failing
`app/api/webhooks/stripe/route.ts:147`

Writes `updated_at`, a column that does not exist on `subscriptions`. PostgREST returns 42703.
Nothing checks. The fan is charged and no subscription row exists. → **SL-009**

### 3. Wishlist purchase insert — unchecked, and currently failing
`app/api/webhooks/stripe/route.ts:235`

Inserts `status: 'pending'`, which the table's CHECK constraint forbids. The preceding writes
(mark item purchased, email the creator) already succeeded, so the visible state claims success
while no purchase record exists. → **SL-010**

### 4. Subscription cancellation returns `{ ok: true }` after a failed write
`app/api/subscription/cancel/route.ts:34`

```ts
await (supabase as any).from("subscriptions").update({ status: "cancelling" }).eq("id", subscriptionId);
return NextResponse.json({ ok: true });
```

`'cancelling'` violates the CHECK constraint. The fan is told the subscription was cancelled; the
row stays `active`. `lib/billing.ts:196` then looks for `status='cancelling'` to resume
subscriptions and finds nothing — a permanent no-op. → **SL-015**

### 5. `/api/fan/me` converts five broken queries into zeros
`app/api/fan/me/route.ts:63-81`

```ts
subscriptions: subsRes.data ?? [],
totalTipped: allTips.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
```

Five of six queries reference missing columns or invalid FK hints. Every failure is absorbed by
`?? []`, and the totals compute from empty arrays. A paying fan sees zero subscriptions, zero
tips and $0.00 spent, behind an HTTP 200. → **SL-016**

### 6. `/api/analytics` — the exact bug `lib/earnings.ts` documents as fixed
`app/api/analytics/route.ts:39, 67, 85`

```ts
.from("tips").select("amount_usd, created_at")   // column does not exist
days[key].revenue += Number(t.amount_usd ?? 0);
const totalRevenue = (tips ?? []).reduce((s, t) => s + Number(t.amount_usd ?? 0), 0);
```

Two layers of fallback (`?? []` then `?? 0`) guarantee a clean $0 rather than an error. → **SL-017**

### 7. Referral routes previously returned `{ ok: true }` on RLS denial — now fixed, and the comment says so
`app/api/referrals/creator/route.ts:8-11`

These routes now check `refErr` and `creditErr` and return 500 — good. The code comment records
that the earlier version returned `{ ok: true }` while RLS silently rolled back every write. It is
worth reading as the clearest statement of the pattern in the codebase. The routes remain critical
for a different reason: they are unauthenticated (SL-005).

---

## High — feature reports success but fails

| Location | Pattern | Effect |
|---|---|---|
| `app/(platform)/dashboard/page.tsx:2843` | insert error surfaced but only after a completed upload | Digital product creation fails; the uploaded file is orphaned in storage (SL-020, SL-047) |
| `app/(platform)/dashboard/page.tsx:4121` | `channels.is_free` does not exist | Channel creation fails (SL-021) |
| `app/api/tip/route.ts:92` | `.catch(() => ({ data: { user: null } }))` on an `auth.admin` call made with the anon client | Creator tip email never sends, no trace (SL-046) |
| `app/api/webhooks/stripe/route.ts:30` | `notifyCreator` wraps everything in `try {} catch {}` | Every creator notification failure is invisible |
| `app/api/webhooks/stripe/route.ts:87` | `catch { /* defaults are fine */ }` around the Stripe subscription fetch | A failed lookup silently sets a 30-day trial and `status='trial'` regardless of the real Stripe state |
| `app/api/webhooks/stripe/route.ts:653, 763` | `catch { /* non-fatal */ }` around fan-subscription pause/resume | Fans keep or lose access silently when a creator's billing changes |
| `app/api/wishlist/confirm/route.ts:62` | writes `transfer_stripe_id`; the column is `stripe_transfer_id` | Payout reference never recorded |
| 38 routes | perform writes, never reference `error` anywhere in the file | Cannot detect their own failure |

---

## Medium — inaccurate totals, stale state

- **`app/admin/page.tsx:56`** — `(tipStats ?? []).reduce(… parseFloat(t.platform_receives) || 0 …)`.
  Double fallback on the platform's own revenue figure, which is structurally zero anyway (SL-018).
- **`app/api/referrals/stats/route.ts:29-34`** — six parallel queries destructured as
  `{ count }` / `{ data }` with no error capture; any failure reads as "zero referrals".
- **`app/api/medals/balance/route.ts:11`** — `data?.balance ?? 0`; a failed lookup is
  indistinguishable from an empty wallet.
- **Read-modify-write races** — `campaigns.raised_amount` (webhook:215), `medal_balances.balance`
  (webhook:362), `digital_purchases.download_count` (download:71), `message_threads.creator_unread`
  (webhook:279). Each loses concurrent updates silently. (SL-027, SL-028, SL-041)
- **`app/(platform)/dashboard/page.tsx:3688-3689`** — `data?.totalSubs ?? 0`,
  `data?.totalRevenue ?? 0` on the analytics payload, so the route's $0 is rendered as though real.

---

## Low — observability

- 47 empty catch blocks, 32 `.catch(() => {})`. Most sit on genuinely non-fatal notification paths
  and are annotated as such; they are listed for completeness. (SL-058)
- 34 floating promises. In a serverless runtime the function may freeze before they settle,
  producing intermittent, unreproducible loss of notifications and secondary writes. (SL-059)
- `app/api/social-posts/route.ts:24` returns `error.message` to the client — raw PostgREST text
  discloses table and column names. (SL-061)

---

## The one place this is done right

`lib/earnings.ts` is the counter-example, and the fix for everything above is to generalise it:

```ts
const { data, error } = await q;
if (error) return { ...empty, failed: true };
...
failures: results.filter((r) => r.failed).map((r) => r.key),
```

A source that errors is *reported*, not counted as zero. Its header comment names the reason
directly: *"Showing a creator $0 because a query broke is how this went unnoticed for months."*

**Recommendation.** Add a checked-write helper to `lib/` and require it on every money,
authentication, authorization and inventory path:

```ts
export async function mustWrite<T>(q: PromiseLike<{ data: T; error: any }>, ctx: string) {
  const { data, error } = await q;
  if (error) throw new WriteFailed(ctx, error);
  return data;
}
```

Then let route handlers translate `WriteFailed` into a non-2xx — which, in the webhook, is what
makes Stripe retry instead of silently discarding the event.
