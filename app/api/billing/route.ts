import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { tierForCount, getPriceId, TIERS, type TierKey, getOrCreateStripePrices } from "@/lib/billing";

// GET — return current billing status for the logged-in creator
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: billing } = await (supabase as any)
    .from("creator_billing")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!billing) return NextResponse.json({ billing: null });

  // Get current subscriber count across all profiles
  const { data: profiles } = await (supabase as any)
    .from("creator_profiles")
    .select("id")
    .eq("user_id", user.id);

  const profileIds = (profiles ?? []).map((p: any) => p.id);
  let subscriberCount = 0;

  if (profileIds.length > 0) {
    const { count } = await (supabase as any)
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("creator_profile_id", profileIds)
      .eq("status", "active");
    subscriberCount = count ?? 0;
  }

  const correctTier = tierForCount(subscriberCount);
  const trialDaysLeft = billing.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(billing.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  return NextResponse.json({
    billing,
    subscriberCount,
    correctTier,
    tierInfo: TIERS[billing.tier as TierKey],
    correctTierInfo: TIERS[correctTier],
    trialDaysLeft,
    needsUpgrade: correctTier !== billing.tier && billing.status === "active",
  });
}

// POST — start trial subscription (called on first creator signup)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Already has billing?
  const { data: existing } = await (supabase as any)
    .from("creator_billing")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ billing: existing, alreadyExists: true });

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) {
    // No Stripe configured — create a trial record without Stripe
    const trialEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const { data: billing } = await (supabase as any)
      .from("creator_billing")
      .insert({ user_id: user.id, status: "trial", tier: "starter", trial_ends_at: trialEnd })
      .select().single();
    return NextResponse.json({ billing });
  }

  // Ensure Stripe prices exist for all tiers (creates them if missing)
  try { await getOrCreateStripePrices(STRIPE_SECRET_KEY); } catch { /* non-fatal */ }

  // Create Stripe customer
  const customerParams = new URLSearchParams({
    email: user.email ?? "",
    "metadata[user_id]": user.id,
    "metadata[platform]": "spotlightly",
  });
  const custRes = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: customerParams.toString(),
  });
  const customer = await custRes.json();

  // Get starter price ID
  const priceId = await getPriceId("starter", STRIPE_SECRET_KEY);

  // Create subscription with 30-day trial, no card required upfront
  const subParams = new URLSearchParams({
    customer: customer.id,
    "items[0][price]": priceId,
    trial_period_days: "30",
    "trial_settings[end_behavior][missing_payment_method]": "cancel",
    "metadata[user_id]": user.id,
    "metadata[tier]": "starter",
  });
  const subRes = await fetch("https://api.stripe.com/v1/subscriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: subParams.toString(),
  });
  const subscription = await subRes.json();

  const trialEnd = new Date(subscription.trial_end * 1000).toISOString();

  const { data: billing } = await (supabase as any)
    .from("creator_billing")
    .insert({
      user_id: user.id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      status: "trial",
      tier: "starter",
      trial_ends_at: trialEnd,
      current_period_end: trialEnd,
    })
    .select().single();

  return NextResponse.json({ billing });
}
