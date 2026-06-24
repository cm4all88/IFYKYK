/**
 * BunnyCDN configuration — single source of truth.
 * All upload routes import from here.
 *
 * Storage zone: spotlightly-media (LA region)
 * CDN pull zone: Spotlightly.b-cdn.net
 */

export const BUNNY = {
  STORAGE_ZONE:     process.env.BUNNY_STORAGE_ZONE     || "spotlightly-media",
  STORAGE_ENDPOINT: process.env.BUNNY_STORAGE_ENDPOINT || "la.storage.bunnycdn.com",
  CDN_HOST:         "Spotlightly.b-cdn.net", // hardcoded — BunnyCDN created with capital S
  get API_KEY()     { return process.env.BUNNY_API_KEY || ""; },
  get STREAM_LIBRARY_ID() { return process.env.BUNNY_STREAM_LIBRARY_ID || ""; },
  get STREAM_KEY()  { return process.env.BUNNY_STREAM_KEY || ""; },
};

export function bunnyUploadUrl(path: string): string {
  return `https://${BUNNY.STORAGE_ENDPOINT}/${BUNNY.STORAGE_ZONE}/${path}`;
}

import crypto from "crypto";

// Bunny Token Authentication URL signer for locked originals.
// DORMANT until you (1) enable Token Authentication on the pull zone in the
// Bunny dashboard and (2) set BUNNY_TOKEN_KEY to that zone's security key.
// Until then it returns the plain URL, so current behaviour is unchanged.
// Once enabled, the raw CDN URL stops working without a fresh server-signed
// token, which closes the "I have the raw URL" backdoor.
export function bunnySignUrl(fullUrl: string, expirySeconds = 3600): string {
  const key = process.env.BUNNY_TOKEN_KEY;
  if (!key) return fullUrl;
  try {
    const u = new URL(fullUrl);
    const expires = Math.floor(Date.now() / 1000) + expirySeconds;
    const token = crypto
      .createHash("sha256")
      .update(key + u.pathname + expires)
      .digest("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    u.searchParams.set("token", token);
    u.searchParams.set("expires", String(expires));
    return u.toString();
  } catch {
    return fullUrl;
  }
}

export function bunnyCdnUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `https://${BUNNY.CDN_HOST}/${cleanPath}`;
}

// Bunny Optimizer (Dynamic Images): append resize/quality params to a Bunny CDN
// URL so it serves a right-sized, compressed, WebP variant per screen, cached at
// the edge. No-op for non-Bunny URLs. SAFE when the Optimizer add-on is OFF
// (Bunny just serves the original); it starts working the moment the Optimizer
// (and WebP) are enabled on the Spotlightly pull zone in the Bunny dashboard.
function isBunnyUrl(url: string): boolean {
  return /\.b-cdn\.net\//i.test(url);
}

export function bunnyImage(
  url: string | null | undefined,
  opts: { width?: number; height?: number; quality?: number; aspectRatio?: string } = {},
): string {
  if (!url) return "";
  if (!isBunnyUrl(url)) return url; // external avatars, etc. pass through untouched
  try {
    const u = new URL(url);
    if (opts.width) u.searchParams.set("width", String(Math.round(opts.width)));
    if (opts.height) u.searchParams.set("height", String(Math.round(opts.height)));
    if (opts.aspectRatio) u.searchParams.set("aspect_ratio", opts.aspectRatio);
    if (opts.quality) u.searchParams.set("quality", String(opts.quality));
    return u.toString();
  } catch {
    return url;
  }
}

// Build a srcset of width variants for a responsive <img srcset> with sizes.
export function bunnyImageSrcSet(
  url: string | null | undefined,
  widths: number[],
  opts: { quality?: number; aspectRatio?: string } = {},
): string | undefined {
  if (!url || !isBunnyUrl(url)) return undefined;
  return widths
    .map((w) => `${bunnyImage(url, { width: w, quality: opts.quality, aspectRatio: opts.aspectRatio })} ${w}w`)
    .join(", ");
}

/**
 * Create a new BunnyCDN Stream live stream.
 * Returns the stream object including guid (used as stream key).
 */
export async function createLiveStream(title: string): Promise<{ guid: string; [key: string]: any }> {
  const libraryId = BUNNY.STREAM_LIBRARY_ID;
  const apiKey = BUNNY.STREAM_KEY;

  if (!libraryId || !apiKey) {
    throw new Error("BunnyCDN Stream not configured — missing BUNNY_STREAM_LIBRARY_ID or BUNNY_STREAM_KEY");
  }

  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: "POST",
    headers: {
      "AccessKey": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`BunnyCDN Stream error (${res.status}): ${err}`);
  }

  return res.json();
}
