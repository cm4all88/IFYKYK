// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/payouts.ts
//
// Payout holds for Express accounts on destination charges.
//
// HOW THE HOLD WORKS
//   With destination charges the tip lands in the creator's Connect balance the
//   moment the charge succeeds. What Spotlightly controls is WHEN that balance
//   is paid out to the creator's bank. For Express accounts the platform sets
//   settings.payouts.schedule:
//     interval "manual"  Stripe never pays out on its own. Funds sit in the
//                        connected balance, where refunds and transfer
//                        reversals can still reach them.
//     interval "daily"   Stripe's normal automatic schedule (the Express default).
//   A hold is therefore: switch to manual. A release is: switch back to daily.
//   Nothing is moved, refunded or reversed by either call.
//
// What a hold does NOT do: stop the creator seeing the balance in their Stripe
// Express dashboard, or stop Stripe's own risk actions. It only stops money
// leaving to a bank account before we have looked.
// ──────────────────────────────────────────────────────────────────────────────

import type { TrustConfig } from "@/lib/trust/config";
import { hasHoldFlag, type RiskFlag } from "@/lib/trust/risk-flags";

/** Reasons a hold may be released automatically. Anything else needs an admin. */
export const AUTO_RELEASABLE_HOLD_REASONS = ["new_account"] as const;

export function payoutScheduleParams(held: boolean) {
  return held
    ? { settings: { payouts: { schedule: { interval: "manual" as const } } } }
    : { settings: { payouts: { schedule: { interval: "daily" as const, delay_days: "minimum" as const } } } };
}

export type ReleaseDecision = { release: boolean; reason: string };

/** Pure: may the payout release cron lift this hold? */
export function canAutoReleasePayoutHold(args: {
  payoutHoldActive: boolean;
  payoutHoldReason: string | null;
  monetizationStatus: string;
  riskPeriodStart: Date | null;
  publishedPostCount: number;
  flags: readonly RiskFlag[];
  now: Date;
}, config: TrustConfig): ReleaseDecision {
  if (!args.payoutHoldActive) return { release: false, reason: "not_held" };
  if (!(AUTO_RELEASABLE_HOLD_REASONS as readonly string[]).includes(args.payoutHoldReason ?? "")) {
    return { release: false, reason: "manual_release_required" };
  }
  if (args.monetizationStatus !== "active") return { release: false, reason: "not_active" };
  if (!args.riskPeriodStart) return { release: false, reason: "no_start_date" };
  const releaseAt = args.riskPeriodStart.getTime() + config.payoutHoldDays * 86_400_000;
  if (args.now.getTime() < releaseAt) return { release: false, reason: "hold_period_running" };
  if (args.publishedPostCount < config.minPublishedPostsForTips) return { release: false, reason: "no_published_posts" };
  if (hasHoldFlag(args.flags)) return { release: false, reason: "review_flags_present" };
  return { release: true, reason: "hold_period_complete" };
}

/** Apply a payout schedule change on Stripe. Returns an error string instead of throwing. */
export async function setStripePayoutHold(stripe: any, accountId: string, held: boolean): Promise<{ ok: true; interval: string | null } | { ok: false; error: string }> {
  try {
    const acct = await stripe.accounts.update(accountId, payoutScheduleParams(held));
    return { ok: true, interval: acct?.settings?.payouts?.schedule?.interval ?? null };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? "stripe error").slice(0, 300) };
  }
}
