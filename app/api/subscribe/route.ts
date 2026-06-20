import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isCreatorProfileLocked } from "@/lib/billing";
import { can } from "@/lib/entitlements";
import { ensureFirstMonthCoupon } from "@/lib/offers";
import { getSecrets } from "@/lib/settings";
import { createHash } from "crypto";
import { grossUpForStripe, appFeePercentForGrossUp } from "@/lib/fees";

function hashContact(value: string) {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const creatorProfileId = formData.get("creator_profile_id");
  const channelId = formData.get("channel_id");
  const tierId = formData.get("tier_id") as string | null;
  const billingPeriod = (formData.get("billing_period") as string) || "monthly";

  if (typeof creatorProfileId !== "string") {
    return NextResponse.json({ error: "Missing creator_profile_id" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Subscriptions not yet available." }, { status: 503 });
  }

  const supabase = await createClient();

  if (await isCreatorProfileLocked(supabase, creatorProfileId)) {
    const { data: cp } = await (supabase as any).from("creator_profiles").select("handle").eq("id", creatorProfileId).maybeSingle();
    return NextResponse.redirect(new URL(`/${cp?.handle ?? ""}?unavailable=1`, req.url));
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const { data: p } = await (supabase as any)
      .from("creator_profiles").select("handle").eq("id", creatorProfileId).maybeSingle();
    return NextResponse.redirect(new URL(`/login?return=/${p?.handle ?? ""}`, req.url));
  }

  // ── Pre-emptive contact block check ──────────────────────────────
  // Hash the fan's verified email and check against creator's block list.
  // Fan is silently redirected — never told they were blocked.
  const fanEmailHash = hashContact(user.email ?? "");
  const { data: blocked } = await (supabase as any)
    .from("creator_contact_blocks")
    .select("id")
    .eq("creator_profile_id", creatorProfileId)
    .eq("contact_hash", fanEmailHash)
    .maybeSingle();

  if (blocked) {
    // Silently redirect back to creator page — no error message
    const { data: p } = await (supabase as any)
      .from("creator_profiles").select("handle").eq("id", creatorProfileId).maybeSingle();
    return NextResponse.redirect(new URL(`/${p?.handle ?? ""}`, req.url));
  }
  // ─────────────────────────────────────────────────────────────────

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("handle, kind, user_id, stripe_account_id, stripe_onboarded, subscription_price, first_month_offer_pct")
    .eq("id", creatorProfileId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  if (!profile.stripe_account_id || !profile.stripe_onboarded) {
    return NextResponse.json({ error: "Creator has not connected Stripe yet." }, { status: 503 });
  }

  let priceCents = Math.round((Number(profile.subscription_price) || 9.99) * 100);
  let channelName = "subscription";
  let stripePriceId: string | null = null;
  let tierName = "";

  // ── Check for tier-based pricing ─────────────────────────────────
  if (tierId) {
    const { data: tier } = await (supabase as any)
      .from("subscription_tiers")
      .select("*")
      .eq("id", tierId)
      .eq("creator_profile_id", creatorProfileId)
      .eq("is_active", true)
      .maybeSingle();

    if (tier) {
      tierName = tier.name;
      const monthly = Number(tier.price_monthly);
      const yearly = tier.price_yearly != null ? Number(tier.price_yearly) : null;
      priceCents = billingPeriod === "yearly"
        ? Math.round((yearly ?? monthly * 10) * 100)
        : Math.round(monthly * 100);
      channelName = tier.name;
    }
  } else if (typeof channelId === "string" && channelId.length > 0) {
    const { data: ch } = await supabase
      .from("channels")
      .select("name, subscription_price")
      .eq("id", channelId)
      .maybeSingle();
    if (ch?.subscription_price) {
      priceCents = Math.round(Number(ch.subscription_price) * 100);
      channelName = ch.name;
    }
  }

  const origin = new URL(req.url).origin;
  const interval = billingPeriod === "yearly" ? "year" : "month";

  const params = new URLSearchParams({
    mode: "subscription",
    "subscription_data[transfer_data][destination]": profile.stripe_account_id,
    "success_url": `${origin}/${profile.handle}?subscribed=1`,
    "cancel_url": `${origin}/${profile.handle}`,
    "client_reference_id": user.id,
    "metadata[creator_profile_id]": creatorProfileId as string,
    "metadata[channel_id]": typeof channelId === "string" ? channelId : "",
    "metadata[user_id]": user.id,
    "metadata[tier_id]": tierId ?? "",
    "metadata[billing_period]": billingPeriod,
    "metadata[type]": "subscription",
  });

  if (stripePriceId) {
    params.set("line_items[0][price]", stripePriceId);
    params.set("line_items[0][quantity]", "1");
  } else {
    // Fan covers the card fee so the creator receives their full sticker price
    // and Spotlightly nets ~$0. Gross up the fan's recurring charge, then keep
    // the fee portion as the application fee (which Stripe deducts its cut from).
    const fanCents = grossUpForStripe(priceCents);
    const appFeePct = appFeePercentForGrossUp(priceCents);
    params.set("subscription_data[application_fee_percent]", appFeePct.toFixed(4));
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][product_data][name]", `${profile.handle} · ${channelName || "subscription"}`);
    params.set("line_items[0][price_data][product_data][description]", `Includes the card fee so @${profile.handle} receives the full $${(priceCents / 100).toFixed(2)}/${interval}.`);
    params.set("line_items[0][price_data][unit_amount]", String(fanCents));
    params.set("line_items[0][price_data][recurring][interval]", interval);
    params.set("line_items[0][quantity]", "1");
  }

  // ── First-month offer (Starter+ entitlement) ────────────────────
  // A creator-set discount on the fan's FIRST invoice only. The creator keeps
  // 100% of the discounted price; Spotlightly stays 0%. Applied only if the
  // creator is CURRENTLY entitled, so a downgraded creator's stale offer never
  // applies. Destination charge here runs on the platform account, so the
  // coupon lives on the platform account (no Stripe-Account).
  const offerPct = Number((profile as any).first_month_offer_pct) || 0;
  if (offerPct > 0) {
    const { data: cb } = await (supabase as any)
      .from("creator_billing").select("status, tier").eq("user_id", (profile as any).user_id).maybeSingle();
    if (can(cb, "firstMonthOffer")) {
      const coupon = await ensureFirstMonthCoupon(STRIPE_SECRET_KEY, offerPct);
      if (coupon) params.set("discounts[0][coupon]", coupon);
    }
  }

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    const errText = await stripeRes.text();
    console.error("Stripe checkout error:", errText);
    let msg = "Could not start checkout";
    try {
      const j = JSON.parse(errText);
      if (j?.error?.message) msg = `Could not start checkout: ${j.error.message}`;
    } catch { /* keep generic */ }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const session = await stripeRes.json();
  return NextResponse.redirect(session.url, { status: 303 });
}
