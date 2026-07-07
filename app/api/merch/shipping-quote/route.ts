import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getShippingRates } from "@/lib/loudcap";

// Live shipping quote from Loudcap for a product + destination. Call this from a
// pre-checkout address step, then pass the returned rate into the checkout
// session as the fixed shipping_option. This is the piece that lets you safely
// re-enable international (CA/GB/AU/…) without losing money on flat rates.
//
// Body: { productId, size, address: { line1, city, state, zip, country } }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { productId, size, address } = await req.json();
  if (!productId || !address?.country) {
    return NextResponse.json({ error: "Missing productId or destination country" }, { status: 400 });
  }

  const { data: product } = await (supabase as any)
    .from("merch_products")
    .select("id, variant_map, status")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const variantMap: Record<string, any> =
    product.variant_map && typeof product.variant_map === "object" ? product.variant_map : {};
  let variantId: number | null = null;
  if (size != null && variantMap[String(size)] != null) variantId = Number(variantMap[String(size)]);
  else if (Object.keys(variantMap).length === 1) variantId = Number(Object.values(variantMap)[0]);
  if (!variantId) return NextResponse.json({ error: "Unavailable in that size" }, { status: 409 });

  try {
    const rates = await getShippingRates({
      recipient: {
        address1: address.line1 ?? "",
        city: address.city ?? "",
        state_code: address.state ?? "",
        zip: address.zip ?? "",
        country_code: address.country,
      },
      items: [{ variant_id: variantId, quantity: 1 }],
    });
    // Cheapest first — the buyer can be shown the standard option.
    rates.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
    return NextResponse.json({ rates });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Could not fetch shipping" }, { status: 502 });
  }
}
