# Test Gaps (Phase 10)

## What exists

`vitest.config.ts`, `environment: "node"`, scoped to pure modules — no DOM, no database, no
network. Both CI workflows run `npm test`, so a failure blocks deploy.

```
lib/__tests__/acquisition.test.ts       22 tests
lib/__tests__/claim.test.ts             31 tests
lib/__tests__/concierge.test.ts         17 tests
lib/__tests__/email.test.ts             16 tests
lib/__tests__/prospect-import.test.ts   23 tests
lib/__tests__/prospects.test.ts         51 tests
                                       160 tests, 6 files — all passing (1.43s)
```

The design is sound: decision logic is extracted into pure `lib/` functions and tested there.
`claim.test.ts` in particular covers rejection precedence and expiry properly — and `/api/claim`
is correspondingly the best-hardened route in the codebase. That correlation is not a coincidence,
and it is the argument for extending the same approach.

## Coverage of the flows you asked about

| Flow | Test coverage | Would tests have caught the defect? |
|---|---|---|
| Signup | ❌ none | — |
| Creator onboarding | ❌ none | — |
| Referral signup | ⚠️ none for the referral path itself | **Yes.** SL-005 (unauthenticated $29 credit) is testable as a pure function: `creditsEarned(uncreditedCount)` plus an ownership predicate. |
| Tip payment | ❌ none | **Yes.** A fixture asserting the webhook's tip insert names only real columns would have caught SL-024/SL-025. |
| Subscription invoice | ❌ none | Partly — the ledger logic is sound; the `updated_at` defect (SL-009) needs a schema check, not a unit test. |
| Digital purchase | ❌ none | **Yes.** SL-020 (`file_type`) is a schema-shape assertion. |
| Refund | ❌ none — **the feature does not exist** | n/a (SL-008) |
| Creator dashboard earnings | ❌ none, despite `lib/earnings.ts` being pure and trivially testable | **Yes.** `net()`/`gross()`/`settled()` per source are pure functions over row objects. This is the single highest-value gap. |
| Admin revenue | ❌ none | **Yes.** SL-018 (platform revenue is structurally $0) is obvious the moment you assert a non-zero expectation. |
| Creator payout | ❌ none — **the feature does not exist** | n/a |
| Unauthorized cross-account access | ❌ none | Partly — route-level scoping is sound; the real exposure is RLS, which needs integration tests against a real database. |
| Failed Supabase write | ❌ none | **Yes**, with a fake client returning `{ data: null, error }`. `totalFor()` in `lib/earnings.ts` already has the `failed: true` branch — untested. |
| Duplicate webhook delivery | ❌ none | **Yes.** Feeding the same event twice through a pure event-router is exactly the shape of test that catches SL-007. |

## Untested pure modules — ranked by risk

Every one of these is already a pure function in `lib/`. No new architecture is needed.

| Module | Functions | Why it matters |
|---|---|---|
| `lib/earnings.ts` | `net`, `gross`, `settled` per source; `creatorEarnings` failure aggregation | The single source of truth for money. Untested. |
| `lib/fees.ts` | `grossUpForStripe`, `appFeePercentForGrossUp`, `minChargeCents`, `superTipRecognitionCents` | Every payment amount on the platform. Off-by-one in the `Math.ceil` rounding is silently absorbed. |
| `lib/entitlements.ts` | `entitlementsFor`, `can` | Feature gating. A wrong default grants paid features free. |
| `lib/billing.ts` | `tierForCount`, `isBillingLocked`, `isStarterDue` | Boundary conditions decide who gets charged what. |
| `lib/import-core.ts` | `normalizeCategory`, `normalizeCondition`, `sanitizePrice` | `sanitizePrice` handles untrusted CSV input. |
| `lib/medals.ts`, `lib/offers.ts`, `lib/tiers.ts` | pricing and tier maths | User-visible pricing. |

CLAUDE.md already names `fees.ts`, `entitlements.ts`, `billing.ts` and `import-core.ts` as "good
untested targets". That list is still accurate. `earnings.ts` should be added at the top of it.

## What unit tests structurally cannot catch here

Nine of the fourteen critical findings are RLS or schema defects. No Node-environment unit test
can detect them, because there is no database in the test environment — and, more fundamentally,
because **`creator_profiles` has no `CREATE TABLE` in version control, so no database can be
reproduced from this repository at all** (SL-036).

That is the deepest gap in this report. Without a reproducible schema there can be no integration
test, which is why schema-drift bugs keep shipping undetected.

## Recommended additions, in order

**1. A schema-shape test (highest value, no infrastructure needed).**
Parse `supabase/migrations/*.sql`, extract every table's columns, and assert that every
`.from().select()/.insert()` in the codebase names only real columns. `_tools/schema.js` and
`_tools/refs.js` in this audit are a working implementation — roughly 400 lines, already written,
and they found 13 real defects. Wiring them into `npm test` would have caught SL-004, SL-009,
SL-016, SL-017, SL-020 and SL-021 before any of them shipped.

**2. A CHECK-constraint value test.**
Assert that every status literal written in code is a member of the corresponding CHECK
constraint. `_tools/states.js` implements this; it found SL-010 and SL-015.

**3. Pure unit tests for `lib/earnings.ts` and `lib/fees.ts`.**
Table-driven over row fixtures, including the error path that sets `failed: true`.

**4. Commit a baseline schema migration**, then add integration tests against a local
`supabase db reset`. This is the prerequisite for testing RLS at all — and RLS is where the
critical findings live.

**5. Webhook replay tests.** Feed a fixture event through the handler twice and assert exactly
one row is created. Requires extracting the event router from the request handler, which is worth
doing regardless.
