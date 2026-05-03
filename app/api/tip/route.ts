import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const creatorProfileId = formData.get("creator_profile_id");
  const amountUsdRaw = formData.get("amount_usd");
  const amountUsd = typeof amountUsdRaw === "string" ? Number(amountUsdRaw) : 5;

  if (typeof creatorProfileId !== "string") {
    return NextResponse.json({ error: "Missing creator_profile_id" }, { status: 400 });
  }
  if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 1000) {
    return NextResponse.json({ error: "Tip must be between $1 and $1000" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Tipping not yet available. Stripe is not configured." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("handle")
    .eq("id", creatorProfileId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Tip for @${profile.handle}`,
    "line_items[0][price_data][unit_amount]": String(Math.round(amountUsd * 100)),
    "line_items[0][quantity]": "1",
    "success_url": `${new URL(req.url).origin}/c/${profile.handle}?tipped=1`,
    "cancel_url": `${new URL(req.url).origin}/c/${profile.handle}`,
    "client_reference_id": user.id,
    "metadata[creator_profile_id]": creatorProfileId,
    "metadata[user_id]": user.id,
    "metadata[type]": "tip",
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
    console.error("Stripe tip checkout failed:", errBody);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const session = await stripeRes.json();
  return NextResponse.redirect(session.url, { status: 303 });
}
