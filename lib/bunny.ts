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
