import { NextResponse } from "next/server";
import { getSecrets } from "@/lib/settings";

// Curated Loudcap product catalog — Printful products we support
// Printful product IDs: https://developers.printful.com/docs/
const LOUDCAP_PRODUCTS = [
  { id: 71,  type: "tshirt",  name: "Classic Tee",     emoji: "👕", baseCost: 12.95, placement: "front" },
  { id: 146, type: "hoodie",  name: "Pullover Hoodie",  emoji: "🧥", baseCost: 24.95, placement: "front" },
  { id: 19,  type: "mug",     name: "Coffee Mug 11oz",  emoji: "☕", baseCost: 8.95,  placement: "front" },
  { id: 200, type: "tote",    name: "Tote Bag",         emoji: "👜", baseCost: 14.95, placement: "front" },
  { id: 75,  type: "hat",     name: "Snapback Cap",     emoji: "🧢", baseCost: 15.95, placement: "front" },
  { id: 1,   type: "poster",  name: "Poster",           emoji: "🖼️", baseCost: 9.95,  placement: "front" },
];

// Cache for 1 hour in memory
let catalogCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 3_600_000;

export async function GET() {
  // Return cache if fresh
  if (catalogCache && Date.now() - catalogCache.ts < CACHE_TTL) {
    return NextResponse.json({ products: catalogCache.data });
  }

  const { PRINTFUL_API_KEY } = await getSecrets(["PRINTFUL_API_KEY"]);

  // If no API key, return our hardcoded fallback catalog
  if (!PRINTFUL_API_KEY) {
    return NextResponse.json({
      products: LOUDCAP_PRODUCTS.map(p => ({
        ...p,
        variants: [],
        colors: [],
        sizes: ["S","M","L","XL","2XL"],
        image: null,
      }))
    });
  }

  // Fetch real variant data from Printful for each product
  const products = await Promise.all(
    LOUDCAP_PRODUCTS.map(async (p) => {
      try {
        const res = await fetch(`https://api.printful.com/products/${p.id}`, {
          headers: { Authorization: `Bearer ${PRINTFUL_API_KEY}` },
          next: { revalidate: 3600 },
        });
        if (!res.ok) return { ...p, variants: [], colors: [], sizes: [], image: null };

        const { result } = await res.json();
        const product = result?.product;
        const variants = result?.variants ?? [];

        // Extract unique colors with hex codes
        const colorMap = new Map<string, { name: string; hex: string }>();
        const sizeSet = new Set<string>();

        for (const v of variants) {
          if (v.color && v.color_code) {
            colorMap.set(v.color, { name: v.color, hex: v.color_code });
          }
          if (v.size) sizeSet.add(v.size);
        }

        return {
          ...p,
          name: product?.title ?? p.name,
          image: product?.image ?? null,
          variants: variants.map((v: any) => ({
            id: v.id,
            color: v.color,
            color_hex: v.color_code,
            size: v.size,
            price: v.price,
          })),
          colors: Array.from(colorMap.values()),
          sizes: Array.from(sizeSet),
        };
      } catch {
        return { ...p, variants: [], colors: [], sizes: [], image: null };
      }
    })
  );

  catalogCache = { data: products, ts: Date.now() };
  return NextResponse.json({ products });
}
