// Single source of truth for how Stripe's fee is handled across every money flow.
// Change it here and every payment route follows. Stripe standard US card pricing.

export const STRIPE_PCT = 0.029;
export const STRIPE_FIXED_CENTS = 30;

/**
 * Gross up an amount (in cents) so that after Stripe's fee the recipient nets
 * exactly the original amount. Used on creator-first flows (subs, tips, lives,
 * gift subs, social add-backs, campaigns) where the fan covers the card fee and
 * the creator keeps 100%.
 */
export function grossUpForStripe(netCents: number): number {
  return Math.ceil((netCents + STRIPE_FIXED_CENTS) / (1 - STRIPE_PCT));
}

/**
 * For a destination-charge subscription: the application_fee_percent that leaves
 * the creator their full net each invoice while the platform keeps exactly enough
 * to cover Stripe (nets ~$0).
 */
export function appFeePercentForGrossUp(netCents: number): number {
  const gross = grossUpForStripe(netCents);
  return ((gross - netCents) / gross) * 100;
}

/**
 * Minimum charge (in cents) for a percentage-cut stream so the platform's cut
 * always covers Stripe — i.e. we never lose money. Rounded up to a whole dollar.
 *   cut*p >= STRIPE_PCT*p + STRIPE_FIXED  ->  p >= STRIPE_FIXED / (cut - STRIPE_PCT)
 */
export function minChargeCents(cutPct: number): number {
  if (cutPct <= STRIPE_PCT) return Infinity; // a cut at/below Stripe's rate can never cover it
  const breakeven = STRIPE_FIXED_CENTS / (cutPct - STRIPE_PCT);
  return Math.ceil(breakeven / 100) * 100;
}

// Spotlightly takes 0% of creator earnings. Subs, tips, campaigns, marketplace,
// merch, digital products, and donations all net the creator 100% (fans cover
// Stripe via grossUpForStripe). The only tip-related platform revenue is the
// Super Tip recognition fee below, which the fan pays ON TOP of the tip and is
// never deducted from the creator's tip.

// Super Tip recognition fee: a fan-paid premium for the badge / pin / highlight,
// charged on top of the tip and kept by the platform. Tunable.
export const SUPER_TIP_RECOGNITION_PCT = 0.15;
export function superTipRecognitionCents(tipCents: number): number {
  return Math.round(tipCents * SUPER_TIP_RECOGNITION_PCT);
}

// UX price floors. No longer tied to any platform cut (there is none); kept only
// so micro-sales aren't dominated by Stripe's fixed $0.30 fee. Safe to lower.
export const MARKETPLACE_MIN_CENTS = 1500; // $15
export const SUPER_TIP_MIN_CENTS = 300;    // $3

export function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

// ── Live streaming usage ──────────────────────────────────────────────
// First hour of every stream is free; after that $0.01 per viewer per hour,
// billed in 15-minute increments and charged to the creator (infra cost).
export const LIVE_FREE_SECONDS = 3600;
export const LIVE_RATE_PER_VIEWER_HOUR_CENTS = 1; // $0.01
export function liveIncrementCents(viewers: number): number {
  return Math.round(viewers * LIVE_RATE_PER_VIEWER_HOUR_CENTS * 0.25); // one 15-min slice
}
