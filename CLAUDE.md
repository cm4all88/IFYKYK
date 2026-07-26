# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Permanent requirements

These apply to every change, without exception.

1. **Do not break existing functionality.** This repo has live creators and live payments. Prefer additive changes; when changing shared code (`lib/*`), check every caller first.
2. **Do not invent database columns, routes, or commands.** Verify against `supabase/migrations/`, `lib/database.types.ts`, the actual `app/api/**/route.ts` files, and `package.json` scripts before referencing anything. `lib/database.types.ts` is stale (see *Database* below) — absence there is not proof a column doesn't exist, but presence in neither types nor migrations means you must confirm before using it.
3. **All database changes require migrations.** Add a numbered file under `supabase/migrations/`. Never mutate schema only through the Supabase dashboard.
4. **All administrative data requires server-side authorization and Supabase row level security.** Every `/admin` page, every `/api/admin/*` route, and every server action must call `await isAdmin()` before reading or writing. Tables holding admin or cross-creator data must have RLS enabled with explicit policies.
5. **Never send creator outreach without administrator approval.** Email/DM/blast code paths must be admin-gated and must not auto-send. `admin_messages` rows default to `status: "draft"` — keep it that way unless an admin explicitly triggers a send.
6. **Do not scrape Instagram, TikTok, or other platforms.** Use official oEmbed/API endpoints only (see `app/api/social-posts/fetch-oembed/route.ts`). Note: `lib/socialEnrich.ts` currently fetches Instagram's embed HTML with a spoofed user agent — that is pre-existing and must not be extended or copied.
7. **Every completed feature requires tests.** No test runner is installed today (see *Testing* below) — adding one is part of the first feature that needs it, not a separate project.
8. **Lint, type checking, tests, and the production build must pass** before a change is considered done.

## Commands

```bash
npm run dev         # next dev
npm run build       # next build — production build, must pass
npm run start       # next start
npm run lint        # next lint (config in .eslintrc.json)
npm run typecheck   # tsc --noEmit — strict mode is on
npm test            # vitest run — pure unit tests
npm run test:watch  # vitest in watch mode
npm run db:push     # supabase db push
npm run db:reset    # supabase db reset
```

Run a single test file with `npx vitest run lib/__tests__/claim.test.ts`.

