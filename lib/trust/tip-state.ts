// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/tip-state.ts
//
// The tip lifecycle as data. A tips row is created when a checkout session is
// created (status checkout_created) and only becomes money when a VERIFIED
// Stripe webhook moves it to succeeded. The client success redirect proves
// nothing and is never consulted.
//
// Every webhook driven change goes through canTransition(), so a redelivered
// or out of order event cannot move a row backwards (refunded -> succeeded) or
// credit it twice (succeeded -> succeeded is not a transition).
//
// Pure. The webhook reads the row, asks one of the plan* functions what to do,
// and applies the patch with a conditional update on the prior status.
// ──────────────────────────────────────────────────────────────────────────────

import { buildTipLedgerRow } from "@/lib/tips";

export const TIP_STATUSES = [
  "checkout_created",
  "payment_pending",
  "succeeded",
  "failed",
  "expired",
  "canceled",
  "refunded",
  "partially_refunded",
  "disputed",
  "dispute_lost",
] as const;
export type TipStatus = (typeof TIP_STATUSES)[number];

/** Rows in these states are real, settled money for the creator. */
export const CREDITED_TIP_STATUSES: readonly TipStatus[] = ["succeeded"];

export const TIP_SOURCES = ["profile", "post", "live_stream", "other", "unknown"] as const;
export type TipSource = (typeof TIP_SOURCES)[number];

const ALLOWED: Record<TipStatus, readonly TipStatus[]> = {
  checkout_created: ["payment_pending", "succeeded", "failed", "expired", "canceled"],
  payment_pending: ["succeeded", "failed", "expired"],
  succeeded: ["refunded", "partially_refunded", "disputed"],
  partially_refunded: ["refunded", "disputed"],
  refunded: ["disputed"],
  disputed: ["succeeded", "dispute_lost", "refunded"],
  failed: [],
  expired: [],
  canceled: [],
  dispute_lost: [],
};

export function isTipStatus(s: unknown): s is TipStatus {
  return typeof s === "string" && (TIP_STATUSES as readonly string[]).includes(s);
}

