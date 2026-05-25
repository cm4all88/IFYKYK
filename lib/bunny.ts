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

export function bunnyCdnUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `https://${BUNNY.CDN_HOST}/${cleanPath}`;
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
