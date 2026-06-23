// Source-agnostic import core. Every path (CSV, photo/AI, creator-side capture,
// and later Etsy/eBay API) produces the same ParsedListing shape and funnels
// through createDraftListing, so the creator never has to care where a listing
// came from.

export type ImportSourceId =
  | "poshmark" | "mercari" | "ebay" | "etsy" | "depop" | "facebook" | "csv" | "photos" | "screenshots" | "capture" | "other";

export const IMPORT_SOURCES: { id: ImportSourceId; label: string }[] = [
  { id: "poshmark", label: "Poshmark" },
  { id: "mercari", label: "Mercari" },
  { id: "ebay", label: "eBay" },
  { id: "depop", label: "Depop" },
  { id: "etsy", label: "Etsy" },
  { id: "facebook", label: "Facebook Marketplace" },
  { id: "other", label: "Other" },
];

const MARKETPLACE_CATEGORIES = ["clothing", "accessories", "prints", "gear", "signed", "personal", "other"] as const;
const MARKETPLACE_CONDITIONS = ["new", "like_new", "good", "fair"] as const;

export type ParsedListing = {
  title: string;
  description: string;
  price: number;
  brand: string | null;
  category: string;
  size: string | null;
  condition: string;
  sourceUrl: string | null;
  imageUrls: string[];
};

export function normalizeCategory(raw?: string | null): string {
  const s = (raw || "").toLowerCase();
  if (!s) return "other";
  if (/(cloth|apparel|shirt|dress|jacket|pant|jean|hoodie|sweater|shoe|sneaker|top|skirt|coat)/.test(s)) return "clothing";
  if (/(accessor|bag|purse|jewel|hat|scarf|belt|watch|sunglass|wallet)/.test(s)) return "accessories";
  if (/(print|poster|art\b|painting|photo print|wall)/.test(s)) return "prints";
  if (/(gear|equipment|tech|electronic|camera|tool|instrument)/.test(s)) return "gear";
  if (/(signed|autograph|memorabil)/.test(s)) return "signed";
  if (/(personal|worn|used by me)/.test(s)) return "personal";
  return (MARKETPLACE_CATEGORIES as readonly string[]).includes(s) ? s : "other";
}

export function normalizeCondition(raw?: string | null): string {
  const s = (raw || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return "good";
  if (/(^|_)(nwt|new_with_tags|brand_new|new)($|_)/.test("_" + s + "_")) return "new";
  if (/(like_new|excellent|nwot|new_without)/.test(s)) return "like_new";
  if (/(fair|acceptable|worn|flaw)/.test(s)) return "fair";
  if (/(good|very_good|gently)/.test(s)) return "good";
  return (MARKETPLACE_CONDITIONS as readonly string[]).includes(s) ? s : "good";
}

export function sanitizePrice(raw?: string | number | null): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

function splitImages(raw?: string | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split(/[\s,|;]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

// ── A small, dependency-free CSV parser (quoted fields, "" escapes, CRLF). ──
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, ""); // strip BOM

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.length > 0)) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); if (row.some((v) => v.length > 0)) rows.push(row); }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find((h) => h === k || h.replace(/[\s_]+/g, "") === k.replace(/[\s_]+/g, ""));
    if (found && row[found]) return row[found];
  }
  return "";
}

/** Map one flexible CSV row to a ParsedListing. Tolerant of column naming. */
export function mapCsvRow(row: Record<string, string>): ParsedListing | null {
  const title = pick(row, ["title", "name", "listing title", "item", "item title", "product"]);
  if (!title) return null;
  const imgRaw = pick(row, ["images", "image", "photos", "photo", "image_url", "image urls", "image_urls", "picture", "pictures", "img", "photo url", "photo_urls"]);
  return {
    title: title.slice(0, 140),
    description: pick(row, ["description", "desc", "details", "body", "notes"]).slice(0, 5000),
    price: sanitizePrice(pick(row, ["price", "price_usd", "amount", "listing price", "cost", "retail"])),
    brand: pick(row, ["brand", "make", "designer", "label"]) || null,
    category: normalizeCategory(pick(row, ["category", "department", "type", "cat"])),
    size: pick(row, ["size", "sizing"]) || null,
    condition: normalizeCondition(pick(row, ["condition", "state"])),
    sourceUrl: pick(row, ["url", "source_url", "link", "listing url", "source url"]) || null,
    imageUrls: splitImages(imgRaw),
  };
}

export const IMPORT_PRICE_FLOOR = 1; // marketplace_listings enforces price_usd >= 1
