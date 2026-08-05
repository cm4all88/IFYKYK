import { NextRequest, NextResponse } from "next/server";
import { getPayeeCreator, canReceivePayments } from "@/lib/payee";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { calcMerchPricing } from "@/lib/loudcap";

// Flat US shipping estimate by category (USD). The platform recovers this
// alongside base cost so the creator keeps 100% of profit.
//
// IMPORTANT: these are US domestic rates. Checkout is US-only below for exactly
// this reason — an international order charged a domestic flat rate loses money
// on every sale. To re-enable CA/GB/AU, collect the address BEFORE creating the
// session and quote live rates via /api/merch/shipping-quote (getShippingRates),
// then pass the quoted amount as the fixed shipping_option here.
const SHIPPING_ESTIMATE: Record<string, number> = {
  tshirt: 5.49, hoodie: 7.99, mug: 7.49, tote: 5.49, hat: 6.49, poster: 6.49,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to order merch" }, { status: 401 });

  const { productId, size } = await req.json();
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { data: product } = await (supabase as any)
    .from("merch_products")
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
  if (!payee.stripe_onboarded || !payee.stripe_account_id) {
    return NextResponse.json({ error: "This creator hasn't finished setting up payouts yet." }, { status: 503 });
  }

  const { STRIPE_SECRET_KEY, LOUDCAP_API_KEY } = await getSecrets(["STRIPE_SECRET_KEY", "LOUDCAP_API_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });
  if (!LOUDCAP_API_KEY) return NextResponse.json({ error: "Merch is coming soon for this creator." }, { status: 503 });

  // ── Resolve the EXACT fulfillment variant up front ────────────────
  // variant_map is { sizeLabel -> Printful sync_variant_id }, captured when the
  // product was created. This is what lets the order ship the exact item the
  // fan chose — no fuzzy name matching at fulfillment time.
  const variantMap: Record<string, any> =
    product.variant_map && typeof product.variant_map === "object" ? product.variant_map : {};
  let loudcapVariantId = "";
  if (size != null && String(size).length) {
    const direct = variantMap[String(size)];
    if (direct != null) {
      loudcapVariantId = String(direct);
    } else {
      const key = Object.keys(variantMap).find((k) => k.toLowerCase() === String(size).toLowerCase());
      if (key) loudcapVariantId = String(variantMap[key]);
    }
  } else if (Object.keys(variantMap).length === 1) {
    // One-size products (mug, hat, tote) — the only variant.
    loudcapVariantId = String(Object.values(variantMap)[0]);
  }

  // If this product has a variant map but the chosen size isn't in it, refuse
  // rather than sell something we can't ship correctly. (Legacy products created
  // before variant_map existed have an empty map and fall through to the
  // webhook's size-based resolution — backward compatible.)
  if (Object.keys(variantMap).length > 0 && !loudcapVariantId) {
    return NextResponse.json({ error: "That size is unavailable. Please pick another." }, { status: 409 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
  const retail = Number(product.retail_price);
  const baseCost = Number(product.base_cost);
  const shipping = SHIPPING_ESTIMATE[product.category] ?? 6.49;

  const { loudcapMargin, hostingFee } = calcMerchPricing(retail, baseCost);

  const retailCents = Math.round(retail * 100);
  const shippingCents = Math.round(shipping * 100);

  const total = retail + shipping;
  const stripeFee = Math.round((total * 0.029 + 0.30) * 100) / 100;

  const feeCents = Math.round((baseCost + shipping + loudcapMargin + hostingFee + stripeFee) * 100);
  const platformEarnings = Math.round((loudcapMargin + hostingFee) * 100) / 100;
  const creatorEarns = Math.round((retail - baseCost - loudcapMargin - hostingFee - stripeFee) * 100) / 100;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": product.name,
    "line_items[0][price_data][product_data][description]": `From @${payee.handle}${size ? ` · ${size}` : ""}`,
    "line_items[0][price_data][unit_amount]": String(retailCents),
    "line_items[0][quantity]": "1",
    "payment_intent_data[application_fee_amount]": String(feeCents),
    "payment_intent_data[transfer_data][destination]": payee.stripe_account_id,
    "shipping_options[0][shipping_rate_data][type]": "fixed_amount",
    "shipping_options[0][shipping_rate_data][fixed_amount][amount]": String(shippingCents),
    "shipping_options[0][shipping_rate_data][fixed_amount][currency]": "usd",
    "shipping_options[0][shipping_rate_data][display_name]": "Standard shipping",
    // US only — see SHIPPING_ESTIMATE note above. Do NOT add CA/GB/AU here
    // without live rates, or every international order loses money.
    "shipping_address_collection[allowed_countries][0]": "US",
    success_url: `${appUrl}/${payee.handle}?purchase=success`,
    cancel_url: `${appUrl}/${payee.handle}`,
    "metadata[type]": "merch",
    "metadata[product_id]": product.id,
    "metadata[creator_profile_id]": payee.id,
    "metadata[creator_user_id]": payee.user_id,
    "metadata[buyer_user_id]": user.id,
    "metadata[size]": size ?? "",
    "metadata[base_cost]": String(baseCost),
    "metadata[shipping]": String(shipping),
    "metadata[retail_price]": String(retail),
    "metadata[creator_earns]": String(creatorEarns),
    "metadata[platform_earnings]": String(platformEarnings),
    "metadata[loudcap_product_id]": String(product.loudcap_product_id ?? ""),
    // Exact fulfillment variant — the webhook orders THIS, no guessing.
    "metadata[loudcap_variant_id]": loudcapVariantId,
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
