# Spotlightly Creator Acquisition System — Implementation Plan

Status: **implemented through Stage 5; awaiting migration application and deployment.**

Implementation notes added after the plan was approved:

- **Migration numbers shifted.** Stage 0 needed schema of its own, so the
  final numbering is `059_claim_hardening` (claim expiry + email opt-outs),
  `060_creator_prospects`, `061_prospect_outreach`.
- **§17 assumption 1 is resolved.** `creator_profiles` RLS was verified
  against the live database: RLS is **enabled**, with a
  `SELECT using (true)` policy named *"Creators are publicly readable"*.
  Reads are therefore fully open to the `anon` key — including `claim_code`
  and the presence/PII columns from migration 054. Writes are safe:
  `UPDATE`/`INSERT` are scoped to `auth.uid() = user_id` and there is no
  `DELETE` policy. 7 live claim codes were exposed at the time of checking.
  Containment steps are in the Outstanding section at the end of this file.
- **Stage 1 was folded into Stage 0**, because Stage 0 was required to ship
  with tests and no runner existed.

## Context

Spotlightly needs to identify creator prospects, prepare a page for them, send a personally approved invitation, let them claim that page, and measure whether they activate. The repository already contains most of the machinery: admin-built creator pages, a claim-code flow, onboarding, Resend email, referral attribution, and Stripe Connect. What is missing is the *front* of the funnel (a prospect that is not yet a creator), an *approval gate* before outreach, and a *funnel view* that reports activation.

The design goal is therefore additive: **two new tables, one new column, one new email template**, and a set of admin screens that drive the existing flows rather than duplicating them. No new profile system, no new onboarding, no new claim token, no new email provider.

Exploration surfaced five pre-existing defects that this feature would otherwise amplify. Three are security issues and one is a compliance issue. They are Stage 0 and are not optional — the acquisition system multiplies each of them by the number of prospects.

---

## 0. Pre-existing defects that gate this work

| # | Defect | Evidence | Why acquisition makes it worse |
|---|---|---|---|
| 0.1 | **Claim is not atomically single-use — account takeover** | `app/api/claim/route.ts:18-40`: read → check `claimed_at` → `updateUserById` → *then* write `claimed_at`. Two concurrent POSTs both pass the check; the second one's email+password win. | Invitation links get forwarded and pasted into group chats. That is exactly the race condition. |
| 0.2 | **Creating a prospect with a real email auto-sends a welcome email** | `app/api/webhooks/auth/route.ts:16-29` sends `sendWelcomeEmail` on any `auth.users` INSERT. `createCreator` (`app/admin/creators/page.tsx:65-67`) creates an auth user. | Directly violates "never send outreach without approval" — and it fires *today*, before any approval UI exists, whenever the Supabase auth webhook is configured. |
| 0.3 | **Unclaimed prepared pages are fully public and indexable** | `app/[creator]/page.tsx:11-19` selects only `display_name, handle, bio, cover_url, deleted_at` and returns null solely on `deleted_at`. There is **no `published` gate**. `generateMetadata` (`:21-37`) emits OG title/description/image. No `robots` directive. | A page bearing a non-consenting person's name and likeness, with subscribe and tip buttons, is crawlable the moment the link is shared. Reads as implied endorsement. |
| 0.4 | **Email footer makes a false claim and has a dead unsubscribe** | `lib/email.ts:25` — "You're receiving this because you have a Spotlightly account" and `href="{{unsubscribe}}"`, a literal token substituted nowhere in the repo. | Cold outreach through `base()` would assert a relationship that does not exist and offer a non-functioning opt-out. |
| 0.5 | **`admin_messages` "sent" delivers nothing** | `app/admin/comms/page.tsx:30-38` sets `status:'sent', sent_at:now()` and never calls Resend. No code anywhere reads that table for delivery. | If approval were built on this table, "Approve & send" would mark records sent while nothing sends. |

**Decision: fix 0.1–0.4 in Stage 0. Leave 0.5 alone** — do not extend `admin_messages` (see §3).

