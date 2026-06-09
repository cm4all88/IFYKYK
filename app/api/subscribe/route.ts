import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isCreatorProfileLocked } from "@/lib/billing";
import { getSecrets } from "@/lib/settings";
import { createHash } from "crypto";

function hashContact(value: string) {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const creatorProfileId = formData.get("creator_profile_id");
  const tierId = formData.get("tier_id") as string | null;
  const billingPeriod = (formData.get("billing_period") as string) || "monthly";

  if (typeof creatorProfileId !== "string") {
    return NextResponse.json({ error: "Missing creator_profile_id" }, { status: 400 });
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
    .select("handle, kind, stripe_account_id, stripe_onboarded, subscription_price")
    .eq("id", creatorProfileId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  let priceCents = Math.round((Number(profile.subscription_price) || 9.99) * 100);
  let subscriptionLabel = "subscription";
  const stripePriceId: string | null = null;

  // ── Resolve tier pricing ─────────────────────────────────────────
  if (tierId) {
    const { data: tier } = await (supabase as any)
      .from("subscription_tiers")
      .select("*")
      .eq("id", tierId)
      .eq("creator_profile_id", creatorProfileId)
      .eq("is_active", true)
      .maybeSingle();

    if (tier) {
      const monthly = Number(tier.price_monthly);
      const yearly = tier.price_yearly != null ? Number(tier.price_yearly) : null;
      const chosen = billingPeriod === "yearly" ? (yearly ?? monthly * 10) : monthly;
      priceCents = Math.round(chosen * 100);
      subscriptionLabel = tier.name;
    }
  }

  // ── Free tier: grant membership directly, no Stripe needed ───────
  if (priceCents <= 0) {
    const { data: existing } = await (supabase as any)
      .from("subscriptions")
      .select("id, status")
      .eq("fan_user_id", user.id)
      .eq("creator_profile_id", creatorProfileId)
      .maybeSingle();

    if (!(existing && existing.status === "active")) {
      await (supabase as any).from("subscriptions").upsert({
        creator_profile_id: creatorProfileId,
        fan_user_id: user.id,
        status: "active",
        tier: "free",
        tier_id: tierId || null,
        billing_period: billingPeriod,
        updated_at: new Date().toISOString(),
      }, { onConflict: "fan_user_id,creator_profile_id" });
    }
    return NextResponse.redirect(new URL(`/${profile.handle}?subscribed=1`, req.url), { status: 303 });
  }

  // ── Paid tier: requires Stripe ───────────────────────────────────
  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Subscriptions not yet available." }, { status: 503 });
  }
  if (!profile.stripe_account_id || !profile.stripe_onboarded) {
    return NextResponse.json({ error: "Creator has not connected Stripe yet." }, { status: 503 });
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
    "metadata[user_id]": user.id,
    "metadata[tier_id]": tierId ?? "",
    "metadata[billing_period]": billingPeriod,
    "metadata[type]": "subscription",
  });

  if (stripePriceId) {
    params.set("line_items[0][price]", stripePriceId);
    params.set("line_items[0][quantity]", "1");
  } else {
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][product_data][name]", `${profile.handle} · ${subscriptionLabel || "subscription"}`);
    params.set("line_items[0][price_data][unit_amount]", String(priceCents));
    params.set("line_items[0][price_data][recurring][interval]", interval);
    params.set("line_items[0][quantity]", "1");
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
