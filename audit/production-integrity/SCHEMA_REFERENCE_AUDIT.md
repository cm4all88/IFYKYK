# Schema Reference Audit (Phase 1)

## Method

Migrations were treated as the source of truth and parsed mechanically, not grepped.

1. `_tools/schema.js` parses all 64 files in `supabase/migrations/` plus the root
   `01-migrations.sql` into a structured inventory — handling `$$`-quoted function bodies,
   balanced-paren column lists, inline vs. table-level constraints, `ALTER … ADD/DROP COLUMN`,
   `DROP POLICY` before `CREATE POLICY`, and unique indexes as unique constraints.
2. `_tools/refs.js` walks `app/`, `lib/`, `components/`, `hooks/`, `config/`, `tools/` and
   `middleware.ts` and extracts **every** Supabase call by brace-matching the call arguments —
   so multi-line chains and chains broken across statements are parsed correctly, not
   line-matched. It resolves `.select()` strings including embedded relations (`rel(a,b)`),
   aliases (`alias:col`) and FK hints (`table!column`).
3. `_tools/effective.js` builds an *effective* schema by unioning migration DDL with the `Row`
   types in `lib/database.types.ts`, so stale generated types cannot produce false positives.

### Inventory produced

| Object | Count |
|---|---|
| Tables | 73 |
| Columns | 900+ |
| Unique constraints (incl. unique indexes) | 79 indexes parsed |
| Functions | 12 (10 distinct; `provision_free_billing` redefined in 057) |
| Triggers | 4 |
| Views | 1 (`creator_medal_month`) |
| Storage buckets | 1 (`digital-products`, private, 500 MB cap) |
| Storage policies | 4 |
| RLS: enabled with policies | 58 tables |
| RLS: enabled, zero policies | 6 tables |
| RLS: not enabled | 9 tables |

### Code-side inventory

| Call type | Count |
|---|---|
| `.from()` query chains | 630 |
| `.rpc()` calls | 6 |
| `.storage.from()` calls | 2 |

Raw data: `_tools/schema.json`, `_tools/schema.txt`, `_tools/refs.json`, `_tools/problems.json`.

---

## The blocking caveat: `creator_profiles` has no `CREATE TABLE`

`creator_profiles` is the central table of the product and **its definition exists nowhere in
version control**. The first reference to it is an `UPDATE` in `004_remove_opening_act.sql`;
every later migration only `ALTER`s it. `001_initial.sql` instead creates `public.creators`.

Consequences that shaped this entire audit:

- 47 of its columns come from `ALTER` statements; the base columns (`id`, `user_id`, `handle`,
  `display_name`, `bio`, `avatar_url`, `cover_url`, `kind`, `linked`, `is_active`, …) exist only
  in the live database and partially in `lib/database.types.ts`.
- Column checks against `creator_profiles` are **unverifiable from the repository**. Before
  applying the effective-schema union, this table alone produced 414 of 472 false positives.
- `supabase db reset` cannot reproduce production, so there is no environment to
  integration-test against. This is the structural reason the same bug class keeps recurring.

Related drift, equally uncommitted: the live database renamed `creator_id` → `creator_profile_id`
on `posts`, `channels`, `subscriptions` and probably `tips`. Evidence: `lib/database.types.ts`
shows `subscriptions.creator_profile_id`, while `001_initial.sql` declares `subscriptions.creator_id`;
application code uses `creator_profile_id` 357 times versus `creator_id` 39 times. The committed
FKs still target the legacy `public.creators` table.

---

## A. References to tables that do not exist

**None.** The only candidate, `creator_medal_month` (`app/(platform)/dashboard/page.tsx:619`,
`app/wall/page.tsx:18`), is a **view** defined in `032_medals.sql`. False positive; both uses
are valid.

## B. References to columns that do not exist

After reconciling against the effective schema, 13 remained. Each was individually verified.

