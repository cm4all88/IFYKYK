import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isCreatorProfileLocked } from "@/lib/billing";
import { can } from "@/lib/entitlements";
import { ensureFirstMonthCoupon } from "@/lib/offers";
import { getSecrets } from "@/lib/settings";
import { grossUpForStripe } from "@/lib/fees";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { tierId, billingPeriod = "monthly", successUrl, cancelUrl } = await req.json();

  if (!tierId) return NextResponse.json({ error: "Tier ID required" }, { status: 400 });
  if (!["monthly", "yearly"].includes(billingPeriod)) {
    return NextResponse.json({ error: "Invalid billing period" }, { status: 400 });
  }

  // Fetch tier + creator
  const { data: tier } = await (supabase as any)
    .from("subscription_tiers")
    .select("*, creator:creator_profile_id(id, handle, display_name, stripe_account_id, user_id, first_month_offer_pct)")
    .eq("id", tierId)
    .eq("is_active", true)
    .maybeSingle();

  if (!tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  if (!tier.creator?.stripe_account_id) {
    return NextResponse.json({ error: "Creator has not connected Stripe yet" }, { status: 400 });
  }

  if (await isCreatorProfileLocked(supabase, tier.creator.id)) {
    return NextResponse.json({ error: "This creator is currently unavailable." }, { status: 403 });
  }

  // Validate yearly is offered
  if (billingPeriod === "yearly" && !tier.price_yearly) {
    return NextResponse.json({ error: "This tier does not offer yearly billing" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
  const price = billingPeriod === "yearly" ? tier.price_yearly : tier.price_monthly;
  const priceInCents = Math.round(Number(price) * 100);
  // Direct charge on the creator's account — they bear Stripe's fee. Gross up
  // the fan's charge so the creator nets their full sticker price (Spotlightly 0%).
  const fanCents = grossUpForStripe(priceInCents);
  const interval = billingPeriod === "yearly" ? "year" : "month";

  const tierLabel = billingPeriod === "yearly"
    ? `${tier.name} · Yearly (save ${Math.round((1 - (tier.price_yearly / (tier.price_monthly * 12))) * 100)}%)`
    : `${tier.name} · Monthly`;

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(fanCents),
    "line_items[0][price_data][recurring][interval]": interval,
    "line_items[0][price_data][product_data][name]": `${tierLabel} — ${tier.creator.display_name ?? tier.creator.handle}`,
    // Never send an empty description: Stripe rejects empty strings rather than
    // ignoring them, which fails the whole checkout.
    "line_items[0][price_data][product_data][description]":
      (tier.description || tier.perks?.join(" · ") || `Subscription to @${tier.creator.handle}`).slice(0, 255),
    "line_items[0][quantity]": "1",
    success_url: successUrl ?? `${appUrl}/${tier.creator.handle}?subscribed=1`,
    cancel_url: cancelUrl ?? `${appUrl}/${tier.creator.handle}`,
    "metadata[type]": "subscription",
    "metadata[tier_id]": tierId,
    "metadata[creator_profile_id]": tier.creator_profile_id,
    "metadata[billing_period]": billingPeriod,
  });

  if (user?.id) params.set("metadata[fan_user_id]", user.id);
  if (user?.email) params.set("customer_email", user.email);

  // ── First-month offer (Starter+ entitlement) ────────────────────
  // Discount the fan's FIRST invoice only. Creator keeps 100% of the discounted
  // price; Spotlightly stays 0%. Applied only if the creator is currently
  // entitled (handles downgrade). Direct charge here runs on the creator's
  // connected account, so the coupon lives on that account.
  const offerPct = Number(tier.creator.first_month_offer_pct) || 0;
  if (offerPct > 0) {
    const { data: cb } = await (supabase as any)
      .from("creator_billing").select("status, tier").eq("user_id", tier.creator.user_id).maybeSingle();
    if (can(cb, "firstMonthOffer")) {
      const coupon = await ensureFirstMonthCoupon(STRIPE_SECRET_KEY, offerPct, tier.creator.stripe_account_id);
      if (coupon) params.set("discounts[0][coupon]", coupon);
    }
  }

  // Create checkout session on the creator's connected account
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Account": tier.creator.stripe_account_id,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.error?.message ?? "Could not create checkout" }, { status: 500 });
  }

  const session = await res.json();
  return NextResponse.json({ url: session.url });
}