---

## 1. Reuse unchanged

| Asset | Path | Role in acquisition |
|---|---|---|
| `createCreator` server action | `app/admin/creators/page.tsx:49-98` | The *only* path that mints a creator identity. Called at "Build page", unchanged, with the **synthetic** email. |
| Creator page builder | `app/admin/creators/[id]/build/{page.tsx,BuildClient.tsx}` | Step 4 verbatim. Already edits profile, posts, tiers, socials, affiliate picks. |
| Admin creator write APIs | `app/api/admin/creators/{profile,post,tier,pick,social-post}/route.ts`, `app/api/admin/studio/commit/route.ts` | No changes. |
| Claim UI | `app/claim/[code]/{page.tsx,ClaimForm.tsx}` | Step 9 verbatim (route logic hardens in Stage 0). |
| Onboarding | `app/onboarding/page.tsx`, `app/api/onboarding/route.ts` | Step 10 verbatim. No second onboarding. |
| Stripe Connect | `app/api/stripe/connect/*`, `app/(platform)/connect-stripe` | Step 10 verbatim. |
| Resend transport | `send()` + `base()` in `lib/email.ts` | Same provider, same file. One new template function (§2). |
| Admin auth | `isAdmin()` in `lib/admin.ts` | Every new screen and route. |
| Referral attribution pattern | `app/api/referrals/attribute/route.ts` | Copied *shape* for no-page prospects (§8). |
| Migration conventions | `supabase/migrations/*.sql` | `if not exists`, `drop policy if exists`, RLS on every new table. |

## 2. Extend

| Asset | Extension |
|---|---|
| `creator_profiles` | **One column:** `claim_expires_at timestamptz`. Nothing else. |
| `app/api/claim/route.ts` | Atomic claim (0.1), expiry check, hex-format guard, and one service-role write advancing `creator_prospects.stage`. |
| `app/admin/creators/page.tsx` | `createCreator` + `regenClaim` set `claim_expires_at = now() + 14 days`. |
| `lib/email.ts` | Add `sendProspectInvite()` with its **own** template — honest footer, real unsubscribe URL, no account claim. Reuses the existing `send()` and physical address. |
| `app/[creator]/page.tsx` | `generateMetadata` adds `robots:{index:false,follow:false}` when `published=false AND claimed_at is null`. Requires adding those two fields to the `lightProfile` select at `:15`. |
| `app/admin/page.tsx` | Creator counts (`:23-25`, `:42`) exclude unclaimed concierge rows so acquisition does not inflate its own KPI. |

## 3. Genuinely missing

1. A prospect record for someone who has **not** consented — no such concept exists (verified: zero `prospect`/`lead`/`outreach`/`pipeline` matches outside false positives).
2. Lead source / UTM — **no UTM infrastructure of any kind exists** anywhere in the repo.
3. Qualification (a reviewed decision, distinct from "exists").
4. Approval-before-send, enforced structurally rather than by convention.
5. A per-send outreach audit trail. The claim flow has **no audit trail at all** — nobody can answer "who was sent this link, by whom, when".
6. A funnel view joining prospect → claim → onboarding → Stripe → first transaction.
7. A test runner. None exists.

**Not missing (do not build):** activation milestones — every one is already a column or a countable row (§9).

---

## 4. Smallest database additions

**Two tables, one column.** Justification for each rejection of a smaller shape:

- *Prospect as a `creator_profiles` row?* **No.** It fires `trg_provision_free_billing` (`045_free_billing_status.sql:59-62`), creates a real `auth.users` row (triggering 0.2), publishes a live page (0.3), permanently consumes the handle, and inflates creator/billing counts — all for someone who has consented to nothing.
- *Single table with `last_outreach_at` + `outreach_count`?* **No.** Loses the audit trail, multi-touch sequencing, and any proof of *which* message was approved. Compliance evidence needs one immutable row per send.
- *Activation events table?* **No.** Second source of truth that will drift. Derive from existing columns.
- *Extend `admin_messages`?* **No.** Its RLS is a hardcoded UUID divergent from `isAdmin()` (`005_admin_tables.sql:96-99`), its `target` CHECK admits no per-person value, and its `sent` status is already meaningless (0.5). An approval control must not be built on the one known-broken authorization policy in the schema.

