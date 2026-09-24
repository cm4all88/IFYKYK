// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/risk-flags.ts
//
// Internal review signals, computed from facts. Pure.
//
// A flag is a reason to LOOK, not a verdict. Nothing here bans anyone. Flags
// feed the admin trust view, and a few "hold" flags keep an automatic payout
// release from firing until a person has looked. Location is never a flag on
// its own: being overseas or on a VPN is normal. Location only shows up inside
// multiple_accounts_same_network, which needs several creator accounts from one
// network in a short window.
// ──────────────────────────────────────────────────────────────────────────────

import type { TrustConfig } from "@/lib/trust/config";
import { classifyStripeAccount } from "@/lib/trust/stripe-status";

export type RiskFlag =
  | "zero_content_creator"
  | "new_creator"
  | "high_tip_velocity"
  | "high_guest_tip_velocity"
  | "many_checkout_sessions"
  | "stripe_restricted"
  | "stripe_rejected"
  | "stripe_high_risk"
  | "multiple_accounts_same_network"
  | "chargeback_or_dispute"
  | "early_fraud_warning"
  | "tips_while_empty"
  | "admin_review";

export type RiskStats = {
  createdAt: string | null;
  riskPeriodEndsAt: string | null;
  publishedPostCount: number;
  succeededTips: number;
  /** Most successful tips in any rolling 10 minutes and 1 hour (or the recent window if that is all we have). */
  maxSucceeded10m: number;
  maxSucceeded1h: number;
  guestSucceededTips: number;
  maxGuestSucceeded1h: number;
  uncompletedSessions24h: number;
  succeededTips24h: number;
  stripeChargesEnabled: boolean | null;
  stripeDetailsSubmitted: boolean | null;
  stripeDisabledReason: string | null;
  stripeHighRiskCount: number;
  sameNetworkCreatorCount: number;
  disputeCount: number;
  earlyFraudWarningCount: number;
  succeededTipsWhileZeroPosts: number;
  monetizationStatus: string | null;
};

/** Flags that stop an automatic payout release until an admin has reviewed. */
export const HOLD_FLAGS: readonly RiskFlag[] = [
  "high_tip_velocity",
  "high_guest_tip_velocity",
  "many_checkout_sessions",
  "stripe_restricted",
  "stripe_rejected",
  "stripe_high_risk",
  "multiple_accounts_same_network",
  "chargeback_or_dispute",
  "early_fraud_warning",
  "tips_while_empty",
  "admin_review",
];

export function computeRiskFlags(s: RiskStats, config: TrustConfig, now: Date): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const v = config.velocity;

  if (s.publishedPostCount === 0) flags.push("zero_content_creator");
  if (s.riskPeriodEndsAt && now < new Date(s.riskPeriodEndsAt)) flags.push("new_creator");

  if (s.maxSucceeded10m >= v.creatorSucceeded10m || s.maxSucceeded1h >= v.creatorSucceeded1h) flags.push("high_tip_velocity");
  if (s.maxGuestSucceeded1h >= v.guestIpAttempts1h) flags.push("high_guest_tip_velocity");
  if (s.uncompletedSessions24h >= v.creatorUncompletedSessions1h && s.uncompletedSessions24h > s.succeededTips24h * 2) {
    flags.push("many_checkout_sessions");
  }

  if (s.stripeChargesEnabled !== null || s.stripeDisabledReason) {
    const cls = classifyStripeAccount({
      stripe_charges_enabled: s.stripeChargesEnabled === true,
      stripe_details_submitted: s.stripeDetailsSubmitted === true,
      stripe_disabled_reason: s.stripeDisabledReason,
    });
    if (cls === "rejected") flags.push("stripe_rejected");
    else if (cls === "restricted") flags.push("stripe_restricted");
  }
  if (s.stripeHighRiskCount > 0) flags.push("stripe_high_risk");
  if (s.sameNetworkCreatorCount >= config.sameNetworkCreatorThreshold) flags.push("multiple_accounts_same_network");
  if (s.disputeCount > 0) flags.push("chargeback_or_dispute");
  if (s.earlyFraudWarningCount > 0) flags.push("early_fraud_warning");
  if (s.succeededTipsWhileZeroPosts > 0) flags.push("tips_while_empty");
  if (s.monetizationStatus === "under_review" || s.monetizationStatus === "blocked") flags.push("admin_review");

  return flags;
}

export function hasHoldFlag(flags: readonly RiskFlag[]): boolean {
  return flags.some((f) => HOLD_FLAGS.includes(f));
}

/** Largest number of timestamps inside any window of `windowMs`. Pure helper for the admin view. */
export function maxInWindow(timestamps: readonly (string | null | undefined)[], windowMs: number): number {
  const ts = timestamps
    .map((t) => (t ? new Date(t).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  let best = 0;
  let lo = 0;
  for (let hi = 0; hi < ts.length; hi++) {
    while (ts[hi] - ts[lo] > windowMs) lo++;
    best = Math.max(best, hi - lo + 1);
  }
  return best;
}
