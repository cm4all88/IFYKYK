export const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG ?? "spotlightly-20";

/** Pull a 10-char ASIN out of common Amazon URL shapes. */
export function extractAsin(raw: string): string | null {
  if (!raw) return null;
  const m =
    raw.match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/)([A-Z0-9]{10})(?:[/?]|$)/i) ||
    raw.match(/[/?=]([A-Z0-9]{10})(?:[/?&]|$)/);
  return m ? m[1].toUpperCase() : null;
}

/** Build a tagged affiliate URL from any pasted Amazon link. */
export function affiliateUrl(raw: string): string {
  const asin = extractAsin(raw);
  if (asin) return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;
  try {
    const u = new URL(raw);
    if (/amazon\.|amzn\.|a\.co/i.test(u.hostname)) {
      u.searchParams.set("tag", AMAZON_TAG);
      return u.toString();
    }
  } catch {}
  return raw;
}