## 5. Exact migrations

Next free numbers are **059** and **060** (058 is current; 031/032/033/036 have duplicate prefixes — do not renumber history).

### `supabase/migrations/059_creator_prospects.sql`

```sql
-- Creator acquisition: people we have identified but who have NOT consented
-- to anything. Deliberately NOT creator_profiles rows — no auth user, no
-- billing row, no public page, no reserved handle until a page is built.
create table if not exists public.creator_prospects (
  id                 uuid primary key default gen_random_uuid(),
  display_name       text not null,
  handle_wanted      text,                    -- desired, NOT reserved
  email              text,
  platform           text,                    -- youtube|tiktok|instagram|twitch|substack|other
  platform_handle    text,
  profile_url        text,
  source             text not null default 'manual'
                       check (source in ('manual','referral','inbound','event','partner','other')),
  source_detail      text,
  utm                jsonb not null default '{}'::jsonb,
  discovered_by      uuid references auth.users(id),
  stage              text not null default 'identified'
                       check (stage in ('identified','qualified','page_built','invited','claimed','disqualified')),
  score              integer,
  niche              text,
  notes              text,
  disqualified_reason text,
  do_not_contact     boolean not null default false,
  opted_out_at       timestamptz,
  purge_after        timestamptz,             -- retention clock for un-consented PII
  creator_profile_id uuid unique references public.creator_profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists creator_prospects_email_key
  on public.creator_prospects (lower(email)) where email is not null;
create index if not exists creator_prospects_stage_idx
  on public.creator_prospects (stage, created_at desc);

-- Service-role only: RLS enabled with NO policies, following the precedent in
-- 035_referral_invite_sends.sql. Any query via createClient() returns zero rows.
alter table public.creator_prospects enable row level security;
```

### `supabase/migrations/060_prospect_outreach.sql`

```sql
-- One immutable row per outreach attempt. The CHECK constraints make an
-- unapproved send structurally impossible at the database level.
create table if not exists public.prospect_outreach (
  id             uuid primary key default gen_random_uuid(),
  prospect_id    uuid not null references public.creator_prospects(id) on delete cascade,
  channel        text not null default 'email' check (channel in ('email','dm','manual')),
  subject        text,
  body           text,
  claim_url_sent text,                        -- exact link mailed = the claim audit trail
  status         text not null default 'pending'
                   check (status in ('pending','approved','sent','failed','rejected')),
  approved_at    timestamptz,
  approved_by    uuid references auth.users(id),
  sent_at        timestamptz,
  provider_id    text,
  error          text,
  created_at     timestamptz not null default now(),
  constraint outreach_requires_approval
    check (sent_at is null or (approved_at is not null and approved_by is not null)),
  constraint outreach_status_consistent
    check ((status = 'sent') = (sent_at is not null))
);

create index if not exists prospect_outreach_prospect_idx
  on public.prospect_outreach (prospect_id, created_at desc);

alter table public.prospect_outreach enable row level security;

-- Invitation links expire. NULL = legacy/no expiry, so nothing in flight breaks.
alter table public.creator_profiles
  add column if not exists claim_expires_at timestamptz;
```

## 6. Administrator screens

| Route | Purpose |
|---|---|
| `/admin/prospects` | Pipeline list. Filter by stage/source/platform, search, add-prospect form. Columns: name, platform, source, stage, page-built, invited, claimed, activation %. |
| `/admin/prospects/[id]` | Detail. Public info, lead source, qualify/disqualify, "Build page" (→ `createCreator`, then links to the existing `/admin/creators/[id]/build`), outreach history, live activation checklist. |
| `/admin/prospects/[id]/outreach/new` | Compose invitation. Renders the exact email, shows the claim URL, saves as `pending`. **No send control on this screen.** |
| `/admin/prospects/funnel` | Counts and conversion rates per stage, derived by query (§9). |

