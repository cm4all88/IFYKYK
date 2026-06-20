// ──────────────────────────────────────────────────────────────────
// lib/entitlements.ts
// Single source of truth for what each plan can access.
//
// Entitlements are DERIVED from a creator's billing row (status + tier);
// this module has no database of its own. The MATRIX below is the only
// place capabilities are defined. Gate features by calling
// entitlementsFor(billing) — never by scattering `tier === "..."` checks
// across the app.
//
// Note on lock state: "is this account locked for non-payment" is a
// separate concern handled by isBillingLocked in lib/billing.ts. A caller
// that gates a paid feature should check BOTH: the account is not locked
// AND the plan is entitled.
// ──────────────────────────────────────────────────────────────────

// The plan a creator is actually on. A free (Opening Act) creator carries
// tier="starter" as a placeholder default in the DB, so the plan must be
// derived from status first, not from the tier column.
export type Plan = "opening_act" | "starter" | "growth" | "pro" | "scale" | "legend";

export const PLAN_LABEL: Record<Plan, string> = {
  opening_act: "Opening Act",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  scale: "Scale",
  legend: "Legend",
};

export type BillingPlanRow = {
  status?: string | null;
  tier?: string | null;
} | null | undefined;

/**
 * Resolve the effective plan from a billing row.
 *  - status "free"     → Opening Act (ignores the placeholder tier column)
 *  - any paid status   → the tier they pay for
 *  - missing / unknown → Opening Act (safest, most restrictive default)
 *
 * The Opening Act → Starter conversion grace state (spec item 2) is a free
 * creator who has crossed the Starter threshold but has not added a card yet.
 * They keep Opening Act entitlements here on purpose: Starter features unlock
 * only when they actually subscribe. The grace state changes lock state and
 * messaging, never gating. Once they commit (card added → status trial/active,
 * tier starter), they resolve to "starter" via the tier column below, with no
 * dead gap.
 */
export function planForBilling(b: BillingPlanRow): Plan {
  if (!b || !b.status) return "opening_act";
  if (b.status === "free") return "opening_act";
  switch (b.tier) {
    case "growth": return "growth";
    case "pro":    return "pro";
    case "scale":  return "scale";
    case "legend": return "legend";
    case "starter":
    default:       return "starter";
  }
}

export type AnalyticsDays = 7 | 30 | 90;

export interface Entitlements {
  plan: Plan;
  // ── Phase 1 (the Starter leverage we gate first) ──
  schedulePosts: boolean;     // post scheduling UI
  firstMonthOffer: boolean;   // first-month subscriber discount
  analyticsMaxDays: AnalyticsDays;
  advisorAdvanced: boolean;   // full AI advisor (pricing, cadence, warm-moment)
  // ── Later phases (defined now so gating never has to scatter later) ──
  automation: boolean;        // automation suite (welcome flows, auto-responders, repurposing)
  broadcast: boolean;         // broadcast to the supporter list
  advancedCRM: boolean;       // segmentation + lifecycle journeys
  teamSeats: number;          // collaborator seats (0 = none)
}

type Caps = Omit<Entitlements, "plan">;

// The matrix. Higher plans conceptually include everything below them, but each
// cell is written out explicitly so the whole grid is reviewable at a glance and
// there is no inheritance magic to reason about.
const MATRIX: Record<Plan, Caps> = {
  opening_act: {
    schedulePosts: false,
    firstMonthOffer: false,
    analyticsMaxDays: 7,
    advisorAdvanced: false,
    automation: false,
    broadcast: false,
    advancedCRM: false,
    teamSeats: 0,
  },
  starter: {
    schedulePosts: true,
    firstMonthOffer: true,
    analyticsMaxDays: 30,
    advisorAdvanced: true,
    automation: false,
    broadcast: false,
    advancedCRM: false,
    teamSeats: 0,
  },
  growth: {
    schedulePosts: true,
    firstMonthOffer: true,
    analyticsMaxDays: 90,
    advisorAdvanced: true,
    automation: true,
    broadcast: true,
    advancedCRM: false,
    teamSeats: 0,
  },
  pro: {
    schedulePosts: true,
    firstMonthOffer: true,
    analyticsMaxDays: 90,
    advisorAdvanced: true,
    automation: true,
    broadcast: true,
    advancedCRM: true,
    teamSeats: 1,
  },
  scale: {
    schedulePosts: true,
    firstMonthOffer: true,
    analyticsMaxDays: 90,
    advisorAdvanced: true,
    automation: true,
    broadcast: true,
    advancedCRM: true,
    teamSeats: 5,
  },
  legend: {
    schedulePosts: true,
    firstMonthOffer: true,
    analyticsMaxDays: 90,
    advisorAdvanced: true,
    automation: true,
    broadcast: true,
    advancedCRM: true,
    teamSeats: Number.POSITIVE_INFINITY,
  },
};

/** Entitlements for a billing row. The one function the app should call. */
export function entitlementsFor(b: BillingPlanRow): Entitlements {
  const plan = planForBilling(b);
  return { plan, ...MATRIX[plan] };
}

export type BooleanCapability =
  | "schedulePosts"
  | "firstMonthOffer"
  | "advisorAdvanced"
  | "automation"
  | "broadcast"
  | "advancedCRM";

/** Convenience: does this billing row grant a given boolean capability? */
export function can(b: BillingPlanRow, capability: BooleanCapability): boolean {
  return entitlementsFor(b)[capability] === true;
}
