// ──────────────────────────────────────────────────────────────────
// lib/acquisition.ts
// Turns real application data into the acquisition funnel.
//
// THE RULE THIS MODULE EXISTS TO ENFORCE:
// Activation is never stored. Every milestone below is derived from a column
// the product already writes for its own reasons, so the funnel cannot drift
// from reality. `creator_prospects.stage` is authoritative only for the
// states that exist before a creator account does; from `joined` onward the
// truth lives in creator_profiles and its related tables.
//
// The signals mirror what the creator dashboard already treats as "set up"
// (app/(platform)/dashboard/page.tsx, components/OnboardingChecklist.tsx),
// so the admin funnel and the creator's own checklist can never disagree.
// ──────────────────────────────────────────────────────────────────

import type { ProspectStage } from "@/lib/prospects";

export const ACQUISITION_MILESTONES = [
  "identified",
  "contacted",
  "replied",
  "joined",
  "onboarding_completed",
  "stripe_connected",
  "activated",
] as const;
export type AcquisitionMilestone = (typeof ACQUISITION_MILESTONES)[number];

export const MILESTONE_LABELS: Record<AcquisitionMilestone, string> = {
  identified: "Identified",
  contacted: "Contacted",
  replied: "Replied",
  joined: "Joined",
  onboarding_completed: "Onboarding complete",
  stripe_connected: "Stripe connected",
  activated: "Activated",
};

export interface ActivationInput {
  /** Admin-managed pipeline stage. Only consulted for pre-account states. */
  stage?: ProspectStage | null;
  /** Earliest prospect_outreach.sent_at, if any outreach has gone out. */
  first_sent_at?: string | null;
  /** creator_profiles columns, present once a page has been built. */
  profile?: {
    claimed_at?: string | null;
    onboarding_completed_at?: string | null;
    /**
     * NOT stripe_account_id. That is set the moment a Connect account is
     * created, before the creator has submitted anything — using it would
     * report people as payment-ready when they cannot receive a penny.
     */
    stripe_onboarded?: boolean | null;
    avatar_url?: string | null;
    bio?: string | null;
  } | null;
  /** Counted from posts where status = 'live'. */
  live_post_count?: number | null;
  /** Counted from subscription_tiers where is_active. */
  active_tier_count?: number | null;
  /** Earliest created_at across the six revenue tables, if any. */
  first_transaction_at?: string | null;
}

export interface Activation {
  reached: Record<AcquisitionMilestone, boolean>;
  /** The furthest milestone reached. Always at least "identified". */
  furthest: AcquisitionMilestone;
  /** 0-100, how far along the funnel this prospect is. */
  percent: number;
  profile_complete: boolean;
  has_first_transaction: boolean;
}

/**
 * Activated means the creator can actually earn: payments enabled, something
 * for a fan to buy, and something published to attract them. It deliberately
 * does NOT require a first sale — that measures demand, not whether we
 * successfully onboarded them. `has_first_transaction` is reported separately.
 */
export function activationFor(input: ActivationInput): Activation {
  const p = input.profile ?? null;
  const stage = input.stage ?? null;

  const joined = !!p?.claimed_at;
  const onboarding_completed = !!p?.onboarding_completed_at;
  const stripe_connected = p?.stripe_onboarded === true;
  const posts = input.live_post_count ?? 0;
  const tiers = input.active_tier_count ?? 0;

  const profile_complete = !!p?.avatar_url && !!p?.bio;
  const activated = stripe_connected && posts > 0 && tiers > 0;

  // Later milestones imply earlier ones. Somebody who joined was obviously
  // contacted, even if the outreach predates this system and has no row.
  const contacted = !!input.first_sent_at || stage === "contacted" || stage === "replied" || joined;
  const replied = stage === "replied" || joined;

  const reached: Record<AcquisitionMilestone, boolean> = {
    identified: true,
    contacted,
    replied,
    joined,
    onboarding_completed,
    stripe_connected,
    activated,
  };

  let furthest: AcquisitionMilestone = "identified";
  for (const m of ACQUISITION_MILESTONES) {
    if (reached[m]) furthest = m;
  }

  const done = ACQUISITION_MILESTONES.filter((m) => reached[m]).length;
  const percent = Math.round((done / ACQUISITION_MILESTONES.length) * 100);

  return {
    reached,
    furthest,
    percent,
    profile_complete,
    has_first_transaction: !!input.first_transaction_at,
  };
}

export interface FunnelRow {
  milestone: AcquisitionMilestone;
  label: string;
  count: number;
  /** Percentage of all prospects that reached this milestone. */
  percent_of_total: number;
  /** Percentage of the previous milestone that converted to this one. */
  conversion_from_previous: number | null;
}

/**
 * Aggregate a set of activations into the funnel.
 *
 * Counts are cumulative — somebody who activated is counted at every earlier
 * milestone too, which is what makes step-to-step conversion meaningful.
 * Disqualified prospects are excluded by the caller, not here.
 */
export function buildFunnel(activations: Activation[]): FunnelRow[] {
  const total = activations.length;
  let previous: number | null = null;

  return ACQUISITION_MILESTONES.map((milestone) => {
    const count = activations.filter((a) => a.reached[milestone]).length;
    const row: FunnelRow = {
      milestone,
      label: MILESTONE_LABELS[milestone],
      count,
      percent_of_total: total === 0 ? 0 : Math.round((count / total) * 100),
      conversion_from_previous:
        previous === null ? null : previous === 0 ? 0 : Math.round((count / previous) * 100),
    };
    previous = count;
    return row;
  });
}
