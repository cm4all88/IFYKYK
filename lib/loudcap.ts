// ──────────────────────────────────────────────────────────────────
// lib/loudcap.ts
// Loudcap merch partner — white-label via Printful fulfillment.
// UI/brand: Loudcap. Backend: Printful API.
// Creators never see Printful. Everything is Loudcap to them.
// ──────────────────────────────────────────────────────────────────

const PRINTFUL_API = "https://api.printful.com";
const LOUDCAP_KEY = process.env.LOUDCAP_API_KEY ?? "";

export const MERCH_PLATFORM_CUT = 0.05; // 5% to Spotlightly for hosting

async function pf(path: string, options: RequestInit = {}) {
  if (!LOUDCAP_KEY) throw new Error("LOUDCAP_API_KEY is not set.");
  const res = await fetch(`${PRINTFUL_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOUDCAP_KEY}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Printful API ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────

export interface MerchProduct {
  id: string;
  name: string;
  description: string;
  base_price: number;
  category: string;
  variants: MerchVariant[];
  mockup_urls: string[];
}

export interface MerchVariant {
  id: string;
  size?: string;
  color?: string;
  color_hex?: string;
  stock: number;
}

export interface MerchOrder {
  id: string;
  status: "pending" | "in_production" | "shipped" | "delivered" | "cancelled";
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string;
}

// ── Catalog ───────────────────────────────────────────────────────

// Map Printful catalog to our internal format
// Category IDs are Printful product type IDs
const CATEGORY_MAP: Record<number, string> = {
  5: "tshirt",
  9: "hoodie",
  19: "hat",
  24: "mug",
  41: "poster",
  74: "tote",
  238: "phone_case",
};

export async function getLoudcapCatalog(): Promise<MerchProduct[]> {
  const { result } = await pf("/products");
  return (result ?? [])
    .filter((p: any) => Object.keys(CATEGORY_MAP).includes(String(p.type_id)))
    .map((p: any) => ({
      id: String(p.id),
      name: p.title,
      description: p.description ?? "",
      base_price: p.variants?.[0]?.price ?? 0,
      category: CATEGORY_MAP[p.type_id] ?? "other",
      variants: (p.variants ?? []).map((v: any) => ({
        id: String(v.id),
        size: v.size,
        color: v.color,
        color_hex: v.color_code,
        stock: v.availability_status === "active" ? 99 : 0,
      })),
      mockup_urls: p.image ? [p.image] : [],
    }));
}

// ── Store Products (creator's designed products) ──────────────────

export async function createMerchProduct(params: {
  creatorId: string;
  baseProductId: string;
  name: string;
  description: string;
  designUrl: string;
  retailPrice: number;
  variants: string[];
}): Promise<MerchProduct> {
  // Create a Printful sync product with the creator's design
  const body = {
    sync_product: {
      name: params.name,
      description: params.description,
      thumbnail: params.designUrl,
    },
    sync_variants: params.variants.map(variantId => ({
      variant_id: parseInt(variantId),
      retail_price: String(params.retailPrice),
      files: [
        { url: params.designUrl, placement: "front" },
      ],
    })),
  };

  const { result } = await pf("/store/products", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: String(result.id),
    name: result.sync_product.name,
    description: result.sync_product.description ?? "",
    base_price: parseFloat(result.sync_variants?.[0]?.cost ?? "0"),
    category: "tshirt",
    variants: (result.sync_variants ?? []).map((v: any) => ({
      id: String(v.id),
      size: v.name,
      color: null,
      color_hex: null,
      stock: 99,
    })),
    mockup_urls: result.sync_product.thumbnail_url ? [result.sync_product.thumbnail_url] : [],
  };
}

// ── Orders ────────────────────────────────────────────────────────

// Quote live shipping from Printful for a recipient + items. Called at
// checkout so the fan always pays exact shipping on top of the product price.
export async function getShippingRates(params: {
  recipient: { address1: string; city: string; state_code: string; zip: string; country_code: string };
  items: { variant_id: number; quantity: number }[];
}): Promise<{ id: string; name: string; rate: string; currency: string; minDays?: number; maxDays?: number }[]> {
  const { result } = await pf("/shipping/rates", {
    method: "POST",
    body: JSON.stringify({ recipient: params.recipient, items: params.items }),
  });
  return (result ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    rate: r.rate,
    currency: r.currency ?? "USD",
    minDays: r.minDeliveryDays,
    maxDays: r.maxDeliveryDays,
  }));
}

export async function createMerchOrder(params: {
  productId: string;
  variantId: string;
  quantity: number;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  fanEmail: string;
  creatorId: string;
}): Promise<MerchOrder> {
  const body = {
    recipient: {
      name: params.shippingAddress.name,
      address1: params.shippingAddress.line1,
      address2: params.shippingAddress.line2 ?? "",
      city: params.shippingAddress.city,
      state_code: params.shippingAddress.state,
      zip: params.shippingAddress.zip,
      country_code: params.shippingAddress.country,
      email: params.fanEmail,
    },
    items: [
      {
        sync_variant_id: parseInt(params.variantId),
        quantity: params.quantity,
      },
    ],
  };

  // confirm=1 sends the order straight to fulfillment (charges Loudcap).
  // Only ever called after the fan's Stripe payment has succeeded.
  const { result } = await pf("/orders?confirm=1", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: String(result.id),
    status: mapPrintfulStatus(result.status),
    tracking_number: result.shipments?.[0]?.tracking_number,
    tracking_url: result.shipments?.[0]?.tracking_url,
    estimated_delivery: result.shipments?.[0]?.estimated_delivery_dates?.max,
  };
}

export async function getMerchOrder(orderId: string): Promise<MerchOrder> {
  const { result } = await pf(`/orders/${orderId}`);
  return {
    id: String(result.id),
    status: mapPrintfulStatus(result.status),
    tracking_number: result.shipments?.[0]?.tracking_number,
    tracking_url: result.shipments?.[0]?.tracking_url,
    estimated_delivery: result.shipments?.[0]?.estimated_delivery_dates?.max,
  };
}

export async function getCreatorProducts(creatorId: string): Promise<MerchProduct[]> {
  // Filter store products by creator metadata
  const { result } = await pf("/store/products?limit=100");
  return (result ?? [])
    .filter((p: any) => p.sync_product?.description?.includes(`creator:${creatorId}`))
    .map((p: any) => ({
      id: String(p.id),
      name: p.sync_product.name,
      description: p.sync_product.description ?? "",
      base_price: parseFloat(p.sync_variants?.[0]?.cost ?? "0"),
      category: "tshirt",
      variants: (p.sync_variants ?? []).map((v: any) => ({
        id: String(v.id),
        size: v.name,
        color: null,
        color_hex: null,
        stock: 99,
      })),
      mockup_urls: p.sync_product.thumbnail_url ? [p.sync_product.thumbnail_url] : [],
    }));
}

// ── Helpers ───────────────────────────────────────────────────────

function mapPrintfulStatus(status: string): MerchOrder["status"] {
  switch (status) {
    case "pending":    return "pending";
    case "inprocess":  return "in_production";
    case "partial":    return "in_production";
    case "fulfilled":  return "shipped";
    case "delivered":  return "delivered";
    case "cancelled":  return "cancelled";
    default:           return "pending";
  }
}

export function calcMerchPricing(retailPrice: number, baseCost: number) {
  const platformCut = Math.round(retailPrice * MERCH_PLATFORM_CUT * 100) / 100;
  const creatorEarns = Math.round((retailPrice - baseCost - platformCut) * 100) / 100;
  return { retailPrice, baseCost, platformCut, creatorEarns };
}
