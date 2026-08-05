
---

## Pages, layouts and server actions

| Surface | Guard | Verdict |
|---|---|---|
| `app/admin/**` (17 pages) | `app/admin/layout.tsx` calls `await isAdmin()` then `notFound()` | 🟢 Every admin page inherits the layout guard. The scanner flag on `app/admin/page.tsx` and `app/admin/video-studio/page.tsx` is a **false positive** — verified by reading the layout. |
| `app/(platform)/**` | `app/(platform)/layout.tsx` — no user → `redirect('/login')` | 🟢 Authentication only. Ownership is re-checked per page via `creator_profiles.user_id = user.id`. |
| `app/[creator]/**` | none — public by design | 🟢 Correct; paid-content gating is per-component and server-rendered. |
| `app/claim/[code]/page.tsx` | none — the code is the credential | 🟢 Renders a form; `/api/claim` performs the actual authorization. |
| `middleware.ts` | session lookup, admin gate, creator-vs-fan routing | 🟢 Routing only. Per CLAUDE.md it is **not** authorization, and every page re-checks. Matcher covers `/`, `/dashboard`, `/onboarding`, `/feed`, `/account`, `/admin/:path*`. |
| Server actions (`"use server"`) | re-check inside the action | 🟢 `app/admin/comms/page.tsx` re-runs `isAdmin()` inside the action, as CLAUDE.md requires. |

## IDOR testing

Each class was tested by tracing whether a request-supplied identifier can reach a query without
being intersected with the session identity.

| Test | Result |
|---|---|
| Creator A reads/modifies Creator B | **No IDOR found in routes.** Every creator route resolves the profile by `user_id = user.id` and filters by that resolved `profile.id` — it never trusts a body-supplied `creator_profile_id`. `app/api/marketplace/import/action/route.ts:31` is the model: `.eq('id', id).eq('creator_profile_id', profile.id)`. **But** SL-001/012/013 allow exactly this against PostgREST directly, bypassing routes entirely. |
| Fan A reads/modifies Fan B | **No IDOR in routes** — `/api/fan/me` scopes every query to `fan_user_id = uid`. **Yes via RLS**: SL-003 (fabricate a purchase) and SL-029 (`tips` publicly readable). |
| Non-admin reaching admin routes | **No.** All `/api/admin/*` routes return 403 via `isAdmin()`; all admin pages are covered by the layout. |
| Admin status trusted from client data | **No.** `isAdmin()` derives from `auth.getUser().email` server-side. The hardcoded `ADMIN_ID` in `components/site-header.tsx:5` and `dashboard/page.tsx:56` gates **UI only** — but see SL-033 for the three-way divergence. |
| Unverified Stripe webhook accepted | **No** — the signature is verified. **But it is replayable forever** (SL-006). |
| Referral code credits the wrong account | **Yes** — SL-005. The referrer is taken from an unauthenticated request body. |
| Public route exposes email / Stripe ids / addresses / private posts | **Yes, via RLS rather than via routes**: `merch_orders` shipping addresses (SL-012), `tips` fan ids and messages (SL-029), `creator_billing` Stripe ids (SL-001), `gift_subscriptions.recipient_email`, `marketplace_orders.buyer_email`, `social_addback_orders.fan_email` (SL-013). |
| Service-role client imported into browser code | **No.** `createServiceClient()` appears only in `route.ts` files, `lib/` server modules and server components. No `"use client"` file imports it, and `SUPABASE_SERVICE_ROLE_KEY` is never exposed under a `NEXT_PUBLIC_` name. |
| CSRF / origin protection | **Absent, but low impact.** Supabase auth cookies are `SameSite=Lax`, which blocks cross-site POST. `/api/auth/signout` is the only state-changing unauthenticated POST without a token; worst case is a forced logout. |

## Service-role usage review

`createServiceClient()` appears in 12 routes. Each was checked for a compensating gate.

| Route | Gate | Verdict |
|---|---|---|
| `/api/webhooks/stripe` | signature | 🟢 correct use (replay caveat, SL-006) |
| `/api/webhooks/printful` | shared secret + keyed off own `loudcap_order_id` | 🟢 correct use (SL-040 on transport) |
| `/api/webhooks/auth` | `SUPABASE_WEBHOOK_SECRET` header | 🟢 correct use |
| `/api/claim` | none by design — the code is the credential, format-validated before any DB work | 🟢 correct use, well reasoned in comments |
| `/api/account/delete` | `getUser()` first, then scoped to that user | 🟢 correct use |
| `/api/digital/download` | none — the token is the credential | 🟡 acceptable; the token never expires |
| `/api/download/[token]` | none — and all three guards are disabled | 🔴 **SL-004** |
| `/api/referrals/creator` | none | 🔴 **SL-005** |
| `/api/referrals/subscriber` | none | 🔴 forges referral rows (SL-043) |
| `/api/referrals/attribute` | none; the RPC carries its own guards | 🟠 acceptable — guards live in `record_referral` |
| `/api/unsubscribe` | HMAC-signed token (`lib/email.ts`) | 🟢 correct use |
| `/api/social-addbacks/orders` | `getUser()` first | 🟢 correct use |

## RLS reality check

Per the audit rules, no route was marked safe merely because RLS exists. Every applicable policy
was read. Results are in `FINDINGS.md` SL-001, 002, 003, 011, 012, 013, 029, 055, 056:

- **20 policies grant write access to `PUBLIC`** (anon + authenticated) because they omit a `TO`
  clause. No policy in the repository is `AS RESTRICTIVE`, so these OR with — and therefore
  defeat — the correct owner-scoped policies sitting beside them.
- **13 policies grant unrestricted read** to `PUBLIC`.
- **9 tables have no RLS at all**, including `creator_profiles`.
- **6 tables have RLS with zero policies** — deny-all, which is correct here since only the
  service role writes them.

**Route-level authorization is broadly sound. Database-level authorization is not — and the
database is directly reachable with the public anon key, so the routes are not the perimeter.**