Existing `/admin/creators` gains a link to `/admin/prospects` for the "hasn't agreed yet" case.

## 7. Creator-facing invitation and claim experience

1. Email from `sendProspectInvite()` — personal, states plainly how Spotlightly found them, links to the prepared page, one-click unsubscribe.
2. **Preview:** the existing `/{handle}` page, hardened by 0.3 (`noindex`) and carrying a visible "Preview — prepared for you, not yet claimed" banner so it cannot be read as endorsement. **`/preview/[creator]` is not used** — it is a campaign-first prototype that dead-ends with "No active campaign to headline" unless the creator has an `active` campaign row.
3. **Claim:** the existing `/claim/[code]`, unchanged for the creator. New states: expired link and already-claimed are distinguished.
4. Then the existing `/login?claimed=1` → onboarding → Stripe, untouched.

## 8. How attribution survives registration and claiming

**Two paths, and the primary one needs no client-side state at all.**

- **Prepared-page prospects (primary).** `creator_prospects.creator_profile_id` → `creator_profiles.claim_code` → `/claim/[code]` → `app/api/claim/route.ts` already resolves the profile server-side. Attribution is a server-side join. No cookie, no localStorage, no query param, nothing to lose. This is strictly more reliable than the referral pattern.
- **No-page prospects (secondary, best-effort).** Invitation links to `/signup?p=<token>`. Reuses the proven referral shape (`app/(auth)/signup/page.tsx:44-51` + `app/api/referrals/attribute/route.ts`): capture param on load → persist to `localStorage` → `supabase.auth.signUp()` → immediately POST `{token, userId: data.user.id}` to a **service-role** endpoint (necessary because no session exists before email confirmation) → idempotent write guarded by the `creator_profile_id` unique constraint.

Use `?p=` rather than `?ref=` — `?ref=` is already consumed by two different referral systems on that page and would collide.

## 9. How onboarding completion is derived from real data

**Nothing new is written.** A pure module, `lib/acquisition.ts`, exports `activationFor(input)` returning the milestone set — mirroring the fields the dashboard already trusts (`app/(platform)/dashboard/page.tsx:599-636`, `components/OnboardingChecklist.tsx:16-30`):

| Milestone | Derived from |
|---|---|
| Invited | `prospect_outreach.sent_at is not null` |
| Claimed | `creator_profiles.claimed_at` |
| Profile complete | `avatar_url` and `bio` both non-null |
| Onboarding complete | `creator_profiles.onboarding_completed_at` |
| Stripe connected | `creator_profiles.stripe_onboarded` — **not** `stripe_account_id`, which is set the moment a Connect account is created, before the creator submits anything |
| First tier | ≥1 `subscription_tiers` with `is_active` |
| First post | ≥1 `posts` with `status='live'` |
| First transaction | earliest `created_at` across `subscriptions`, `tips`, `merch_orders`, `marketplace_orders`, `digital_purchases`, `gift_subscriptions` |

`stage` is authoritative **only** for pre-profile states (`identified`, `qualified`, `disqualified`). Everything from `claimed` onward renders from the join, never from `stage`. This rule prevents dual-write drift and must be enforced in review.

Because `activationFor()` is pure, it is the highest-value unit test in the feature.

## 10. How approval is enforced before outreach

Four independent layers, so no single mistake sends mail:

1. **Database.** `outreach_requires_approval` makes a row with `sent_at` but no `approved_by` unrepresentable.
2. **Single choke point.** Exactly one function, `sendProspectInvite()`, may send prospect mail. It re-reads the row and refuses unless `status='approved'`, `approved_by is not null`, `do_not_contact=false`, and `opted_out_at is null`.
3. **Separate screens and actions.** Composing writes `pending`. Approval is a distinct admin action. Sending is a third, explicit action. No auto-send on save.
4. **Stage 0 fix 0.2** closes the accidental-send path: prospects are built with the **synthetic** `concierge_{handle}@spotlightly.app` address; the real address stays in `creator_prospects.email` until claim.

