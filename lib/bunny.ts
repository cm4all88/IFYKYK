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
  // Pull-zone "URL Token Authentication Key" (Bunny dashboard → Pull Zone →
  // Security). When set, paid files are served via short-lived signed URLs so
  // the permanent CDN url is never exposed and download caps can't be bypassed.
  get TOKEN_KEY()   { return process.env.BUNNY_TOKEN_KEY || ""; },
};

export function bunnyUploadUrl(path: string): string {
  return `https://${BUNNY.STORAGE_ENDPOINT}/${BUNNY.STORAGE_ZONE}/${path}`;
}

export function bunnyCdnUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `https://${BUNNY.CDN_HOST}/${cleanPath}`;
}

/** True when Bunny token authentication is configured for the pull zone. */
export function bunnyTokenAuthEnabled(): boolean {
  return !!BUNNY.TOKEN_KEY;
}

/**
 * Sign a stored file for short-lived access using BunnyCDN's standard
 * (path-based) URL Token Authentication. Returns a URL that Bunny will only
 * serve until `expires`, after which the link is dead — so leaking the
 * redirect target no longer grants permanent or unlimited downloads.
 *
 * Accepts either a bare storage path ("digital/uid/123.pdf") or a full
 * Spotlightly.b-cdn.net url (we re-sign just the path). If no token key is
 * configured, returns the plain CDN url unchanged so behavior is unchanged
 * until the key is added in Vercel.
 *
 * Reference: Bunny "Token Authentication" — token = url-safe base64 of
 * sha256_raw(signingKey + path + expires), with `?token=…&expires=…`.
 */
export function bunnySignedUrl(pathOrUrl: string, ttlSeconds = 300): string {
  if (!pathOrUrl) return pathOrUrl;

  // Normalize to a leading-slash path Bunny will sign.
  let signPath: string;
  try {
    if (pathOrUrl.startsWith("http")) {
      signPath = new URL(pathOrUrl).pathname; // already starts with "/"
    } else {
      signPath = "/" + pathOrUrl.replace(/^\/+/, "");
    }
  } catch {
    signPath = "/" + pathOrUrl.replace(/^\/+/, "");
  }

  if (!BUNNY.TOKEN_KEY) {
    // No token key yet — hand back the plain CDN url (previous behavior).
    return `https://${BUNNY.CDN_HOST}${signPath}`;
  }

  // Lazily require crypto so this module stays import-safe on the edge.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("node:crypto") as typeof import("node:crypto");

  const expires = Math.floor(Date.now() / 1000) + Math.max(30, ttlSeconds);
  const hashable = BUNNY.TOKEN_KEY + signPath + String(expires);
  const token = crypto
    .createHash("sha256")
    .update(hashable)
    .digest("base64")
    .replace(/\n/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `https://${BUNNY.CDN_HOST}${signPath}?token=${token}&expires=${expires}`;
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
