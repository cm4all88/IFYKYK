import { BUNNY, bunnyUploadUrl, bunnyCdnUrl } from "@/lib/bunny";

// Server-only. Copies imported listing photos INTO Spotlightly storage so a
// draft never depends on Poshmark / Mercari / Etsy / eBay / Depop / Facebook
// staying up or allowing hotlinks. Every stored URL is a Spotlightly CDN URL.

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB, matches the manual upload route
const FETCH_TIMEOUT_MS = 15000;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/gif": "gif", "image/heic": "heic",
  "image/heif": "heif", "image/avif": "avif",
};

function extFromUrl(url: string): string | null {
  const m = url.split("?")[0].match(/\.([a-z0-9]{3,4})$/i);
  const e = m?.[1]?.toLowerCase();
  return e && ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif"].includes(e)
    ? (e === "jpeg" ? "jpg" : e) : null;
}

function storagePath(userId: string, ext: string): string {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${userId}/imports/${stamp}-${rand}.${ext}`;
}

async function putToBunny(path: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<boolean> {
  const res = await fetch(bunnyUploadUrl(path), {
    method: "PUT",
    headers: { AccessKey: BUNNY.API_KEY, "Content-Type": contentType },
    body: body as any,
  });
  return res.ok;
}

export function storageConfigured(): boolean {
  return !!(BUNNY.API_KEY && BUNNY.STORAGE_ZONE);
}

/** Download a remote image URL and store it. Returns the Spotlightly CDN URL. */
export async function storeRemoteImage(
  userId: string,
  srcUrl: string,
): Promise<{ url: string } | { error: string }> {
  if (!storageConfigured()) return { error: "Storage not configured" };
  if (!/^https?:\/\//i.test(srcUrl)) return { error: "Not a valid image URL" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(srcUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SpotlightlyImporter/1.0)" },
    });
    if (!res.ok) return { error: `Source returned ${res.status}` };

    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (contentType && !contentType.startsWith("image/")) {
      return { error: `Not an image (${contentType || "unknown"})` };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) return { error: "Empty file" };
    if (buf.byteLength > MAX_BYTES) return { error: "Image exceeds 25 MB" };

    const ext = EXT_BY_TYPE[contentType] || extFromUrl(srcUrl) || "jpg";
    const path = storagePath(userId, ext);
    const ok = await putToBunny(path, buf, contentType || "image/jpeg");
    if (!ok) return { error: "Storage write failed" };
    return { url: bunnyCdnUrl(path) };
  } catch (e: any) {
    return { error: e?.name === "AbortError" ? "Source timed out" : (e?.message || "Download failed") };
  } finally {
    clearTimeout(timer);
  }
}

/** Store a base64 data URL (used by the creator-side capture / bookmarklet). */
export async function storeDataUrl(
  userId: string,
  dataUrl: string,
): Promise<{ url: string } | { error: string }> {
  if (!storageConfigured()) return { error: "Storage not configured" };
  const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) return { error: "Not a base64 image" };
  const contentType = m[1].toLowerCase();
  try {
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.byteLength === 0) return { error: "Empty file" };
    if (bytes.byteLength > MAX_BYTES) return { error: "Image exceeds 25 MB" };
    const ext = EXT_BY_TYPE[contentType] || "jpg";
    const path = storagePath(userId, ext);
    const ok = await putToBunny(path, bytes, contentType);
    if (!ok) return { error: "Storage write failed" };
    return { url: bunnyCdnUrl(path) };
  } catch (e: any) {
    return { error: e?.message || "Decode failed" };
  }
}

/**
 * Store a mixed list of image references (remote URLs and/or base64 data URLs),
 * preserving order. Returns the stored Spotlightly URLs plus a saved/failed tally
 * for the Import Dashboard.
 */
export async function storeImages(
  userId: string,
  refs: string[],
): Promise<{ stored: string[]; saved: number; failed: number; errors: string[] }> {
  const stored: string[] = [];
  const errors: string[] = [];
  let failed = 0;
  // Sequential on purpose: gentle on the source, predictable order, no thundering herd.
  for (const ref of refs.slice(0, 24)) {
    const r = ref.startsWith("data:")
      ? await storeDataUrl(userId, ref)
      : await storeRemoteImage(userId, ref);
    if ("url" in r) stored.push(r.url);
    else { failed += 1; errors.push(r.error); }
  }
  return { stored, saved: stored.length, failed, errors };
}
