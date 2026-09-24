// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/admin-actions.ts
//
// Manual trust and safety controls, as a pure state change plus an audit
// entry. The admin route applies the patch, writes the audit row, and makes the
// Stripe payout schedule call when the plan asks for one.
//
// None of these delete, refund or rewrite financial records. Blocking a creator
// stops FUTURE monetization; every historical row stays exactly as it was.
// ──────────────────────────────────────────────────────────────────────────────

export const ADMIN_TRUST_ACTIONS = [
  "disable_tips",
  "enable_tips",
  "place_under_review",
  "release_from_review",
  "block_monetization",
  "unblock_monetization",
  "hold_payouts",
  "release_payouts",
] as const;
export type AdminTrustAction = (typeof ADMIN_TRUST_ACTIONS)[number];

export type TrustState = {
  tips_disabled: boolean;
  monetization_status: "active" | "under_review" | "blocked";
  payout_hold_active: boolean;
  payout_hold_reason: string | null;
  review_reason: string | null;
};

export const DEFAULT_TRUST_STATE: TrustState = {
  tips_disabled: false,
  monetization_status: "active",
  payout_hold_active: false,
  payout_hold_reason: null,
  review_reason: null,
};

export type AdminActionPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      patch: Partial<TrustState> & Record<string, unknown>;
      /** "hold" or "release" means call Stripe to change the payout schedule. */
      stripePayouts: "hold" | "release" | null;
      audit: { action: AdminTrustAction; reason: string; before: TrustState; after: TrustState };
    };

export function isAdminTrustAction(a: unknown): a is AdminTrustAction {
  return typeof a === "string" && (ADMIN_TRUST_ACTIONS as readonly string[]).includes(a);
}

export function planAdminAction(current: TrustState | null, action: AdminTrustAction, reasonRaw: string, now: Date): AdminActionPlan {
  const before: TrustState = { ...DEFAULT_TRUST_STATE, ...(current ?? {}) };
  const reason = String(reasonRaw ?? "").trim().slice(0, 1000);
  if (reason.length < 3) return { ok: false, error: "A reason is required for every trust action." };

  const after: TrustState = { ...before };
  let stripePayouts: "hold" | "release" | null = null;
  const at = now.toISOString();
  const extra: Record<string, unknown> = {};

  switch (action) {
    case "disable_tips":
      after.tips_disabled = true;
      break;
    case "enable_tips":
      after.tips_disabled = false;
      break;
    case "place_under_review":
      if (before.monetization_status === "blocked") return { ok: false, error: "Creator is blocked. Unblock first to move them to review." };
      after.monetization_status = "under_review";
      after.review_reason = reason;
      extra.review_started_at = at;
      if (!before.payout_hold_active) { after.payout_hold_active = true; after.payout_hold_reason = "review"; stripePayouts = "hold"; extra.payout_hold_set_at = at; }
      break;
    case "release_from_review":
      if (before.monetization_status !== "under_review") return { ok: false, error: "Creator is not under review." };
      after.monetization_status = "active";
      after.review_reason = null;
      extra.review_released_at = at;
      // Payouts stay held until an explicit release_payouts. Clearing a review
      // and letting money move are separate decisions.
      break;
    case "block_monetization":
      after.monetization_status = "blocked";
      after.tips_disabled = true;
      after.review_reason = reason;
      extra.blocked_at = at;
      if (!before.payout_hold_active) { after.payout_hold_active = true; after.payout_hold_reason = "blocked"; stripePayouts = "hold"; extra.payout_hold_set_at = at; }
      break;
    case "unblock_monetization":
      if (before.monetization_status !== "blocked") return { ok: false, error: "Creator is not blocked." };
      // Unblocking lands in review, never straight back to active.
      after.monetization_status = "under_review";
      after.review_reason = reason;
      break;
    case "hold_payouts":
      if (before.payout_hold_active) return { ok: false, error: "Payouts are already held." };
      after.payout_hold_active = true;
      after.payout_hold_reason = "admin";
      extra.payout_hold_set_at = at;
      stripePayouts = "hold";
      break;
    case "release_payouts":
      if (!before.payout_hold_active) return { ok: false, error: "Payouts are not held." };
      if (before.monetization_status !== "active") return { ok: false, error: "Release the review or block before releasing payouts." };
      after.payout_hold_active = false;
      after.payout_hold_reason = null;
      extra.payout_released_at = at;
      stripePayouts = "release";
      break;
  }

  return {
    ok: true,
    patch: { ...after, ...extra, updated_at: at },
    stripePayouts,
    audit: { action, reason, before, after },
  };
}
