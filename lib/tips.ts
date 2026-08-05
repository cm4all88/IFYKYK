// ──────────────────────────────────────────────────────────────────────────────
// lib/tips.ts
//
// Builds the ledger row for a tip, as a pure function, so the decision can be
// tested without a database or a Stripe account.
//
// Why this exists: the Stripe webhook wrote four columns into a table with three
// NOT NULL columns it never supplied, never checked the result, and returned 200.
// `public.tips` held 0 rows. See LIVE_VERIFICATION.md §3.
//
// MONEY MODEL (lib/fees.ts is the authority, this must not disagree):
//   The fan pays `grossUpForStripe(tip)`, which is the tip plus Stripe's card
//   fee. Stripe transfers exactly the tip to the creator's Connect account via
//   payment_intent_data[transfer_data][amount]. The grossed-up remainder stays on
//   the platform and covers the card fee, netting the platform ~$0.
//
//   So, in the ledger:
//     amount            = the tip           (what the creator is credited)
//     creator_receives  = the tip           (100%; Spotlightly takes 0% of tips)
//     platform_receives = 0                 (the gross-up is a pass-through, not a cut)
//     fan_paid          = tip + card fee    (metadata only; not a tips column)
//
//   `lib/earnings.ts` computes tip net as `amount - platform_receives`, which
//   equals the tip. The two agree by construction.
// ──────────────────────────────────────────────────────────────────────────────

export type TipLedgerRow = {
  creator_profile_id: string;
  fan_user_id: string | null;
  amount: number;
  creator_receives: number;
  platform_receives: number;
  currency: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  stripe_event_id: string | null;
  message: string | null;
  is_live_tip: boolean;
};

export type TipBuildResult =
  | { ok: true; row: TipLedgerRow }
  | { ok: false; reason: TipBuildFailure };

export type TipBuildFailure =
  | "missing_creator_profile_id"
  | "missing_session_id"
  | "non_positive_amount"
  | "unsupported_currency";

/** Stripe reports minor units. Every Spotlightly checkout is USD today. */
const SUPPORTED_CURRENCIES = new Set(["usd"]);

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return NaN;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Round to cents. Money is decimal(10,2) in the database. */
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build the row for one tip from a verified `checkout.session.completed` event.
 *
 * Guests: `fan_user_id` is left null rather than faked. Migration 065 drops the
 * NOT NULL for exactly this case — a guest tip is a real tip with no account
 * behind it, and the fan-side read policy (`fan_user_id = auth.uid()`) simply
 * matches nothing, which is correct.
 */
export function buildTipLedgerRow(input: {
  session: {
    id?: string | null;
    amount_total?: number | null;
    currency?: string | null;
    payment_intent?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  eventId?: string | null;
}): TipBuildResult {
  const s = input.session ?? {};
  const meta = (s.metadata ?? {}) as Record<string, unknown>;

  const creatorProfileId = String(meta.creator_profile_id ?? "").trim();
  if (!creatorProfileId) return { ok: false, reason: "missing_creator_profile_id" };

  const sessionId = String(s.id ?? "").trim();
  if (!sessionId) return { ok: false, reason: "missing_session_id" };

  const currency = String(s.currency ?? "usd").toLowerCase();
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    // Storing a non-USD amount as if it were dollars would corrupt every
    // earnings figure by the currency's exponent. Refuse instead.
    return { ok: false, reason: "unsupported_currency" };
  }

  // The tip itself, as set server-side by /api/tip. amount_total is the grossed-up
  // charge (tip + card fee) and is NOT the creator's credit, so it is only a
  // fallback when metadata is somehow absent.
  const fromMeta = toNumber(meta.amount_usd);
  const tip = Number.isFinite(fromMeta) && fromMeta > 0
    ? fromMeta
    : toNumber(s.amount_total) / 100;

  if (!Number.isFinite(tip) || tip <= 0) return { ok: false, reason: "non_positive_amount" };

  const amount = money(tip);
  const fanUserId = String(meta.fan_user_id ?? "").trim();
  const message = String(meta.message ?? "").trim();

  return {
    ok: true,
    row: {
      creator_profile_id: creatorProfileId,
      // Guest tip -> null. Never a placeholder id.
      fan_user_id: fanUserId.length > 0 ? fanUserId : null,
      amount,
      creator_receives: amount,   // creator keeps 100%
      platform_receives: 0,       // the gross-up covers Stripe; platform nets ~0
      currency,
      stripe_session_id: sessionId,
      stripe_payment_intent_id: s.payment_intent ? String(s.payment_intent) : null,
      stripe_event_id: input.eventId ? String(input.eventId) : null,
      message: message.length > 0 ? message : null,
      is_live_tip: meta.is_live_tip === true || meta.is_live_tip === "true",
    },
  };
}

/**
 * Is this Postgres error the unique violation on `tips_stripe_session_id_key`?
 *
 * That means a previous delivery of the same event already recorded the tip, so
 * the correct response is 200 — not a retry, and not a second row.
 */
export function isDuplicateTip(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key|tips_stripe_session_id/i.test(String(error.message ?? ""));
}

export type TipWebhookOutcome = {
  /** HTTP status the webhook must return. */
  status: number;
  /** Will Stripe retry this delivery? Only a 5xx earns a retry. */
  retryable: boolean;
  /** Should the creator be notified? False on a duplicate — one tip, one email. */
  notify: boolean;
  outcome: "recorded" | "duplicate" | "unprocessable" | "write_failed";
};

/**
 * What the webhook must do about a tip, as a pure decision.
 *
 * This is the rule that was missing. The old handler ignored the insert result
 * entirely and returned 200, so Stripe recorded the event as delivered and never
 * retried — which is how every tip was lost silently.
 *
 *   built failed        -> 422, no retry. Malformed metadata; retrying cannot help.
 *   duplicate key       -> 200, no retry, NO second notification. Already recorded.
 *   any other db error  -> 500, RETRY. Transient failures must come back.
 *   success             -> 200, notify.
 */
export function tipWebhookOutcome(
  built: TipBuildResult,
  insertError: { code?: string | null; message?: string | null } | null
): TipWebhookOutcome {
  if (!built.ok) {
    return { status: 422, retryable: false, notify: false, outcome: "unprocessable" };
  }
  if (insertError && isDuplicateTip(insertError)) {
    return { status: 200, retryable: false, notify: false, outcome: "duplicate" };
  }
  if (insertError) {
    // Includes 23502 (the not-null violation that lost every tip), 42501 (RLS),
    // and genuinely transient failures such as a connection reset. All must be
    // retried rather than acknowledged.
    return { status: 500, retryable: true, notify: false, outcome: "write_failed" };
  }
  return { status: 200, retryable: false, notify: true, outcome: "recorded" };
}
