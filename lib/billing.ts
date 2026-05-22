// ──────────────────────────────────────────────────────────────────
// lib/billing.ts
// Creator platform billing — tier definitions, Stripe price helpers
// ──────────────────────────────────────────────────────────────────

export const TIERS = {
  starter: { name: "Starter",  maxSubs: 100,   priceUsd: 29,    label: "Up to 100 subscribers" },
  growth:  { name: "Growth",   maxSubs: 500,   priceUsd: 79,    label: "Up to 500 subscribers" },
  pro:     { name: "Pro",      maxSubs: 2500,  priceUsd: 249,   label: "Up to 2,500 subscribers" },
  scale:   { name: "Scale",    maxSubs: 10000, priceUsd: 749,   label: "Up to 10,000 subscribers" },
  legend:  { name: "Legend",   maxSubs: Infinity, priceUsd: 3499, label: "Unlimited subscribers" },
} as const;

export type TierKey = keyof typeof TIERS;

export function tierForCount(count: number): TierKey {
  if (count <= 100)   return "starter";
  if (count <= 500)   return "growth";
  if (count <= 2500)  return "pro";
  if (count <= 10000) return "scale";
  return "legend";
}

export function nextTier(tier: TierKey): TierKey | null {
  const order: TierKey[] = ["starter", "growth", "pro", "scale", "legend"];
  const idx = order.indexOf(tier);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

// Get or create Stripe Price IDs for each tier.
// Called once at startup — caches IDs in env or creates them in Stripe.
// Prices are stored as env vars: STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, etc.
export async function getOrCreateStripePrices(secretKey: string): Promise<Record<TierKey, string>> {
  const envKeys: Record<TierKey, string> = {
    starter: process.env.STRIPE_PRICE_STARTER ?? "",
    growth:  process.env.STRIPE_PRICE_GROWTH  ?? "",
    pro:     process.env.STRIPE_PRICE_PRO     ?? "",
    scale:   process.env.STRIPE_PRICE_SCALE   ?? "",
    legend:  process.env.STRIPE_PRICE_LEGEND  ?? "",
  };

  // If all price IDs are set, return them
  if (Object.values(envKeys).every(v => v.startsWith("price_"))) {
    return envKeys;
  }

  // Otherwise create any missing prices in Stripe
  const result = { ...envKeys };
  for (const [key, tier] of Object.entries(TIERS) as [TierKey, typeof TIERS[TierKey]][]) {
    if (result[key].startsWith("price_")) continue;

    // Create product + price
    const prodRes = await fetch("https://api.stripe.com/v1/products", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        name: `Spotlightly ${tier.name}`,
        description: tier.label,
        "metadata[tier]": key,
      }).toString(),
    });
    const product = await prodRes.json();

    const priceRes = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        product: product.id,
        currency: "usd",
        unit_amount: String(tier.priceUsd * 100),
        "recurring[interval]": "month",
        "metadata[tier]": key,
      }).toString(),
    });
    const price = await priceRes.json();
    result[key] = price.id;
  }

  return result;
}

// Get the Stripe Price ID for a given tier
export async function getPriceId(tier: TierKey, secretKey: string): Promise<string> {
  const prices = await getOrCreateStripePrices(secretKey);
  return prices[tier];
}
