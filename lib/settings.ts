import { createClient } from "@/lib/supabase-server";

let cache: Record<string, string | null> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

async function loadAll(): Promise<Record<string, string | null>> {
  try {
    const supabase = await createClient();
    const { data } = await (supabase as any)
      .from("platform_settings")
      .select("key, value");

    const map: Record<string, string | null> = {};
    for (const row of data ?? []) {
      map[row.key] = row.value;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Resolve a secret: DB (platform_settings) first, then process.env fallback.
 * This means keys set in Vercel env vars work automatically without needing
 * to be entered in the admin panel.
 */
function resolveFromEnv(key: string): string | null {
  const val = process.env[key];
  return val && val.trim().length > 0 ? val : null;
}

export async function getSecret(key: string): Promise<string | null> {
  const now = Date.now();
  if (!cache || now - cacheLoadedAt > CACHE_TTL_MS) {
    cache = await loadAll();
    cacheLoadedAt = now;
  }
  const dbVal = cache[key];
  if (dbVal && dbVal.trim().length > 0) return dbVal;
  return resolveFromEnv(key);
}

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
    const dbVal = cache[k];
    if (dbVal && dbVal.trim().length > 0) {
      result[k] = dbVal;
    } else {
      result[k] = resolveFromEnv(k);
    }
  }
  return result as Record<K, string | null>;
}

export async function hasSecret(key: string): Promise<boolean> {
  return (await getSecret(key)) !== null;
}

export function clearSettingsCache() {
  cache = null;
  cacheLoadedAt = 0;
}
