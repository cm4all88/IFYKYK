// ──────────────────────────────────────────────────────────────────
// lib/offers.ts
// First-month offer: a creator-set discount on a fan's FIRST invoice only.
//
// Implemented as a Stripe one-time percent coupon (duration: "once"). The
// creator keeps 100% of the discounted price; Spotlightly takes 0%. The fan
// simply pays less the first period, then full price after.
//
// Entitlement (Starter+) is enforced at the point of effect in the subscribe
// routes, which call this only when the creator is currently entitled.
// ──────────────────────────────────────────────────────────────────

// Options surfaced in the dashboard. The DB accepts any 1–100, but the UI
// keeps it simple for Phase 1.
export const FIRST_MONTH_OFFER_OPTIONS = [10, 25, 50] as const;

export function isValidOfferPct(pct: unknown): pct is number {
  return typeof pct === "number" && Number.isInteger(pct) && pct >= 1 && pct <= 100;
}

export function firstMonthOfferLabel(pct: number): string {
  return `First month ${pct}% off`;
}

/**
 * Create (or reuse) a one-time percent coupon and return its id.
 *
 *  - Pass `stripeAccount` for direct charges on a creator's connected account
 *    (the tier subscribe path); omit it for platform-account destination
 *    charges (the main subscribe path).
 *  - Returns null on any failure, so callers fail open to full price rather
 *    than blocking the subscription.
 */
export async function ensureFirstMonthCoupon(
  secretKey: string,
  pct: number,
  stripeAccount?: string,
): Promise<string | null> {
  if (!isValidOfferPct(pct)) return null;

  const id = `sl_first_month_${pct}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (stripeAccount) headers["Stripe-Account"] = stripeAccount;

  const res = await fetch("https://api.stripe.com/v1/coupons", {
    method: "POST",
    headers,
    body: new URLSearchParams({
      id,
      percent_off: String(pct),
      duration: "once",
      name: firstMonthOfferLabel(pct),
    }).toString(),
  }).catch(() => null);

  if (res && res.ok) return id;

  // A coupon with this id already exists → reuse it. Any other failure → no
  // discount (fall back to full price).
  if (res) {
    const body = await res.text().catch(() => "");
    if (body.includes("already exists") || body.includes("resource_already_exists")) {
      return id;
    }
  }
  return null;
}
