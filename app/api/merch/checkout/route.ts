import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { calcMerchPricing } from "@/lib/loudcap";

// Domestic shipping estimates by category (USD). The platform recovers this
// alongside the base cost so the creator keeps 100% of profit. Refine with
// live Loudcap rates later — see lib/loudcap getShippingRates.
const SHIPPING_ESTIMATE: Record<string, number> = {
  tshirt: 4.69, hoodie: 6.49, mug: 6.99, tote: 4.99, hat: 5.49, poster: 5.99,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to order merch" }, { status: 401 });

  const { productId, size } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { data: product } = await (supabase as any)
    .from("merch_products")
    .select("*, creator:creator_profile_id(id, handle, display_name, user_id, stripe_account_id, stripe_onboarded)")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (!product.creator?.stripe_onboarded || !product.creator?.stripe_account_id) {
    return NextResponse.json({ error: "This creator hasn't finished setting up payouts yet." }, { status: 503 });
  }

  const { STRIPE_SECRET_KEY, LOUDCAP_API_KEY } = await getSecrets(["STRIPE_SECRET_KEY", "LOUDCAP_API_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });
  // Merch can't be sold until fulfillment is live.
  if (!LOUDCAP_API_KEY) return NextResponse.json({ error: "Merch is coming soon for this creator." }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
  const retail = Number(product.retail_price);
  const baseCost = Number(product.base_cost);
  const shipping = SHIPPING_ESTIMATE[product.category] ?? 5.99;

  const { loudcapMargin, hostingFee } = calcMerchPricing(retail, baseCost);

  const retailCents = Math.round(retail * 100);
  const shippingCents = Math.round(shipping * 100);

  // Exact Stripe fee on the full charge (retail + shipping), borne by the
  // creator — consistent with the rest of the platform.
  const total = retail + shipping;
  const stripeFee = Math.round((total * 0.029 + 0.30) * 100) / 100;

  // Application fee withholds everything that isn't the creator's: Printful cost
  // + shipping (passthrough to the vendor), Loudcap's margin, Spotlightly's
  // hosting fee, and Stripe processing.
  const feeCents = Math.round((baseCost + shipping + loudcapMargin + hostingFee + stripeFee) * 100);
  // What lands with you, clean of Stripe and Printful: Loudcap margin + hosting.
  const platformEarnings = Math.round((loudcapMargin + hostingFee) * 100) / 100;
  // What the creator nets, transferred straight to their own Stripe account.
  const creatorEarns = Math.round((retail - baseCost - loudcapMargin - hostingFee - stripeFee) * 100) / 100;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": product.name,
    "line_items[0][price_data][product_data][description]": `From @${product.creator.handle}${size ? ` · ${size}` : ""}`,
    "line_items[0][price_data][unit_amount]": String(retailCents),
    "line_items[0][quantity]": "1",
    "payment_intent_data[application_fee_amount]": String(feeCents),
    "payment_intent_data[transfer_data][destination]": product.creator.stripe_account_id,
    "shipping_options[0][shipping_rate_data][type]": "fixed_amount",
    "shipping_options[0][shipping_rate_data][fixed_amount][amount]": String(shippingCents),
    "shipping_options[0][shipping_rate_data][fixed_amount][currency]": "usd",
    "shipping_options[0][shipping_rate_data][display_name]": "Standard shipping",
    "shipping_address_collection[allowed_countries][0]": "US",
    "shipping_address_collection[allowed_countries][1]": "CA",
    "shipping_address_collection[allowed_countries][2]": "GB",
    "shipping_address_collection[allowed_countries][3]": "AU",
    success_url: `${appUrl}/${product.creator.handle}?purchase=success`,
    cancel_url: `${appUrl}/${product.creator.handle}`,
    "metadata[type]": "merch",
    "metadata[product_id]": product.id,
    "metadata[creator_profile_id]": product.creator.id,
    "metadata[creator_user_id]": product.creator.user_id,
    "metadata[buyer_user_id]": user.id,
    "metadata[size]": size ?? "",
    "metadata[base_cost]": String(baseCost),
    "metadata[shipping]": String(shipping),
    "metadata[retail_price]": String(retail),
    "metadata[creator_earns]": String(creatorEarns),
    "metadata[platform_earnings]": String(platformEarnings),
    "metadata[loudcap_product_id]": String(product.loudcap_product_id ?? ""),
    "metadata[category]": product.category,
    "metadata[product_name]": product.name,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const session = await res.json();
  if (!res.ok) return NextResponse.json({ error: session.error?.message ?? "Checkout failed" }, { status: 500 });

  return NextResponse.json({ url: session.url });
}