| # | Location | Reference | Verdict |
|---|---|---|---|
| 1 | `app/api/webhooks/stripe/route.ts:147` | `subscriptions.updated_at` | **CONFIRMED absent** — not in 001/011/018, not in `database.types.ts`. → SL-009 |
| 2 | `app/api/gift-subscription/redeem/route.ts:25` | `subscriptions.updated_at` | **CONFIRMED absent** — same. → SL-009 |
| 3 | `app/api/fan/me/route.ts:15` | `subscriptions.canceled_at` | **CONFIRMED absent.** → SL-016 |
| 4 | `app/api/fan/me/route.ts:30` | `super_tips.amount` | **CONFIRMED absent** — column is `amount_usd`. → SL-016 |
| 5 | `app/api/fan/me/route.ts:47` | `posts.title` | **CONFIRMED absent** — column is `caption`. → SL-016 |
| 6 | `app/api/analytics/route.ts:39` | `tips.amount_usd` | **CONFIRMED absent** — column is `amount`. `lib/earnings.ts:74` documents this exact bug as fixed; analytics was never updated. → SL-017 |
| 7 | `app/(platform)/dashboard/page.tsx:2843` | `digital_products.file_type` | **CONFIRMED absent** — not in 017, 062, or types. → SL-020 |
| 8 | `app/(platform)/dashboard/page.tsx:4121` | `channels.is_free` | **CONFIRMED absent.** → SL-021 |
| 9 | `app/api/download/[token]/route.ts:29` | `digital_purchases.token_expires_at` | **CONFIRMED absent** — guard silently always passes. → SL-004 |
| 10 | `app/api/download/[token]/route.ts:33` | `digital_purchases.max_downloads` | **CONFIRMED absent** — guard silently never fires. → SL-004 |
| 11 | `app/api/webhooks/stripe/route.ts:104` | `tips.stripe_session_id` | **DIVERGENCE RISK** — 001 declares `stripe_payment_intent_id`. → SL-024 |
| 12 | `app/api/wishlist/confirm/route.ts:62` | `wishlist_purchases.transfer_stripe_id` | **CONFIRMED absent** — column is `stripe_transfer_id`. Payout reference never recorded. |
| 13 | `app/api/moderation/*` | `moderation_events` field | Verified present; false positive from alias parsing. |

Also confirmed absent but not caught by column matching (they are *values*, not columns):

- `app/api/webhooks/stripe/route.ts:235` — `wishlist_purchases.status = 'pending'` violates the
  CHECK in `007_launch_columns.sql:171`. → SL-010
- `app/api/subscription/cancel/route.ts:34` and two others — `subscriptions.status = 'cancelling'`
  violates the CHECK in `001_initial.sql`. → SL-015

## C. Incorrect foreign key assumptions

`app/api/fan/me/route.ts` uses PostgREST FK hints that name columns which do not exist on the
parent table. PostgREST resolves `table!column` against real constraints; an unknown one is a
hard error, not a fallback.

| Location | Hint | Actual FK column |
|---|---|---|
| `fan/me:23` | `tips → creator_profiles!creator_profile_id` | `tips.creator_id` (per 001) |
| `fan/me:47` | `posts → creator_profiles!creator_profile_id` | `posts.creator_id` (per 001) |
| `fan/me:16` | `subscriptions → creator_profiles!creator_id` | live column is `creator_profile_id` — hint is inverted relative to the others in the same file |

The inconsistency *within one file* is itself the tell: three different assumptions about the
same rename, in six adjacent queries.

Verified-correct FK hints (14): `digital_products!creator_profile_id`,
`subscription_tiers!creator_profile_id`, `merch_products!creator_profile_id`,
`live_streams!creator_profile_id`, `social_addback_orders!addback_id`, and the embeds in
`admin/moderation`, `admin/subscriptions`, `api/feed`, `api/live/chat`, `api/live/tip`,
`api/recommendations`, `api/tiers` (×2), `api/webhooks/printful`.

## D. Old table names and legacy schema references

- `public.creators` — created in `001_initial.sql`, still the FK target for `posts.creator_id`,
  `posts.collab_creator_id`, `channels.creator_id`, `subscriptions.creator_id`. **Zero
  references from application code.** Superseded by `creator_profiles`.
- `public.parental_tokens` — dropped in `004`, **recreated** by `01-migrations.sql` (which is
  applied by hand and is idempotent). → SL-053
- `public.referrals`, `public.wallets`, `public.ccbill_subscriptions`, `public.live_offers`,
  `public.live_offer_claims`, `public.pii_blocks`, `public.records_2257`,
  `public.fan_activity`, `public.social_addback_purchases` — defined, never referenced. → SL-057
- `01-migrations.sql` writes RLS policies for `posts` and `channels` using `creator_profile_id`,
  while `001_initial.sql` creates those tables with `creator_id`. The two committed migration
  sets describe mutually incompatible schemas.

