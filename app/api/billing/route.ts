import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { tierForCount, getPriceId, getOrCreateStripePrices, TIERS, type TierKey, isBillingLocked, isStarterDue } from "@/lib/billing";
import { writeOrLog } from "@/lib/db";

// GET — current billing status for the logged-in creator
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: billing } = await (supabase as any)
    .from("creator_billing").select("*").eq("user_id", user.id).maybeSingle();

  if (!billing) return NextResponse.json({ billing: null, locked: true });

  // Current subscriber count across all of this creator's profiles
  const { data: profiles } = await (supabase as any)
    .from("creator_profiles").select("id").eq("user_id", user.id);
  const profileIds = (profiles ?? []).map((p: any) => p.id);
  let subscriberCount = 0;
  if (profileIds.length > 0) {
    const { count } = await (supabase as any)
      .from("subscriptions").select("id", { count: "exact", head: true })
      .in("creator_profile_id", profileIds).eq("status", "active");
    subscriberCount = count ?? 0;
  }

  const correctTier = tierForCount(subscriberCount);
  const days = (iso: string | null) => iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)) : null;

  // ── Opening Act → Starter conversion grace (item 2) ──
  // A free creator who has crossed the Starter threshold is "Starter-due".
  // We mark the moment (conversion_due_at) so the dashboard can prompt them
  // respectfully. This NEVER locks the page, hides Subscribe, or touches a
  // single fan subscription — the creator stays 'free' and fully live.
  const starterDue = isStarterDue(billing.status, subscriberCount);
  let conversionDueAt: string | null = billing.conversion_due_at ?? null;
  try {
    if (starterDue && !conversionDueAt) {
      // First time across the line — stamp it.
      conversionDueAt = new Date().toISOString();
      await writeOrLog("billing update creator_billing", (supabase as any).from("creator_billing")
        .update({ conversion_due_at: conversionDueAt }).eq("user_id", user.id));
    } else if (!starterDue && conversionDueAt) {
      // Dropped back below the threshold, or converted to a paid plan — ease off.
      conversionDueAt = null;
      await writeOrLog("billing update creator_billing", (supabase as any).from("creator_billing")
        .update({ conversion_due_at: null }).eq("user_id", user.id));
    }
  } catch { /* marker is best-effort; the computed flag below still drives the UI */ }

  return NextResponse.json({
    billing,
    subscriberCount,
    correctTier,
    tierInfo: TIERS[billing.tier as TierKey],
    correctTierInfo: TIERS[correctTier],
    trialDaysLeft: days(billing.trial_ends_at),
    graceDaysLeft: billing.status === "past_due" ? days(billing.grace_ends_at) : null,
    locked: isBillingLocked(billing),
    needsUpgrade: correctTier !== billing.tier && billing.status === "active",
    conversionDue: starterDue,
    conversionDueAt,
  });
}

// POST — start (or reactivate) the platform subscription.
// Card required: redirects to Stripe Checkout (30-day trial, auto-bills after).
// Body { session_id } confirms a returned Checkout session into a billing row.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);

  // ── Confirm path: turn a completed Checkout session into a billing row ──
  if (body?.session_id && STRIPE_SECRET_KEY) {
    const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${body.session_id}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const session = await sRes.json();
    if (session?.subscription && session?.customer) {
      const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      });
      const sub = await subRes.json();
      const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();
      const status = sub.status === "trialing" ? "trial" : sub.status === "active" ? "active" : "trial";
      await writeOrLog("billing upsert creator_billing", (supabase as any).from("creator_billing").upsert({
        user_id: user.id,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        status,
        tier: "starter",
        trial_ends_at: trialEnd,
        current_period_end: trialEnd,
        grace_ends_at: null,
        conversion_due_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" }));
    }
    const { data: billing } = await (supabase as any).from("creator_billing").select("*").eq("user_id", user.id).maybeSingle();
    return NextResponse.json({ billing });
  }

  // Already set up and in good standing? Nothing to do.
  const { data: existing } = await (supabase as any)
    .from("creator_billing").select("id, status").eq("user_id", user.id).maybeSingle();
  if (existing && existing.status !== "cancelled" && existing.status !== "incomplete") {
    return NextResponse.json({ billing: existing, alreadyExists: true });
  }

  // No Stripe configured (local/dev) — create a trial record so the app is usable.
  if (!STRIPE_SECRET_KEY) {
    const trialEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const { data: billing } = await (supabase as any)
      .from("creator_billing")
      .upsert({ user_id: user.id, status: "trial", tier: "starter", trial_ends_at: trialEnd, conversion_due_at: null }, { onConflict: "user_id" })
      .select().single();
    return NextResponse.json({ billing });
  }

  // ── Card-required Checkout: subscription mode, 30-day trial, auto-bills ──
  try { await getOrCreateStripePrices(STRIPE_SECRET_KEY); } catch { /* non-fatal */ }
  const priceId = await getPriceId("starter", STRIPE_SECRET_KEY);
  const origin = new URL(req.url).origin;

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("payment_method_collection", "always");          // card required even during trial
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("subscription_data[trial_period_days]", "30");
  params.set("subscription_data[metadata][user_id]", user.id);
  params.set("subscription_data[metadata][platform]", "spotlightly");
  params.set("subscription_data[metadata][tier]", "starter");
  params.set("metadata[user_id]", user.id);
  params.set("metadata[platform]", "spotlightly");
  params.set("metadata[type]", "platform_subscription");
  params.set("customer_email", user.email ?? "");
  params.set("success_url", `${origin}/onboarding?billing={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/dashboard?pane=billing&billing=cancelled`);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const session = await res.json();
  if (!session?.url) {
    return NextResponse.json({ error: session?.error?.message ?? "Could not start billing setup" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url, checkout: true });
}