## 11. Security and RLS requirements

- Both new tables: **RLS enabled, no policies** — service-role only, following `035_referral_invite_sends.sql`. Document at the table that `createClient()` returns zero rows by design.
- Every new page and route calls `isAdmin()` server-side. Middleware is routing, not authorization.
- **`creator_profiles` RLS is unverifiable from this repo** (no `CREATE TABLE`, no policy in any migration) while `app/admin/creators/page.tsx:142` reads `claim_code` — a live bearer secret — through the **anon** client. Stage 0 must verify the live policy in Supabase. If RLS is off or permissive, every unclaimed claim code is readable via PostgREST by anyone. **Switch that query to `createServiceClient()` regardless.**
- Claim hardening: atomic single-use UPDATE, 14-day expiry, `/^[0-9a-f]{32}$/` format guard before any DB call (`/claim/*` is currently an unauthenticated service-role probe), WAF rule on `/claim/*` and `/api/claim`.
- `do_not_contact` and `opted_out_at` honored at send time; unsubscribe writes `opted_out_at`.
- `purge_after` set on non-responders; a retention job is scoped but not built in v1.
- No payment calculation is touched. No scraping is added.

## 12. Test strategy

No runner exists, so Stage 1 installs one.

**Install:** `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`. Add `"test": "vitest run"` and `"test:watch": "vitest"`. Add `npm test` to **both** `.github/workflows/test.yml` and `deploy.yml` (deploy runs typecheck+lint today, so a failing test would otherwise still ship).

**Tier 1 — pure unit (no DB), the bulk of the value:**
- `lib/acquisition.ts` — `activationFor()` across every milestone combination, including the `stripe_account_id`-set-but-`stripe_onboarded`-false trap.
- Prospect stage transition validity.
- Invite-eligibility predicate: `do_not_contact`, `opted_out_at`, missing email, unapproved, already sent.
- Claim-code format guard and expiry logic.
- Free wins while the runner is being added: `lib/fees.ts`, `lib/entitlements.ts`, `lib/billing.ts`.

**Tier 2 — route handlers with a mocked Supabase client:** claim route returns 400 on expired/claimed/malformed; send route refuses unapproved rows; admin routes 403 without `isAdmin()`.

**Tier 3 — integration against a local Supabase, run manually:** the DB CHECK constraints genuinely reject an unapproved send; concurrent claim attempts produce exactly one winner (the 0.1 regression test).

**Explicitly out of scope for v1:** browser E2E.

## 13. Implementation stages, ordered by revenue impact

**Stage 0 — Security and consent hardening.** Fixes 0.1–0.4 plus the `creator_profiles` RLS verification. No new feature. First because acquisition multiplies each defect, and 0.2 is an active unapproved-send path.

**Stage 1 — Test runner.** Vitest + CI wiring + `lib/fees.ts`/`lib/entitlements.ts` tests. Before feature code, so the feature ships tested.

**Stage 2 — Prospect record and pipeline.** Migration 059, `/admin/prospects` list and detail, add/qualify/disqualify. *Revenue impact: none directly — it is the precondition for everything else.*

**Stage 3 — Invitation with approval gate.** Migration 060, `sendProspectInvite()`, compose → approve → send. **This is the first revenue-bearing stage** — it is the step that actually recruits creators.

**Stage 4 — Attribution through claim.** Claim route advances prospect stage; `?p=` path for no-page prospects.

**Stage 5 — Activation funnel.** `lib/acquisition.ts` + `/admin/prospects/funnel`. Last because it measures rather than produces revenue, and is worthless before real data exists.

## 14. Acceptance criteria

