// ──────────────────────────────────────────────────────────────────────────────
// lib/referral-credit.ts
//
// Qualification rules for the creator-referral credit, as pure functions.
//
// Why this exists: `/api/referrals/creator` was unauthenticated, ran with the
// service role, and took the credited creator's handle straight from the request
// body. Five unauthenticated POSTs minted $29 of billing credit, repeatable
// without limit. The self-referral guard was doubly broken — skipped entirely
// when `referredUserId` was absent (an optional field), and when present it
// compared the REFERRER's own user_id against it, so any other uuid passed.
//
// The route now derives the referrer from the session. These functions hold the
// remaining decisions so each one is directly testable.
// ──────────────────────────────────────────────────────────────────────────────

/** Referrals required per credit, and what a credit is worth. */
export const REFERRALS_PER_CREDIT = 5;
export const CREDIT_AMOUNT_USD = 29.0; // Starter tier price

export type ReferralRejection =
  | "unauthenticated"
  | "no_creator_profile"
  | "missing_referred_user"
  | "self_referral"
  | "duplicate_referral";

/**
 * Why a referral attempt should be refused, or null if it may proceed.
 *
 * `referrerUserId` and `referrerProfileId` come from the SESSION, never from the
 * request body. `referredUserId` identifies the account that signed up.
 */
export function referralRejection(input: {
  referrerUserId?: string | null;
  referrerProfileId?: string | null;
  referredUserId?: string | null;
  /** True when a creator_referrals row already exists for this pair. */
  alreadyRecorded?: boolean;
}): ReferralRejection | null {
  const referrerUserId = String(input.referrerUserId ?? "").trim();
  const referrerProfileId = String(input.referrerProfileId ?? "").trim();
  const referredUserId = String(input.referredUserId ?? "").trim();

  if (!referrerUserId) return "unauthenticated";
  if (!referrerProfileId) return "no_creator_profile";

  // Not optional any more. Without it there is no referral to speak of, and the
  // old code treated its absence as "skip the self-referral check".
  if (!referredUserId) return "missing_referred_user";

  if (referredUserId === referrerUserId) return "self_referral";
  if (input.alreadyRecorded === true) return "duplicate_referral";

  return null;
}

/**
 * How many whole credits an uncredited-referral count has earned, and how many
 * referral rows that consumes. Returns zeros below the threshold.
 */
export function creditsEarned(uncreditedCount: number): {
  credits: number;
  referralsConsumed: number;
  amountUsd: number;
} {
  const n = Number.isFinite(uncreditedCount) ? Math.floor(uncreditedCount) : 0;
  if (n < REFERRALS_PER_CREDIT) {
    return { credits: 0, referralsConsumed: 0, amountUsd: 0 };
  }
  const credits = Math.floor(n / REFERRALS_PER_CREDIT);
  return {
    credits,
    referralsConsumed: credits * REFERRALS_PER_CREDIT,
    amountUsd: Math.round(credits * CREDIT_AMOUNT_USD * 100) / 100,
  };
}

/** Progress toward the next credit, for the dashboard. */
export function progressToNextCredit(uncreditedCount: number): number {
  const n = Number.isFinite(uncreditedCount) ? Math.max(0, Math.floor(uncreditedCount)) : 0;
  return n % REFERRALS_PER_CREDIT;
}
