// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/stripe-status.ts
//
// Turns a Stripe Connect account object into the small, cached status record
// Spotlightly keeps in creator_trust, and classifies it. Pure; no network.
//
// Connected accounts here are Express accounts receiving DESTINATION charges
// (payment_intent_data.transfer_data.destination). That matters: the platform
// is the merchant of record, so refunds, disputes and negative balances land on
// Spotlightly first. Stripe's own restrictions are therefore a floor, not a
// ceiling. We never try to route around them.
// ──────────────────────────────────────────────────────────────────────────────

export type StripeAccountStatus = {
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
  stripe_disabled_reason: string | null;
  stripe_requirements_currently_due: string[];
  stripe_requirements_past_due: string[];
  stripe_payout_interval: string | null;
};

export type StripeAccountClass =
  | "ok"                // can take charges; payouts may or may not be enabled
  | "rejected"          // Stripe rejected the account (fraud, terms, listed, other)
  | "restricted"        // Stripe disabled charges pending requirements or review
  | "charges_disabled"  // charges off without a stated reason
  | "incomplete";       // onboarding not submitted

export function normalizeStripeAccount(acct: any): StripeAccountStatus {
  const req = acct?.requirements ?? {};
  const arr = (x: unknown) => (Array.isArray(x) ? x.map(String) : []);
  return {
    stripe_charges_enabled: acct?.charges_enabled === true,
    stripe_payouts_enabled: acct?.payouts_enabled === true,
    stripe_details_submitted: acct?.details_submitted === true,
    stripe_disabled_reason: req.disabled_reason ? String(req.disabled_reason) : null,
    stripe_requirements_currently_due: arr(req.currently_due),
    stripe_requirements_past_due: arr(req.past_due),
    stripe_payout_interval: acct?.settings?.payouts?.schedule?.interval
      ? String(acct.settings.payouts.schedule.interval)
      : null,
  };
}

/**
 * Classify cached status. Rejected wins over everything, because Stripe has
 * said this account must not be paid. Any disabled_reason at all is treated as
 * a restriction: charges on a restricted destination either fail after the fan
 * has committed or succeed into an account that cannot be paid out.
 */
export function classifyStripeAccount(s: Pick<StripeAccountStatus,
  "stripe_charges_enabled" | "stripe_details_submitted" | "stripe_disabled_reason">): StripeAccountClass {
  const reason = s.stripe_disabled_reason ?? "";
  if (reason.startsWith("rejected")) return "rejected";
  if (reason.length > 0) return "restricted";
  if (!s.stripe_details_submitted) return "incomplete";
  if (!s.stripe_charges_enabled) return "charges_disabled";
  return "ok";
}

/** Payouts can be guaranteed held only when Stripe reports the schedule as manual. */
export function payoutsAreHeld(s: { stripe_payout_interval?: string | null } | null | undefined): boolean {
  return s?.stripe_payout_interval === "manual";
}
