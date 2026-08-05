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

// ─────────────────────────────────────────────────────────────────────────
// Opening Act → Starter conversion threshold (Phase 1, item 2)
// ─────────────────────────────────────────────────────────────────────────

/**
 * A free (Opening Act) creator is "due for Starter" once they reach this many
 * active paying subscribers — the moment Spotlightly is clearly working for
 * them. Crossing it opens a RESPECTFUL conversion grace state: we ask them to
 * move to Starter, but never lock their page, hide Subscribe, cancel fan subs,
 * or interrupt supporters. They stay live indefinitely either way.
 *
 * ── Product knob ──
 * Default 25 = roughly $125/mo at the $4.99 subscription floor, the point where
 * Starter's $29 flat fee is clearly worth it (and well past it versus a 20% cut,
 * which costs more than $29 once a creator earns about $145/mo). The first
 * prompt should feel earned and fair, not like we are chasing the first dollar.
 * This is the single place that decision lives.
 */
export const STARTER_CONVERSION_MIN_SUBS = 25;

/**
 * Is a free creator past the Starter threshold (and therefore in the conversion
 * grace state)? Only ever true for status === "free": a creator who already
 * pays (trial/active) is on a real plan, and a locked status is handled
 * elsewhere. This never gates features and never locks anything.
 */
export function isStarterDue(status: string | null | undefined, subscriberCount: number): boolean {
  return status === "free" && subscriberCount >= STARTER_CONVERSION_MIN_SUBS;
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

// ─────────────────────────────────────────────────────────────────────────
// Lock + fairness helpers (card-required billing)
// ─────────────────────────────────────────────────────────────────────────

export type BillingLockRow = {
  status?: string | null;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
  conversion_due_at?: string | null;
} | null | undefined;

/**
 * Is a creator locked out for non-payment?
 *  - conversion grace (Starter-due)→ unlocked (never punish a creator the
 *                                     moment Spotlightly starts working)
 *  - active                       → unlocked
 *  - trial (expired or not)       → unlocked (see below)
 *  - past_due within grace window → unlocked (grace)
 *  - past_due, grace expired      → locked
 *  - free (Opening Act)           → unlocked (no card, never billed)
 *  - cancelled / incomplete / no row → locked
 *
 * Trial expiry no longer locks. A trial running out is a clock we started, not a
 * payment that failed, and locking on it dark-pages creators who have not yet
 * earned a dollar (the exact moment they most need their page live). The daily
 * billing cron resolves expired trials instead: under the Starter threshold they
 * move to the free plan and stay live, at or above it they move to past_due with
 * the normal 7 day grace. Lock is reserved for a card that actually failed.
 */
export function isBillingLocked(b: BillingLockRow): boolean {
  if (!b || !b.status) return true;
  if (b.conversion_due_at) return false;   // Starter-due grace — always live
  if (b.status === "free") return false;   // Opening Act — free plan, always unlocked
  const now = Date.now();
  if (b.status === "active") return false;
  if (b.status === "trial") return false;
  if (b.status === "past_due") {
    if (b.grace_ends_at && new Date(b.grace_ends_at).getTime() > now) return false; // in grace
    return true; // grace expired
  }
  return true; // cancelled, incomplete, anything else
}

/** Lock state for the owner of a given creator profile. */
export async function isCreatorProfileLocked(supabase: any, creatorProfileId: string): Promise<boolean> {
  const { data: prof } = await supabase
    .from("creator_profiles").select("user_id").eq("id", creatorProfileId).maybeSingle();
  if (!prof?.user_id) return false; // unknown owner — don't block
  const { data: billing } = await supabase
    .from("creator_billing").select("status, trial_ends_at, grace_ends_at, conversion_due_at").eq("user_id", prof.user_id).maybeSingle();
  return isBillingLocked(billing);
}

/**
 * Fair-to-fans: when a creator is locked, stop FUTURE charges on their fans'
 * subscriptions (cancel at period end) so nobody pays for a dark creator —
 * but fans keep the period they already paid for and anything they already bought.
 */
export async function pauseFanSubscriptionsForCreator(supabase: any, stripeSecretKey: string, userId: string) {
  const { data: profiles } = await supabase.from("creator_profiles").select("id").eq("user_id", userId);
  const ids = (profiles ?? []).map((p: any) => p.id);
  if (ids.length === 0) return;
  const { data: subs } = await supabase
    .from("subscriptions").select("id, stripe_subscription_id").in("creator_profile_id", ids).eq("status", "active");
  for (const s of subs ?? []) {
    if (s.stripe_subscription_id) {
      await fetch(`https://api.stripe.com/v1/subscriptions/${s.stripe_subscription_id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ cancel_at_period_end: "true" }).toString(),
      }).catch(() => {});
    }
    await supabase.from("subscriptions").update({ status: "cancelling" }).eq("id", s.id);
  }
}

/** Reverse of the above — when a creator reactivates, let fan subs renew again. */
export async function resumeFanSubscriptionsForCreator(supabase: any, stripeSecretKey: string, userId: string) {
  const { data: profiles } = await supabase.from("creator_profiles").select("id").eq("user_id", userId);
  const ids = (profiles ?? []).map((p: any) => p.id);
  if (ids.length === 0) return;
  const { data: subs } = await supabase
    .from("subscriptions").select("id, stripe_subscription_id").in("creator_profile_id", ids).eq("status", "cancelling");
  for (const s of subs ?? []) {
    if (s.stripe_subscription_id) {
      await fetch(`https://api.stripe.com/v1/subscriptions/${s.stripe_subscription_id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ cancel_at_period_end: "false" }).toString(),
      }).catch(() => {});
    }
    await supabase.from("subscriptions").update({ status: "active" }).eq("id", s.id);
  }
}
