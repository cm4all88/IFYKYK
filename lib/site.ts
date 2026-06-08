// Single source of truth for the canonical site URL.
// Falls back to the www apex (canonical) when the env var isn't set.
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spotlightly.app").replace(/\/$/, "");
