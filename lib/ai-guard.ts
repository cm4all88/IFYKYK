// ──────────────────────────────────────────────────────────────────────────────
// lib/ai-guard.ts
//
// Access control for the Anthropic-backed routes.
//
// Why this exists: seven routes forwarded a request body straight into a model
// call billed to ANTHROPIC_API_KEY with no session requirement, no rate limit
// and no per-user quota. A loop against /api/studio/build ran up the bill
// without limit, and the request body reached the prompt directly, so they were
// also the natural target for prompt injection.
//
// Six of the seven are reached only from an authenticated surface (the creator
// dashboard, onboarding, or the admin page builder) and simply need a session.
//
// /api/advisor/signup is the exception: it powers the signup conversation and
// runs BEFORE an account exists. It cannot be session-gated without breaking
// signup, so it gets a rate limit instead.
// ──────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export type GuardFailure = { response: NextResponse };
export type CreatorSession = { userId: string; profileId: string | null };

/**
 * Require a signed-in user. Returns the session, or a ready-to-return 401.
 *
 * `requireProfile` additionally demands a spotlight creator profile — use it for
 * routes that generate content for a specific creator page.
 */
export async function requireCreatorSession(
  opts: { requireProfile?: boolean } = {}
): Promise<CreatorSession | GuardFailure> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (opts.requireProfile && !profile?.id) {
    return { response: NextResponse.json({ error: "No creator profile" }, { status: 403 }) };
  }

  return { userId: user.id, profileId: profile?.id ?? null };
}

export function isGuardFailure(v: CreatorSession | GuardFailure): v is GuardFailure {
  return (v as GuardFailure).response !== undefined;
}

// ── Rate limiting ────────────────────────────────────────────────────────────
// A fixed-window counter held in module scope. On Vercel that is per warm
// instance, not global, so it is a speed bump rather than a hard quota: a
// determined caller spread across instances still gets through. It is the
// strongest control available without adding infrastructure, and it turns
// "unbounded spend" into "bounded per instance". A durable limiter (Upstash
// Redis via the Marketplace, or Vercel BotID on the signup route) is the real
// fix and is tracked as follow-up.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Coarse client identity. Never logged, only hashed into a bucket key. */
export function clientKey(req: Request): string {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  return ip;
}

/**
 * Returns null when the call may proceed, or a ready-to-return 429.
 * Sweeps expired buckets opportunistically so the map cannot grow without bound.
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): GuardFailure | null {
  const now = Date.now();

  if (buckets.size > 5000) {
    // Array.from keeps this compatible with the project's ES target (no
    // downlevelIteration), and snapshots the keys so we can delete while walking.
    Array.from(buckets.keys()).forEach((k) => {
      const b = buckets.get(k);
      if (b && b.resetAt <= now) buckets.delete(k);
    });
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }

  existing.count += 1;
  if (existing.count > opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      response: NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      ),
    };
  }
  return null;
}

/** Test seam — resets the in-memory windows. */
export function __resetRateLimits() {
  buckets.clear();
}