export function canTransition(from: TipStatus, to: TipStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function normalizeTipSource(s: unknown): TipSource {
  return typeof s === "string" && (TIP_SOURCES as readonly string[]).includes(s) ? (s as TipSource) : "unknown";
}

export type ExistingTip = {
  id: string;
  status: TipStatus;
  amount: number;
  stripe_payment_intent_id?: string | null;
};

export type TipPlan =
  | { kind: "update"; from: TipStatus; patch: Record<string, unknown>; notify: boolean }
  | { kind: "insert"; row: Record<string, unknown>; notify: boolean }
  | { kind: "noop"; reason: string };

const iso = (d: Date) => d.toISOString();

/**
 * checkout.session.completed or checkout.session.async_payment_succeeded for a tip.
 * `paymentStatus` is session.payment_status. Only "paid" credits the creator.
 */
export function planSessionPaid(args: {
  existing: ExistingTip | null;
  session: any;
  eventId: string;
  now: Date;
}): TipPlan {
  const s = args.session ?? {};
  const pay = String(s.payment_status ?? "");
  const target: TipStatus | null = pay === "paid" ? "succeeded" : pay === "unpaid" ? "payment_pending" : null;
  if (!target) return { kind: "noop", reason: `payment_status_${pay || "missing"}` };

  const pi = s.payment_intent ? String(typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent.id) : null;
  const common: Record<string, unknown> = {
    status: target,
    stripe_session_id: s.id ?? null,
    stripe_payment_intent_id: pi,
    stripe_event_id: args.eventId,
    status_updated_at: iso(args.now),
  };
  if (target === "succeeded") common.succeeded_at = iso(args.now);

  if (args.existing) {
    if (!canTransition(args.existing.status, target)) {
      return { kind: "noop", reason: `already_${args.existing.status}` };
    }
    if (target === "succeeded") {
      // Creator keeps 100%; the fan paid the gross up on top. lib/tips.ts is the money authority.
      common.creator_receives = args.existing.amount;
      common.platform_receives = 0;
    }
    return { kind: "update", from: args.existing.status, patch: common, notify: target === "succeeded" };
  }

  // A session created before this code shipped has no pre-created row.
  const built = buildTipLedgerRow({ session: { ...s, payment_intent: pi }, eventId: args.eventId });
  if (!built.ok) return { kind: "noop", reason: built.reason };
  const meta = (s.metadata ?? {}) as Record<string, unknown>;
  return {
    kind: "insert",
    row: {
      ...built.row,
      ...common,
      post_id: meta.post_id ? String(meta.post_id) : null,
      tip_source: normalizeTipSource(meta.tip_source),
      creator_receives: target === "succeeded" ? built.row.amount : 0,
    },
    notify: target === "succeeded",
  };
}

export function planAsyncFailed(existing: ExistingTip | null, eventId: string, now: Date): TipPlan {
  if (!existing) return { kind: "noop", reason: "no_row" };
  if (!canTransition(existing.status, "failed")) return { kind: "noop", reason: `already_${existing.status}` };
  return { kind: "update", from: existing.status, notify: false, patch: {
    status: "failed", failed_at: iso(now), failure_reason: "async_payment_failed", stripe_event_id: eventId, status_updated_at: iso(now),
  } };
}

export function planExpired(existing: ExistingTip | null, eventId: string, now: Date): TipPlan {
  if (!existing) return { kind: "noop", reason: "no_row" };
  if (!canTransition(existing.status, "expired")) return { kind: "noop", reason: `already_${existing.status}` };
  return { kind: "update", from: existing.status, notify: false, patch: {
    status: "expired", expired_at: iso(now), stripe_event_id: eventId, status_updated_at: iso(now),
  } };
}

/** charge.refunded. Full refund if charge.refunded is true, otherwise partial. */
export function planRefund(existing: ExistingTip | null, charge: any, eventId: string, now: Date): TipPlan {
  if (!existing) return { kind: "noop", reason: "no_row" };
  const target: TipStatus = charge?.refunded === true ? "refunded" : "partially_refunded";
  if (!canTransition(existing.status, target)) return { kind: "noop", reason: `already_${existing.status}` };
  return { kind: "update", from: existing.status, notify: false, patch: {
    status: target,
    refunded_at: iso(now),
    refunded_amount_cents: Number(charge?.amount_refunded ?? 0) || 0,
    stripe_charge_id: charge?.id ?? null,
    stripe_event_id: eventId,
    status_updated_at: iso(now),
  } };
}

/** charge.dispute.created / updated / closed. */
export function planDispute(existing: ExistingTip | null, dispute: any, eventType: string, eventId: string, now: Date): TipPlan {
  if (!existing) return { kind: "noop", reason: "no_row" };
  const dStatus = String(dispute?.status ?? "");
  let target: TipStatus = "disputed";
  if (eventType === "charge.dispute.closed") {
    if (dStatus === "won" || dStatus === "warning_closed") target = "succeeded";
    else if (dStatus === "lost") target = "dispute_lost";
  }
  const patch: Record<string, unknown> = {
    dispute_status: dStatus || null,
    stripe_dispute_id: dispute?.id ?? null,
    stripe_event_id: eventId,
    status_updated_at: iso(now),
  };
  if (eventType === "charge.dispute.created") patch.disputed_at = iso(now);

  if (existing.status === target) {
    // e.g. dispute.updated while already disputed: record the new dispute status only.
    return { kind: "update", from: existing.status, notify: false, patch };
  }
  if (!canTransition(existing.status, target)) return { kind: "noop", reason: `already_${existing.status}` };
  return { kind: "update", from: existing.status, notify: false, patch: { ...patch, status: target } };
}
