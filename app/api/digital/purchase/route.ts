import { NextRequest, NextResponse } from "next/server";
import { getPayeeCreator, canReceivePayments } from "@/lib/payee";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

import { grossUpForStripe } from "@/lib/fees";

// Digital is 0% to Spotlightly: the fan covers the card fee and the creator
// keeps 100% (matches the "0% cut" promise on the niche pages).
// NOTE: very large files cost real BunnyCDN storage/bandwidth. A size-based
// hosting fee can be added here once a threshold + amount are decided.

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { data: product } = await (supabase as any)
    .from("digital_products")
    .select("*")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // The payee's Connect account, read with the service role (lib/payee.ts).
  // Migration 064 removes anon read on creator_profiles, so the embed that
  // used to supply this returns nothing. The parent row above is still read
  // through the RLS-enforcing client — that is what authorises the purchase;
  // this only answers where the money goes.
  const payee = await getPayeeCreator((product as any).creator_profile_id);
  if (!canReceivePayments(payee)) {
    return NextResponse.json({ error: "Creator has not connected payments yet." }, { status: 503 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spotlightly.app";
  const netCents = Math.round(product.price * 100);
  const fanCents = grossUpForStripe(netCents); // fan covers the card fee

  const params = new URLSearchParams({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": product.title,
    "line_items[0][price_data][product_data][description]": (product.description ?? "").slice(0, 255),
    "line_items[0][price_data][unit_amount]": String(fanCents),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${appUrl}/downloads?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/${payee.handle}`,
    "metadata[product_id]": productId,
    "metadata[creator_profile_id]": product.creator_profile_id,
    "metadata[fan_user_id]": user?.id ?? "",
    "metadata[fan_email]": user?.email ?? "",
    "metadata[type]": "digital_purchase",
    "metadata[net_usd]": String(product.price),
  });

  if (payee.stripe_account_id) {
    params.set("payment_intent_data[transfer_data][destination]", payee.stripe_account_id);
    params.set("payment_intent_data[transfer_data][amount]", String(netCents)); // creator keeps 100%
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const session = await res.json();
  if (!res.ok) return NextResponse.json({ error: session.error?.message ?? "Checkout failed" }, { status: 500 });
  return NextResponse.json({ url: session.url });
}