## E. `creator_id` vs `creator_profile_id`

Application code has settled on `creator_profile_id` (357 uses vs 39). The 39 remaining
`creator_id` uses were checked individually:

- `social_posts.creator_id` — **correct**, that is the real column name (021).
- `creator_referrals.referrer_profile_id`, `subscriber_referrals.referrer_profile_id` — correct.
- `app/api/fan/me/route.ts:16` — the inverted FK hint above, **incorrect**.
- The remainder are local JS variable names, not column references.

## F. Queries whose selected fields do not match the schema

Covered in section B. The systemic amplifier is that **none of these failures is visible**: 8 of
the 13 are absorbed by `?? []`, `?? 0` or an unchecked write. See `SILENT_FAILURES.md`.

## G. Writes that do not provide required fields

The scanner flagged 34 inserts missing a NOT NULL column with no default. Most are false
positives — ES6 shorthand properties (`{ amount }`) are not matched by a `key:` pattern, and the
`creator_id` entries reflect the uncommitted rename. After manual review, the genuine ones:

| Location | Table | Missing | Verdict |
|---|---|---|---|
| `app/api/webhooks/stripe/route.ts:104` | `tips` | `creator_receives`, `platform_receives` | Both `decimal(10,2) not null` with **no default** in 001. → SL-025 |
| `app/api/webhooks/stripe/route.ts:386` | `gift_subscriptions` | `redemption_code` | Flagged; the column has a default in 010. False positive. |
| `lib/notify.ts:86` | `notifications` | `user_id`, `type`, `title` | Built dynamically from a params object. False positive. |

## H. Upserts and their conflict targets

17 upserts analysed against real unique constraints and primary keys. **15 resolve to a genuine
unique constraint or PK.** Two are unresolvable from the repository:

| Location | Target | Available uniques | Verdict |
|---|---|---|---|
| `app/api/webhooks/stripe/route.ts:156` | `fan_user_id,creator_profile_id` | `stripe_subscription_id`, `(creator_id, fan_user_id)` | Almost certainly fine — the constraint was renamed with the column. Confirm with query 3 below. |
| `app/api/gift-subscription/redeem/route.ts:25` | `fan_user_id,creator_profile_id` | same | same |

An upsert whose `onConflict` names no real constraint raises `42P10` and fails outright — it does
not silently insert a duplicate. Both are additionally broken by the `updated_at` column
(SL-009), which is the more urgent defect on the same statement.

## I. Code expecting columns from migrations that may not be applied

`062_digital_storage.sql` is the highest-risk unapplied migration. `app/api/digital/download/route.ts:52`
branches on `digital_products.storage_provider`; if 062 has not run, that column does not exist,
the select fails, and **every digital download breaks**. The upload path at
`app/(platform)/dashboard/page.tsx:2812` already anticipates this with a bucket-missing error
message, which suggests it has been hit before.

`063_subscription_payments.sql` is required by `lib/earnings.ts` (source `subscription_payments`)
and by the webhook ledger insert. If unapplied, subscription revenue reports as a failed source —
correctly flagged, at least, rather than silently zero.

---

## Verification queries

These five queries resolve every `CONFIRMED-SCHEMA-DIVERGENCE-RISK` finding. Read-only.

```sql
-- 1. Does tips use creator_profile_id, and does it have stripe_session_id?     [SL-024, SL-025]
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'tips'
order by ordinal_position;

-- 2. Does subscriptions really lack updated_at?                                       [SL-009]
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'subscriptions';

-- 3. What unique constraints actually exist on subscriptions?               [Section H above]
select con.conname, pg_get_constraintdef(con.oid)
from pg_constraint con join pg_class rel on rel.oid = con.conrelid
where rel.relname = 'subscriptions' and con.contype in ('u','p');

-- 4. Is RLS enabled on creator_profiles and the other eight?              [SL-011, SL-056]
select relname, relrowsecurity from pg_class
where relname in ('creator_profiles','moderation_events','pii_blocks','ccbill_subscriptions',
                  'referrals','live_offers','live_offer_claims','live_viewer_pings',
                  'live_usage_charges');

-- 5. Which permissive policies apply to anon/authenticated?    [SL-001,002,003,012,013,029]
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and (qual = 'true' or with_check = 'true')
order by tablename;
```

Query 5 is the important one. If `roles` reads `{public}` on those rows, every RLS finding in
this report is confirmed exactly as written.