**Stage 0** — Concurrent claims on one code: exactly one succeeds, the other gets a clean error, and no auth user is mutated twice. An expired code is rejected. `/claim/zzz` returns 404 without a DB call. An unclaimed `published=false` page returns `noindex`. Creating a creator with a real email sends **no** mail. `creator_profiles` RLS confirmed in writing; admin claim-code query uses the service client. Existing claim links keep working (`claim_expires_at` NULL).

**Stage 1** — `npm test` runs and passes; both workflows fail on a deliberately broken test; existing `lint`/`typecheck`/`build` unaffected.

**Stage 2** — An admin adds a prospect with a lead source and qualifies it. **No `auth.users` row, no `creator_profiles` row, no `creator_billing` row, and no public page** is created. Non-admins get 403/404. The table is unreadable via the anon client.

**Stage 3** — "Build page" produces a draft via the *existing* `createCreator` and the *existing* builder, linked by `creator_profile_id`, using the synthetic email. A composed message saves as `pending` with no send. Send is refused while `pending`, and refused for `do_not_contact`/opted-out. A direct DB insert of `sent_at` without `approved_by` **fails on the CHECK constraint**. After an approved send, `prospect_outreach` holds the exact `claim_url_sent`.

**Stage 4** — Claiming an invited prospect's page sets `claimed_at`, nulls `claim_code`, and advances `stage` to `claimed` in one flow. A no-page prospect signing up via `?p=` is attributed after email confirmation. Re-running attribution is idempotent.

**Stage 5** — The funnel reports each stage from live data. A creator who connects Stripe shows "Stripe connected" **only** once `stripe_onboarded` is true. First-transaction date matches the earliest row across all six revenue tables. Deleting a prospect never deletes a claimed creator (`on delete set null`).

## 15. Existing files likely modified

| File | Change |
|---|---|
| `app/api/claim/route.ts` | Atomic claim, expiry, format guard, prospect stage write |
| `app/claim/[code]/page.tsx` | Expiry check; distinguish expired vs already-claimed |
| `app/admin/creators/page.tsx` | Set `claim_expires_at`; service client for claim-code read; link to `/admin/prospects` |
| `app/api/webhooks/auth/route.ts` | Suppress welcome email for unclaimed concierge accounts |
| `app/[creator]/page.tsx` | `noindex` for unclaimed unpublished; add fields to `lightProfile` select |
| `lib/email.ts` | Add `sendProspectInvite()` + honest prospect template; real unsubscribe URL |
| `app/admin/page.tsx` | Exclude unclaimed rows from creator KPI counts |
| `package.json` | Vitest deps + `test` scripts |
| `.github/workflows/{test,deploy}.yml` | Add `npm test` |
| `CLAUDE.md` | Update the Testing section once a runner exists |

## 16. New files

```
docs/creator-acquisition-system.md            # this plan
supabase/migrations/059_creator_prospects.sql
supabase/migrations/060_prospect_outreach.sql
lib/acquisition.ts                            # pure activation/stage logic
lib/prospects.ts                              # server-side prospect + outreach data access
app/admin/prospects/page.tsx
app/admin/prospects/[id]/page.tsx
app/admin/prospects/[id]/OutreachComposer.tsx
app/admin/prospects/funnel/page.tsx
app/api/admin/prospects/route.ts              # create/update/qualify/disqualify
app/api/admin/prospects/build-page/route.ts   # calls existing createCreator path
app/api/admin/prospects/outreach/route.ts     # compose (pending) / approve / send
app/api/prospects/attribute/route.ts          # service-role, no-page attribution
vitest.config.ts
lib/__tests__/acquisition.test.ts
lib/__tests__/fees.test.ts
lib/__tests__/entitlements.test.ts
```

## 17. Risks, assumptions, repository inconsistencies

