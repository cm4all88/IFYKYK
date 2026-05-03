import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const creatorProfileId = formData.get("creator_profile_id");
  const channelId = formData.get("channel_id"); // optional

  if (typeof creatorProfileId !== "string") {
    return NextResponse.json({ error: "Missing creator_profile_id" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Subscriptions not yet available. Stripe is not configured." },
      { status: 503 }
    );
  }

  // Confirm user is signed in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Look up creator + (optional) channel for pricing
  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("handle, kind")
    .eq("id", creatorProfileId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  let priceCents = 999;
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

  // Create a Stripe Checkout session via REST (avoids Stripe SDK bundling issues)
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `${profile.handle} · ${channelName}`,
    "line_items[0][price_data][unit_amount]": String(priceCents),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][quantity]": "1",
    "success_url": `${new URL(req.url).origin}/c/${profile.handle}?subscribed=1`,
    "cancel_url": `${new URL(req.url).origin}/c/${profile.handle}`,
    "client_reference_id": user.id,
    "metadata[creator_profile_id]": creatorProfileId,
    "metadata[channel_id]": typeof channelId === "string" ? channelId : "",
    "metadata[user_id]": user.id,
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
    const errBody = await stripeRes.text();
    console.error("Stripe checkout creation failed:", errBody);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const session = await stripeRes.json();
  return NextResponse.redirect(session.url, { status: 303 });
}