**`npm run build` needs Supabase env vars.** Several pages are prerendered at
build time and construct a Supabase client while doing so, so a build with no
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` fails on
`/login`, `/signup`, `/onboarding` and four others. CI supplies them via
`vercel pull`; locally, use a `.env.local` (gitignored).

## Stack

- **Next.js 14.2.3, App Router**, React 18, TypeScript strict, path alias `@/*` → repo root.
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) — auth + Postgres + RLS.
- **Stripe** (`stripe` v15, `@stripe/connect-js`, `@stripe/react-connect-js`, `@stripe/react-stripe-js`) — Connect Express payouts and platform billing.
- **Anthropic SDK** (`@anthropic-ai/sdk`) — AI advisor, content generation, video-studio scripting, marketplace import parsing.
- **Remotion** (`remotion`, `@remotion/player`, `@remotion/google-fonts`, transpiled via `next.config.mjs`) — the admin marketing-video studio in `components/video/`.
- **Bunny CDN** — media storage + streaming (`lib/bunny.ts`); `next.config.mjs` whitelists `*.b-cdn.net` / `*.bunnycdn.com` for `next/image`.
- **Resend** — transactional email via raw `fetch` in `lib/email.ts`.
- Tailwind is configured (`tailwind.config.ts`) but most of the UI is driven by hand-written CSS in `app/design.css` (~1200 lines), `app/backstagely-design.css`, and inline `<style>` blocks in layouts. Match the surrounding file's approach rather than introducing Tailwind into a CSS-class page.

## Architecture

### Route groups

`app/` uses route groups that carry no URL segment:

- `(marketing)` — public landing, `/for/[niche]`, `/vs/[competitor]`.
- `(auth)` — login, signup, fan-signup, password reset.
- `(platform)` — logged-in creator surface (dashboard, earnings, merch, live, messages, settings). `app/(platform)/layout.tsx` is a pure auth guard: no user → redirect `/login`.
- `app/[creator]/` — the **public creator page**, the product's centerpiece. It composes many client components (tiers, posts, merch, marketplace, wishlist, live player, super tips, medals, social add-backs) around a server-rendered profile.
- `app/admin/` — internal admin console, guarded by `app/admin/layout.tsx`.
- `app/api/` — ~130 route handlers. Heavy/AI/upload routes declare `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, and `maxDuration` (30–300s).

### Two Supabase clients — pick deliberately

`lib/supabase-server.ts` exports both:

- `createClient()` — cookie-bound, **anon key, RLS enforced**. Default for anything acting as the signed-in user.
- `createServiceClient()` — **service role key, RLS bypassed**. Only for admin routes (after `isAdmin()`), webhooks, cron jobs, and the claim flow. Never reachable from the browser.

`lib/supabase-client.ts` is the browser client (anon key only).

### Monetization model (read these before touching money)

- `lib/fees.ts` — single source of truth for Stripe fee handling. The platform takes **0%** of creator earnings; fans cover the card fee via `grossUpForStripe()`. Subscriptions use destination charges with `appFeePercentForGrossUp()`. The only platform revenue on tips is the Super Tip recognition fee, paid by the fan on top.
- `lib/billing.ts` — creator *platform* plans (Starter $29 → Legend $3499), `tierForCount()`, Stripe price bootstrapping, and `isBillingLocked()` (trial/grace/past-due/free lock semantics), plus fan-subscription pause/resume when a creator locks.
- `lib/entitlements.ts` — the capability MATRIX. **Gate features with `entitlementsFor(billing)` / `can(billing, cap)`, never with scattered `tier === "..."` checks.** Lock state (`isBillingLocked`) and entitlement are separate concerns; paid features check both.
- `lib/tiers.ts`, `lib/tier-templates.ts`, `lib/medals.ts`, `lib/offers.ts` — fan-facing subscription tiers, medals, and offers.

### Auth & authorization

- Sessions are Supabase Auth cookies, refreshed through `@supabase/ssr`.
- `middleware.ts` (matcher: `/`, `/dashboard`, `/onboarding`, `/feed`, `/account`, `/admin/:path*`) does session lookup, admin gating, and creator-vs-fan routing: `/` redirects to `/dashboard` for creators (or `/onboarding` if `onboarding_completed_at` is null) and `/feed` for fans. "Is a creator" = a `creator_profiles` row with `kind = 'spotlight'` for the user.
- **Middleware is routing, not authorization.** Every page and route handler re-checks auth server-side.
- `lib/admin.ts` → `isAdmin()` compares `auth.getUser().email` against `NEXT_PUBLIC_ADMIN_EMAIL` (case-insensitive). Changing the admin is an env-var change, no deploy. Every admin page calls `isAdmin()` → `notFound()`; every admin API route returns 403; server actions re-check inside the `"use server"` function.
- Cron routes (`/api/cron/*`, `/api/social-posts/backfill`) require `Authorization: Bearer ${CRON_SECRET}` (backfill uses an `x-cron-secret` header).
- Webhooks verify signatures: Stripe via `verifyWebhook()` in `lib/stripe.ts` (`STRIPE_WEBHOOK_SECRET`), plus CCBill and Printful handlers with their own secrets.

### Creator profiles

The live table is **`creator_profiles`**, not `creators`. Key columns (from `lib/database.types.ts` plus later migrations): `user_id`, `handle` (unique, the public URL `/{handle}`), `display_name`, `bio`, `avatar_url`, `cover_url`, `bg_url`, `location`, `creator_type` (`sfw` | `adult` | `young`), `kind` (`spotlight` for creator accounts), `linked`, `subscription_price`, `stripe_account_id`, `ccbill_account_number`, `veriff_verified`, `is_active`, `founded`, `medal_points_total`, `medal_count_total`. Later migrations add onboarding, claim (`claim_code`, `claimed_at`), niche, free-tier, social-links, and wishlist columns — check the migration files for exact names.

Related flows:
- **Onboarding** — `app/onboarding`, `/api/onboarding` (AI-assisted), `onboarding_completed_at` drives the middleware redirect.
- **Admin-built profiles + claim** — an admin can build a creator page (`/admin/creators/[id]/build`), which issues a `claim_code`; the creator claims it at `/claim/[code]` → `/api/claim/route.ts` sets their email/password via the service-role admin API and clears the code (single use).
- **Billing** lives in a separate `creator_billing` row keyed by `user_id`, not on the profile.

### Stripe & Stripe Connect

- `lib/stripe.ts` — the shared `Stripe` instance (`apiVersion: "2024-04-10"`), `createConnectAccount()` (Express, daily payouts, card_payments + transfers), `createOnboardingLink()`, `verifyWebhook()`.
- Connect onboarding: `/api/stripe/connect/start` → `/return` → `/refresh`, plus an embedded-components session at `/api/stripe/connect/session`. UI at `app/(platform)/connect-stripe`.
- Creator platform billing: `/api/billing`, `/api/billing/setup`, `/api/billing/portal`, dunning cron at `/api/cron/billing-dunning`.
- Fan payments: `/api/subscribe`, `/api/tip`, `/api/super-tip`, `/api/merch/checkout`, `/api/marketplace/purchase`, `/api/digital/purchase`, `/api/gift-subscription`, `/api/campaigns/donate`, `/api/live/tip`, `/api/medals/purchase`.
- All Stripe event handling funnels through `app/api/webhooks/stripe/route.ts`. CCBill is a parallel processor for adult accounts (`lib/ccbill.ts`, `/api/webhooks/ccbill`).

### Resend email

`lib/email.ts` posts to `https://api.resend.com/emails` with `RESEND_API_KEY`; `FROM` is `Spotlightly <hello@spotlightly.app>`. All templates share `base()` (dark HTML shell with the legal footer and `{{unsubscribe}}` token). Add new mail as an exported function using `base()` — don't build ad-hoc HTML or call Resend directly from a route. Missing key = warn and no-op, never throw. `sendAdminAlert()` notifies `NEXT_PUBLIC_ADMIN_EMAIL`. Called from `/api/email/*`, `lib/notify.ts`, and webhook handlers.

### Admin functionality (existing)

Pages under `app/admin/`: dashboard, `creators` (+ `[id]` detail and `[id]/build`), `subscribers`, `subscriptions`, `referrals`, `coupons`, `ads`, `comms` (announcement banner + `admin_messages` blasts), `content` (AI content engine), `moderation`, `flags`, `credentials` (`platform_settings` key/value store), `roadmap`, `video-studio` (Remotion marketing videos).

Backing APIs under `app/api/admin/`: `creators/{pick,post,profile,social-post,tier}`, `campaigns/create`, `content`, `studio/commit`, `video-studio/{analyze,caption,creators,creator/[id],hooks,script}`, `new-creator-alert`.

`platform_settings` (created in `01-migrations.sql`) stores credentials as key/value with RLS restricted to a **hardcoded admin UUID** — that policy and `NEXT_PUBLIC_ADMIN_EMAIL` must agree or the credentials page silently returns nothing.

### AI usage

Anthropic calls live in `app/api/advisor/*`, `app/api/admin/content`, `app/api/admin/video-studio/*`, `app/api/studio/build`, `app/api/onboarding`, `app/api/tiers/assist`, `app/api/campaigns/assist`, `app/api/posts/{publish,tags}`, `app/api/recommendations`, `app/api/marketplace/import/{photos,screenshots}`, `app/api/live/chat`, and `lib/advisor.ts`. Model IDs are hardcoded per route: mostly `claude-haiku-4-5-20251001`, one `claude-sonnet-4-6`, and `lib/advisor.ts:18` still pins `claude-sonnet-4-20250514` (Claude Sonnet 4, deprecated and past its stated June 2026 retirement — expect 404s; migrate to `claude-sonnet-5` or `claude-haiku-4-5`).

## Database & migrations

- **Repo migrations:** `supabase/migrations/NNN_name.sql`, currently through `058`. Numbers `031`–`036` have duplicates (two files share a prefix) — keep going forward, don't renumber history.
- **Style:** idempotent and additive — `create table if not exists`, `add column if not exists`, `drop policy if exists` before `create policy`, plus backfill `update`s where a new column replaces an old shape (see `058_post_gallery.sql`). Enable RLS on every new table and write explicit policies.
- **Root `01-migrations.sql`** is a separate, idempotent bundle intended to be pasted into the Supabase SQL Editor (it creates `platform_settings` among other things). It is not part of `supabase db push`.
- **Known schema drift — read this before trusting types:**
  - `001_initial.sql` creates `creators`, but the live table the app queries everywhere is `creator_profiles`. There is no `create table public.creator_profiles` in this repo; later migrations only `alter` it.
  - `lib/database.types.ts` covers only 13 tables and is out of date (no `creator_billing`, `medals`, `merch`, `marketplace`, `notifications`, …). That is why the codebase is full of `(supabase as any).from(...)`. Follow the local convention rather than fighting it, and confirm column names against the migration that added them.
- Never write raw SQL migrations that assume a table exists without an `if not exists` guard or a preceding creation in the same file.

## Testing

**Vitest**, configured in `vitest.config.ts`. Suites live in `lib/__tests__/`.
Both CI workflows (`test.yml` and `deploy.yml`) run `npm test`, so a failing
test blocks the deploy.

The runner is deliberately `environment: "node"` and scoped to **pure modules
only** — no DOM, no database, no network. That keeps `npm test` fast enough to
run on every commit. Anything needing a browser belongs in a separate
environment, not bolted onto this one.

Existing suites: `claim.test.ts` (claim-code format, expiry, rejection
precedence), `email.test.ts` (unsubscribe signing and verification),
`concierge.test.ts` (welcome-email suppression, unclaimed-page detection).

When you add a feature, put the decision logic in a pure function in `lib/` and
test that, rather than trying to test a route handler end to end. Good
untested targets remain: `lib/fees.ts`, `lib/entitlements.ts`, `lib/billing.ts`
(`tierForCount`, `isBillingLocked`, `isStarterDue`), `lib/import-core.ts`
(`normalizeCategory`, `normalizeCondition`, `sanitizePrice`).

### Lint

`.eslintrc.json` extends `next/core-web-vitals`. Before it existed, `next lint`
prompted for interactive setup and so never actually linted anything in CI.
`react/no-unescaped-entities` is set to `warn` rather than `error`: enabling it
surfaced 78 pre-existing violations across 21 files, all cosmetic apostrophes
in user-facing copy. Every other rule is at its default severity.

## Deployment

- **Vercel, driven by GitHub Actions.** `.github/workflows/deploy.yml`: on push to `main` → `vercel pull --environment=production` + `vercel build --prod` + `vercel deploy --prebuilt --prod`; on PR → the same against `preview`. Both preceded by `npm run typecheck` and `npm run lint`, so a type or lint error blocks the deploy.
- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Runtime env vars are managed in Vercel (and, for some credentials, in the `platform_settings` table surfaced at `/admin/credentials`).
- SQL migrations are **not** applied by CI. Run them yourself (`npm run db:push`, or paste into the Supabase SQL Editor for the root bundle) and do it before deploying code that depends on the new schema.
- `tools/deploy.ps1` + the root `README.md` describe a manual file-drop batch workflow that predates working directly in this repo, and reference an older repo path (`IFYKYK`, still the git remote). Don't use it for normal work.

## Environment variables

Public (browser-visible — never put a secret here): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_AMAZON_AFFILIATE_TAG`, `NEXT_PUBLIC_RENDER_URL`, `NEXT_PUBLIC_RENDER_SECRET`.

Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{STARTER,GROWTH,PRO,SCALE,LEGEND}`, `CCBILL_SECRET_WORD`, `PRINTFUL_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_UNSUBSCRIBE_SECRET`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `BUNNY_{API_KEY,STORAGE_ZONE,STORAGE_ENDPOINT,STREAM_KEY,STREAM_LIBRARY_ID,TOKEN_KEY}`, `CLOUDFLARE_{ACCOUNT_ID,STREAM_TOKEN,STREAM_CUSTOMER_CODE}`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `LOUDCAP_API_KEY`.

`EMAIL_UNSUBSCRIBE_SECRET` signs unsubscribe links (`lib/email.ts`). If it is
unset, emails render **no** unsubscribe link rather than a broken one — set it
before sending anything that needs an opt-out. Rotating it invalidates every
unsubscribe link already in recipients' inboxes.

`NEXT_PUBLIC_RENDER_SECRET` is public by prefix — treat it as non-secret and don't rely on it for authorization.

## Security requirements

- The service role key is server-only. Any new use of `createServiceClient()` must sit behind `isAdmin()`, a verified webhook signature, or `CRON_SECRET`.
- Enable RLS on every new table. Public-read policies must be explicit and narrow (e.g. `tier = 'free' and status = 'live'` on posts). Cross-creator or admin-only data gets an admin-only policy.
- Verify every inbound webhook signature before trusting the payload. Never trust a client-supplied creator/user id — derive it from the session or from the verified webhook.
- Paid content must be gated server-side. Don't ship a signed CDN URL, unlock token, or download link to a client that hasn't been authorized on the server. `bunnySignUrl()` in `lib/bunny.ts` is the intended lock for originals — it is a no-op until `BUNNY_TOKEN_KEY` is set and token auth is enabled on the pull zone.
- Never introduce a `NEXT_PUBLIC_` variable for anything sensitive.
- Validate and normalize request bodies in route handlers. `zod` is in `package.json` but is not imported anywhere yet — existing routes hand-validate with typed checks and coercion. Either approach is fine; skipping validation is not. Return 400 on bad input, 403 on unauthorized, and don't leak internal error text to fans.
- Age/consent columns (`date_of_birth`, `parental_consent_at`, `veriff_verified`, `creator_type: 'young'`) and moderation tables exist for compliance reasons — don't bypass or default them.

## Coding conventions

- **Server Components by default.** Add `"use client"` only for interactivity; page-level data fetching happens on the server with `await createClient()`.
- **Server actions** are declared inline with `"use server"` inside the page file and must re-run their own auth check (see `app/admin/comms/page.tsx`), then `revalidatePath()` and `redirect()`.
- **Route handlers** follow a consistent shape: auth check → `try { body = await req.json() } catch { 400 }` → validate/whitelist fields → DB work → `NextResponse.json({ ok: true })` or `{ error }` with a status. Copy that shape; don't invent a new response envelope.
- **Field whitelisting on updates** — build an explicit `fields` object from typed checks rather than spreading the request body into an `update()` (see `app/api/admin/creators/profile/route.ts`).
- `(supabase as any)` casts are the established workaround for the stale generated types. Keep using them rather than adding hand-written interfaces that will drift too.
- Long-running or AI routes must declare `runtime`, `dynamic`, and `maxDuration` explicitly.
- Money is handled in **cents as integers** in the fee helpers; DB price columns are `decimal(10,2)`. Convert at the boundary, don't do float math on dollars.
- Comment style: `lib/*` modules open with a boxed header comment explaining the module's role and its invariants. When you change behavior in one of those files, update the header.
- Write files as UTF-8 **without** a BOM. `.gitattributes` only normalizes line endings (`* text=auto`); the BOM rule comes from `tools/deploy.ps1`, and `lib/database.types.ts` currently carries one — don't add more.
- Theme is `data-theme` on `<html>`, set by the inline script in `app/layout.tsx` and toggled by `components/ThemeToggle.tsx`. Style both light and dark.