**Risks**
1. **Dual-write drift** on `stage`. Mitigated by the §9 rule: `stage` authoritative only pre-profile.
2. **Stage 3 still exposes prepared pages.** `noindex` reduces but does not remove it — the page remains reachable by direct link. The visible preview banner is the second mitigation.
3. **`trg_provision_free_billing` still fires** for page-built prospects. Accept it (inert: `free`, no card). Exclude `claimed_at is null` from billing/MRR reporting. **Do not modify the trigger** — it exists to stop live creator pages going dark.
4. **Handle squatting deferred.** `handle_wanted` is not reserved, so a courted prospect can lose their handle to an organic signup. Reserving a handle for a non-consenting person is the worse trade; building the page is the deliberate escalation that reserves it.
5. **Two admin creation paths** persist — an admin can still hand-create a creator, producing an unattributed profile. Do not block it.
6. **RLS-on-no-policies is silent.** A future page using `createClient()` on these tables gets zero rows with no error. Document at the table.
7. **Cold outreach is a legal exposure.** CAN-SPAM/GDPR review before the first send. Not legal advice.

## Outstanding — required before this system is live

These are operational steps that need database and deployment access.

1. **Apply the three migrations individually, in order**, via the Supabase SQL
   Editor (not `npm run db:push`, which would replay the entire drifted
   migration history against production):
   `059_claim_hardening.sql` → `060_creator_prospects.sql` → `061_prospect_outreach.sql`.
   Each ends with a `select '… complete'` line so success is visible.
2. **Rotate the exposed claim codes** — see `supabase/verify/creator_profiles_rls.sql`
   for the full incident steps. Capture the affected handles first.
3. **Deploy**, then `revoke select (claim_code, claim_expires_at) on
   public.creator_profiles from anon, authenticated;` — in that order, because
   the currently deployed admin page still reads that column via the anon client.
4. **Set `EMAIL_UNSUBSCRIBE_SECRET`** in Vercel. Without it, emails render no
   unsubscribe link at all, and prospect outreach must not be sent.
5. **Narrow the `using (true)` policy.** Worth its own stage: the public
   creator page, Explore, search, and the sitemap all read this table through
   the anon client, so the column list needs auditing before it is restricted.

**Assumptions (verify before building)**
1. ~~`creator_profiles` RLS state~~ — **resolved**; see the status note at the
   top of this file.
2. The live `creator_profiles` schema matches what code references; `lib/database.types.ts` covers only 13 tables and is stale.
3. Whether the Supabase auth webhook (0.2) is currently configured in the dashboard.
4. Admin remains a single person; `isAdmin()` has no roles model.

**Repository inconsistencies found**
1. `creator_profiles` has **no `CREATE TABLE`** in any migration; `001_initial.sql` creates a different legacy `creators` table. Migration history is not a complete record.
2. Two divergent admin authorization mechanisms: `isAdmin()` (env email) vs hardcoded UUID `9b5ac2dc-…` in the `platform_settings` and `admin_messages` RLS policies.
3. `createCreator` inserts `creator_type: "spotlight"` (`app/admin/creators/page.tsx:77`), but the legacy constraint is `('sfw','adult','young')` — admin-created creators carry a different `creator_type` than self-signup creators. Any pipeline query filtering on it must account for this.
4. Two parallel email systems: typed senders in `lib/email.ts` vs raw HTML in `app/api/email/notify/route.ts`. Six of eight `lib/email.ts` exports are orphaned.
5. `/api/email/notify` and `/api/email/welcome` are **unauthenticated** — anyone who can reach them can send mail as Spotlightly.
6. `referral_invite_sends` (035) is dead schema whose comment describes exactly this feature's send-tracking. `prospect_outreach` supersedes it; propose dropping it in a later cleanup.
7. `components/AnalyticsDashboard.tsx` is orphaned — the live UI is `AnalyticsPane` inline in `dashboard/page.tsx`.
8. `lib/notify.ts`'s `NotifType` union exceeds the `024_notifications.sql` CHECK constraint; inserts with newer types will fail unless a later migration widened it.
9. Duplicate migration prefixes at 031/032/033/036 — ordering is alphabetical, not numeric.
10. `/preview/[creator]` is a campaign-first prototype, not a preview mechanism, despite its name.
