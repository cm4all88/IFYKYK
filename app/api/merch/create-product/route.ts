import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calcMerchPricing } from "@/lib/loudcap";
import { getSecrets } from "@/lib/settings";

// Printful variant IDs for common base products
// These are real Printful catalog variant IDs
const VARIANT_MAP: Record<string, { variantIds: number[]; baseCost: number }> = {
  tshirt:  { variantIds: [4011, 4012, 4013, 4014, 4015], baseCost: 12.95 }, // Bella+Canvas 3001 S-2XL White
  hoodie:  { variantIds: [2901, 2902, 2903, 2904],       baseCost: 24.95 }, // Gildan 18000 S-XL White
  mug:     { variantIds: [1320],                          baseCost: 8.95  }, // Printful mug 11oz
  tote:    { variantIds: [3001],                          baseCost: 14.95 }, // AOP tote bag
  hat:     { variantIds: [10976],                         baseCost: 15.95 }, // Flexfit hat
  poster:  { variantIds: [1, 2, 3],                       baseCost: 9.95  }, // Poster S/M/L
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { designUrl, productType, name, price, productColor } = await req.json();

  if (!designUrl || !productType || !name || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Get creator profile
  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });

  const variantInfo = VARIANT_MAP[productType] ?? VARIANT_MAP.tshirt;
  const pricing = calcMerchPricing(parseFloat(price), variantInfo.baseCost);

  // Try Printful if configured
  const { PRINTFUL_API_KEY } = await getSecrets(["PRINTFUL_API_KEY"]);

  let printfulProductId: string | null = null;
  let mockupUrl: string | null = null;

  if (PRINTFUL_API_KEY) {
    try {
      const body = {
        sync_product: {
          name,
          thumbnail: designUrl,
        },
        sync_variants: variantInfo.variantIds.map(id => ({
          variant_id: id,
          retail_price: price.toString(),
          files: [{ url: designUrl, placement: "front" }],
        })),
      };

      const pfRes = await fetch("https://api.printful.com/store/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PRINTFUL_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (pfRes.ok) {
        const pfData = await pfRes.json();
        printfulProductId = String(pfData.result?.id ?? "");
        mockupUrl = pfData.result?.sync_product?.thumbnail_url ?? designUrl;
      }
    } catch {
      // Non-fatal — save to DB without Printful
    }
  }

  // Save to database
  const { data: product, error } = await (supabase as any)
    .from("merch_products")
    .insert({
      creator_profile_id: profile.id,
      printful_product_id: printfulProductId ?? "",
      name,
      design_url: designUrl,
      retail_price: pricing.retailPrice,
      base_cost: pricing.baseCost,
      platform_cut: pricing.platformCut,
      creator_earns: pricing.creatorEarns,
      category: productType,
      mockup_urls: mockupUrl ? [mockupUrl] : [designUrl],
      status: "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, product });
}
