import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

const PLATFORM_CUT = 0.05;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { data: product } = await (supabase as any)
    .from("digital_products")
    .select("*, creator:creator_profile_id(stripe_account_id, handle, display_name)")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
  const platformFee = Math.round(product.price * PLATFORM_CUT * 100);

  const params = new URLSearchParams({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": product.title,
    "line_items[0][price_data][product_data][description]": (product.description ?? "").slice(0, 255),
    "line_items[0][price_data][unit_amount]": String(Math.round(product.price * 100)),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${appUrl}/downloads?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/${product.creator.handle}`,
    "metadata[product_id]": productId,
    "metadata[creator_profile_id]": product.creator_profile_id,
    "metadata[fan_user_id]": user?.id ?? "",
    "metadata[fan_email]": user?.email ?? "",
    "metadata[type]": "digital_purchase",
  });

  if (product.creator.stripe_account_id) {
    params.set("payment_intent_data[application_fee_amount]", String(platformFee));
    params.set("payment_intent_data[transfer_data][destination]", product.creator.stripe_account_id);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY ?? ""}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const session = await res.json();
  if (!res.ok) return NextResponse.json({ error: session.error?.message ?? "Checkout failed" }, { status: 500 });
  return NextResponse.json({ url: session.url });
}
