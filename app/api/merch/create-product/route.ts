import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calcMerchPricing } from "@/lib/loudcap";
import { getSecrets } from "@/lib/settings";
import { sendAdminAlert } from "@/lib/email";

const PF = "https://api.printful.com";

// Base cost per product type — mirrors the Loudcap catalog (lib/loudcap +
// /api/merch/catalog). Used only when the client can't supply a live base cost.
const BASE_COST: Record<string, number> = {
  tshirt: 12.95, hoodie: 24.95, mug: 8.95, tote: 14.95, hat: 15.95, poster: 9.95,
};

// Last-resort catalog variant IDs, used ONLY if the client sent none (e.g. the
// catalog failed to load). These are White/default and will be flagged as an
// imperfect sync so the creator knows to re-pick a colour.
const FALLBACK_VARIANTS: Record<string, number[]> = {
  tshirt: [4011, 4012, 4013, 4014, 4015],
  hoodie: [2901, 2902, 2903, 2904],
  mug:    [1320],
  tote:   [3001],
  hat:    [10976],
  poster: [1, 2, 3],
};

// Build { sizeLabel -> sync_variant_id } from a Printful store product so an
// order can later target the EXACT variant with no guessing.
function buildVariantMap(syncVariants: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const v of syncVariants ?? []) {
    if (v?.id == null) continue;
    // Prefer the explicit size; fall back to the tail of the variant name
    // ("Classic Tee - White / M" -> "M").
    let size: string | null =
      (v.size && String(v.size)) ||
      (typeof v.name === "string" && v.name.includes("/") ? v.name.split("/").pop()!.trim() : null) ||
      (typeof v.name === "string" ? v.name.trim() : null);
    if (!size) continue;
    map[size] = Number(v.id);
  }
  return map;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { designUrl, productType, name, price, productColor, variantIds } = await req.json();

  if (!designUrl || !productType || !name || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, handle")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });

  const baseCost = BASE_COST[productType] ?? BASE_COST.tshirt;
  const pricing = calcMerchPricing(parseFloat(price), baseCost);

  // The client sends catalog variant IDs for the CHOSEN colour+sizes. Only fall
  // back to the White defaults if it sent nothing.
  const usedFallback = !Array.isArray(variantIds) || variantIds.length === 0;
  const catalogVariantIds: number[] = usedFallback
    ? (FALLBACK_VARIANTS[productType] ?? FALLBACK_VARIANTS.tshirt)
    : variantIds.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n));

  const { LOUDCAP_API_KEY } = await getSecrets(["LOUDCAP_API_KEY"]);

  let loudcapProductId = "";
  let mockupUrl: string | null = null;
  let variantMap: Record<string, number> = {};
  let printfulSynced = false;
  let syncError: string | null = null;

  if (!LOUDCAP_API_KEY) {
    syncError = "Merch fulfillment isn't connected yet (LOUDCAP_API_KEY not set).";
  } else {
    try {
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${LOUDCAP_API_KEY}` };

      const createRes = await fetch(`${PF}/store/products`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          sync_product: { name, thumbnail: designUrl },
          sync_variants: catalogVariantIds.map((id) => ({
            variant_id: id,
            retail_price: String(price),
            files: [{ url: designUrl, placement: "front" }],
          })),
        }),
      });

      if (!createRes.ok) {
        syncError = `Loudcap rejected the product (HTTP ${createRes.status}): ${(await createRes.text()).slice(0, 300)}`;
      } else {
        const created = await createRes.json();
        loudcapProductId = String(created.result?.id ?? "");

        // Re-fetch the created product to get fully-populated sync_variants
        // (size/colour reliably present) so the variant map is accurate.
        if (loudcapProductId) {
          const readRes = await fetch(`${PF}/store/products/${loudcapProductId}`, { headers: auth });
          if (readRes.ok) {
            const full = await readRes.json();
            variantMap = buildVariantMap(full.result?.sync_variants ?? []);
            mockupUrl = full.result?.sync_product?.thumbnail_url ?? designUrl;
          } else {
            variantMap = buildVariantMap(created.result?.sync_variants ?? []);
            mockupUrl = created.result?.sync_product?.thumbnail_url ?? designUrl;
          }
          printfulSynced = Object.keys(variantMap).length > 0;
          if (!printfulSynced) {
            syncError = "Product created on Loudcap but no sellable variants came back.";
          } else if (usedFallback) {
            syncError = "Synced with default (White) variants — the colour catalog didn't load. Re-pick a colour to fix.";
          }
        } else {
          syncError = "Loudcap accepted the product but returned no product id.";
        }
      }
    } catch (e: any) {
      syncError = `Loudcap sync failed: ${e?.message ?? "unknown error"}`;
    }
  }

  // A product that didn't fully reach Loudcap is PAUSED, not on sale — so a fan
  // can never buy something that can't be fulfilled. The creator sees why.
  const status = printfulSynced ? "active" : "paused";

  const { data: product, error } = await (supabase as any)
    .from("merch_products")
    .insert({
      creator_profile_id: profile.id,
      loudcap_product_id: loudcapProductId,
      variant_map: variantMap,
      printful_synced: printfulSynced,
      sync_error: syncError,
      name,
      design_url: designUrl,
      retail_price: pricing.retailPrice,
      base_cost: pricing.baseCost,
      platform_cut: pricing.platformCut,
      creator_earns: pricing.creatorEarns,
      category: productType,
      mockup_urls: mockupUrl ? [mockupUrl] : [designUrl],
      status,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Make a broken outbound link VISIBLE instead of silent.
  if (!printfulSynced) {
    sendAdminAlert(
      `Merch sync failed — @${profile.handle}`,
      "A merch product didn't reach Loudcap.",
      [
        `Creator: <strong>@${profile.handle}</strong>`,
        `Product: ${name} (${productType})`,
        `Reason: ${syncError ?? "unknown"}`,
        `Status: paused (not on sale until it syncs)`,
      ]
    ).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    product,
    synced: printfulSynced,
    // Surfaced to the creator UI so they know if something needs attention.
    warning: printfulSynced ? undefined : syncError,
  });
}

// The designer calls PATCH after generating a real Printful mockup. This handler
// was missing, so the mockup update was silently 405-ing and never saved.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, mockup_urls } = await req.json();
  if (!id || !Array.isArray(mockup_urls)) {
    return NextResponse.json({ error: "Missing id or mockup_urls" }, { status: 400 });
  }

  const { data: profile } = await (supabase as any)
    .from("creator_profiles").select("id").eq("user_id", user.id).eq("kind", "spotlight").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });

  // Ownership-scoped update — a creator can only touch their own product.
  const { error } = await (supabase as any)
    .from("merch_products")
    .update({ mockup_urls })
    .eq("id", id)
    .eq("creator_profile_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
