import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const creatorProfileId = formData.get("creator_profile_id");
  const channelId = formData.get("channel_id");

  if (typeof creatorProfileId !== "string") {
    return NextResponse.json({ error: "Missing creator_profile_id" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Subscriptions not yet available." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const { data: p } = await (supabase as any)
      .from("creator_profiles").select("handle").eq("id", creatorProfileId).maybeSingle();
    return NextResponse.redirect(new URL(`/login?return=/${p?.handle ?? ""}`, req.url));
  }

  // Get creator profile including stripe_account_id and subscription_price
  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("handle, kind, stripe_account_id, stripe_onboarded, subscription_price")
    .eq("id", creatorProfileId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  if (!profile.stripe_account_id || !profile.stripe_onboarded) {
    return NextResponse.json({ error: "Creator has not connected Stripe yet." }, { status: 503 });
  }

  // Get channel price if specified
  let priceCents = Math.round((Number(profile.subscription_price) || 9.99) * 100);
  let channelName = "subscription";
  if (typeof channelId === "string" && channelId.length > 0) {
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

  // Create Stripe Checkout session routed to creator's connected account
  // Spotlightly charges a flat monthly fee separately — 0% taken from this transaction
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `${profile.handle} · ${channelName}`,
    "line_items[0][price_data][unit_amount]": String(priceCents),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][quantity]": "1",
    // Route money directly to creator's connected account
    "transfer_data[destination]": profile.stripe_account_id,
    "success_url": `${origin}/${profile.handle}?subscribed=1`,
    "cancel_url": `${origin}/${profile.handle}`,
    "client_reference_id": user.id,
    "metadata[creator_profile_id]": creatorProfileId,
    "metadata[channel_id]": typeof channelId === "string" ? channelId : "",
    "metadata[user_id]": user.id,
    "metadata[type]": "subscription",
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const session = await stripeRes.json();
  return NextResponse.redirect(session.url, { status: 303 });
}
