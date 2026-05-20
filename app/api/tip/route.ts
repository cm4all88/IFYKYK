import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const creatorProfileId = formData.get("creator_profile_id");
  const amountUsd = Math.max(1, Math.min(1000, Number(formData.get("amount_usd")) || 5));

  if (typeof creatorProfileId !== "string") {
    return NextResponse.json({ error: "Missing creator_profile_id" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Tipping not yet available." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("handle, stripe_account_id, stripe_onboarded")
    .eq("id", creatorProfileId)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  if (!profile.stripe_account_id || !profile.stripe_onboarded) {
    return NextResponse.json({ error: "Creator has not connected Stripe yet." }, { status: 503 });
  }

  const origin = new URL(req.url).origin;

  // Tips are 0% to Spotlightly — full amount routed to creator
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Tip for @${profile.handle}`,
    "line_items[0][price_data][unit_amount]": String(Math.round(amountUsd * 100)),
    "line_items[0][quantity]": "1",
    // Route 100% of tip to creator — Spotlightly takes nothing from tips
    "transfer_data[destination]": profile.stripe_account_id,
    "success_url": `${origin}/${profile.handle}?tipped=1`,
    "cancel_url": `${origin}/${profile.handle}`,
    "client_reference_id": user.id,
    "metadata[creator_profile_id]": creatorProfileId,
    "metadata[user_id]": user.id,
    "metadata[type]": "tip",
    "metadata[amount_usd]": String(amountUsd),
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
    console.error("Stripe tip error:", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const session = await stripeRes.json();
  return NextResponse.redirect(session.url, { status: 303 });
}
