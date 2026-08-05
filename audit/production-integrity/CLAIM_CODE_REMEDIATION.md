# Claim Code Remediation

**Status: PREPARED, NOT RUN.** The script has not been executed. No data has changed.

**Script:** `supabase/ops/2026-08-05_rotate_exposed_claim_codes.sql`

---

## What happened

`creator_profiles` carried this policy, confirmed live on 2026-08-05:

```
"Creators are publicly readable"   FOR SELECT   TO public   USING (true)
```

and `anon` held `SELECT` on the table. `{public}` includes `anon` — the key published in every
browser bundle.

`claim_code` is a **bearer credential**. `/api/claim` accepts a code and sets the email and
password on that creator's account. The code is the entire credential; nothing else is required.

So a single request returned working account-takeover credentials:

```
GET /rest/v1/creator_profiles?select=handle,claim_code&claim_code=not.is.null
```

**7 profiles held a live, unclaimed code at the time of verification.**

How long the policy existed is unknown — it predates the audit and is not in any migration. There
is no access log that would show whether anyone used it. **Treat all 7 as compromised.**

### One thing that did *not* help

My earlier audit noted that no application path reads `claim_code` through the anon client (every
read uses `createServiceClient()`, including the public `/claim/[code]` page) and treated that as
a mitigation. **It is not.** The application does not need to read a column for an attacker to;
PostgREST exposes the table directly. That was the wrong perimeter.

It does mean one useful thing: because no anon path reads the column, removing public read
**cannot break the claim flow**.

---

## Pre-flight — what the script confirms before touching anything

The script's STEP 1 and STEP 2 run before the UPDATE and will abort on anything unexpected:

| Check | Expected | If violated |
|---|---|---|
| `unclaimed_with_code` | ~7 | Aborts above 50 — wrong database, or codes issued in bulk |
| `claimed_with_code_anomaly` | **0** | Aborts. `/api/claim` nulls the code in the same statement that sets `claimed_at`, so a row with both is impossible and means something wrote a code back onto a claimed profile |
| `already_claimed_clean` | informational | — |

**Counts only.** No `claim_code` value is selected, printed or returned by any statement.

**Already-claimed creators cannot be locked out.** The UPDATE touches only
`claim_code is not null AND claimed_at is null`. A creator who has claimed their page had their
code consumed and nulled at claim time, so they are not in scope at all — they sign in with the
email and password they set. Verified against `app/api/claim/route.ts:58`.

---

## The approach chosen, and why

**Codes are NULLED, not regenerated.**

1. **Immediate invalidation.** `/api/claim` calls `claimRejection()`, which returns `not_found`
   when no row matches the code. A null code stops working the instant the UPDATE commits — no
   overlap window, no grace period.
2. **Regenerating here would re-disclose.** Generating a replacement inside this script writes it
   into the result set, the SQL Editor's history, and anything logging in front of the database —
   reintroducing exactly the disclosure being remediated.
3. **A correct re-issue flow already exists.** `/admin/creators` has a "Generate claim link"
   action that calls `generateClaimCode()` (`lib/claim.ts`, 32 hex chars from
   `crypto.randomBytes`) and sets `claim_expires_at` via `claimExpiryFrom()`. It reads through
   the **service client**, shows the link once to the admin, and is never selectable by anon.
   That is the right delivery path, and it keeps re-issue a human decision.

### Ordering — this matters

**Run migration 064 first.** Rotating while the table is still publicly readable would publish
the replacements too. The script does not enforce this; it is on the operator.

---

## Properties

- **Idempotent.** The `WHERE` matches nothing on a second run; STEP 2 emits a notice and the
  UPDATE is a no-op.
- **Guarded.** Aborts on the anomaly condition or an implausible count.
- **Scoped.** Only unclaimed rows. `claimed_at` is never modified.
- **Transactional.** STEP 4's verification runs before `COMMIT`; `remaining_live_codes` must be 0.
  If it is not, `ROLLBACK`.
- **Silent.** No code value in any output. Nothing is logged to the application.

---

## Delivery to affected creators

**Nothing is sent automatically.** No email, no DM. Per CLAUDE.md rule 5, creator outreach
requires explicit administrator approval, and this script deliberately has no side effects beyond
the UPDATE.

After rotation, the 7 affected creators cannot claim their page until an admin issues a new link.
The recommended sequence:

1. Apply migration 064.
2. Run the rotation script; note `profiles_now_awaiting_reissue` from STEP 4.
3. In `/admin/creators`, identify the unclaimed profiles (they now show no claim link).
4. For each one still being actively recruited, click **Generate claim link** and send it through
   the normal approved outreach path.
5. For prospects no longer being pursued, do nothing — the page stays unclaimed, which is correct.

**Suggested wording, if you choose to notify** (not sent by anything here):

> We refreshed your invitation link as part of a routine security review. Your previous link no
> longer works. Here is your new one: {link}

I would not claim more than that in writing without deciding, with whatever legal input you use,
whether this meets a disclosure threshold. Which brings me to:

---

## Disclosure — a decision you need to make, not one I can make for you

The exposed data was not only claim codes. The same policy exposed **every column** of every
creator profile to anyone with the browser key, including:

- `date_of_birth` and `parental_consent_at` — age and consent compliance data
- `first_ip`, `last_ip`, `first_user_agent`, `last_user_agent` — visitor tracking
- `shipping_name`, `shipping_address`, `shipping_city`, `shipping_state`, `shipping_zip`
- `stripe_account_id`, `ccbill_account_number`

That is personal data belonging to real creators, exposed for an unknown period. Whether this
triggers a notification obligation depends on your jurisdiction, your privacy policy, and whether
any access actually occurred — which the available logs may or may not answer.

**This is a judgement for you and your legal advisor.** I am flagging it because rotating the
codes fixes the takeover vector and does not address the personal-data question at all, and it
would be easy to close this ticket believing it did.

---

## Verification after running

```sql
-- MUST return 0.
select count(*) from public.creator_profiles
 where claim_code is not null and claimed_at is null;

-- Confirm the read is closed (should return no rows / permission denied for anon).
-- Run with the ANON key, not the service role key:
--   GET /rest/v1/creator_profiles?select=handle,claim_code&limit=1
```

The integration suite covers the anon side:
`lib/__tests__/rls-integration.test.ts` → *"cannot read claim_code — the account-takeover
credential"*.

An old code can also be checked end-to-end by POSTing it to `/api/claim`; it should return
`"This link is not valid."` (the `not_found` branch). Do that only with a code you already hold
from the pre-rotation state.
