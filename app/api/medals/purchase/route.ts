import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { getPack } from "@/lib/medals";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to buy medals" }, { status: 401 });

  const { packId } = await req.json();
  const pack = getPack(packId);
  if (!pack) return NextResponse.json({ error: "Invalid pack" }, { status: 400 });

  const { STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY } = await getSecrets([
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
  ]);
  if (!STRIPE_SECRET_KEY || !STRIPE_PUBLISHABLE_KEY) {
    return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });
  }

  // Custom on-site payment (Stripe Payment Element). Platform-only charge.
  // Recorded by server-verifying this PaymentIntent in /api/medals/confirm,
  // so no webhook / Stripe-config changes are needed.
  const params = new URLSearchParams({
    "amount": String(Math.round(pack.price * 100)),
    "currency": "usd",
    "automatic_payment_methods[enabled]": "true",
    "description": `${pack.medals} Spotlightly medals`,
    "metadata[type]": "medal_pack",
    "metadata[pack_id]": pack.id,
    "metadata[medals]": String(pack.medals),
    "metadata[fan_user_id]": user.id,
    "metadata[amount_usd]": String(pack.price),
  });

  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  const pi = await res.json();
  return NextResponse.json({
    clientSecret: pi.client_secret,
    publishableKey: STRIPE_PUBLISHABLE_KEY,
  });
}
