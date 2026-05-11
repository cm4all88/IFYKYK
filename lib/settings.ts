import { createClient } from "@/lib/supabase-server";

// Simple in-memory cache to avoid hitting the DB on every request.
// Cache lives for the lifetime of the serverless function instance.
// Cleared via clearSettingsCache() when admin updates a value.

let cache: Record<string, string | null> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

async function loadAll(): Promise<Record<string, string | null>> {
  const supabase = await createClient();
  // Use service role-style query — but we don't have service role client here,
  // so we rely on the request being from the admin user OR being unauthenticated.
  // For unauthenticated requests, RLS blocks reads.
  // The pattern: server components and route handlers that need secrets
  // create their own privileged (supabase as any) client using service role key
  // when settings are needed. For now, store secrets in env where possible
  // and fall back to platform_settings for keys that change frequently.

  const { data } = await (supabase as any)
    .from("platform_settings")
    .select("key, value");

  const map: Record<string, string | null> = {};
  for (const row of data ?? []) {
    map[row.key] = row.value;
  }
  return map;
}

/**
 * Get a single secret value. Returns null if missing or empty.
 *
 * USAGE:
 *   const stripeKey = await getSecret("STRIPE_SECRET_KEY");
 *   if (!stripeKey) return Response.json({ error: "Stripe not configured yet" }, { status: 503 });
 */
export async function getSecret(key: string): Promise<string | null> {
  const now = Date.now();
  if (!cache || now - cacheLoadedAt > CACHE_TTL_MS) {
    cache = await loadAll();
    cacheLoadedAt = now;
  }
  const v = cache[key];
  return v && v.trim().length > 0 ? v : null;
}

/**
 * Get multiple secrets at once. Useful when you need several to do anything.
 *
 * USAGE:
 *   const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = await getSecrets([
 *     "STRIPE_SECRET_KEY",
 *     "STRIPE_WEBHOOK_SECRET",
 *   ]);
 */
export async function getSecrets<K extends string>(
  keys: readonly K[]
): Promise<Record<K, string | null>> {
  const now = Date.now();
  if (!cache || now - cacheLoadedAt > CACHE_TTL_MS) {
    cache = await loadAll();
    cacheLoadedAt = now;
  }
  const result: Record<string, string | null> = {};
  for (const k of keys) {
    const v = cache[k];
    result[k] = v && v.trim().length > 0 ? v : null;
  }
  return result as Record<K, string | null>;
}

/**
 * Check if a secret has a non-empty value. Used for "is this integration configured?" checks.
 */
export async function hasSecret(key: string): Promise<boolean> {
  return (await getSecret(key)) !== null;
}

/**
 * Force a refresh of the cache. Call after updating settings via the admin page.
 */
export function clearSettingsCache() {
  cache = null;
  cacheLoadedAt = 0;
}
