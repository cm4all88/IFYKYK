// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/velocity.ts
//
// Server side tip velocity limits. Counts come from tip_checkout_attempts, a
// service role only table written for every tip family checkout Spotlightly
// creates. Only attempts that actually produced a Stripe session count toward a
// limit, so a fan who is told "slow down" is not kept locked out by their own
// retries.
//
// IP is one signal among several, never the only one: the creator level and
// fan level limits hold even when a VPN rotates the address.
//
// Known limit: counts are read, then the attempt is inserted, so a tight burst
// of concurrent requests can exceed a limit by a few. The limits are low enough
// that this does not change the outcome of the fraud pattern it targets.
// ──────────────────────────────────────────────────────────────────────────────

import type { TrustConfig } from "@/lib/trust/config";

export type VelocityCounts = {
  creator10m: number;
  creator1h: number;
  creatorUncompleted1h: number;
  creatorSucceeded1h: number;
  /** null when there is no usable IP or the tipper is signed in */
  guestIp10m: number | null;
  guestIp1h: number | null;
  /** null for guests */
  fan10m: number | null;
  fan1h: number | null;
};

export type VelocityRule =
  | "creator_attempts_10m"
  | "creator_attempts_1h"
  | "creator_uncompleted_sessions_1h"
  | "guest_ip_attempts_10m"
  | "guest_ip_attempts_1h"
  | "fan_attempts_10m"
  | "fan_attempts_1h";

export type VelocityResult = {
  allowed: boolean;
  rule: VelocityRule | null;
  userMessage: string | null;
};

const SLOW_DOWN = "A lot of tips have gone through here in a short time. Please try again in a few minutes.";

/**
 * Pure decision. `established` relaxes the per creator limits only; fan and IP
 * limits are about the tipper, not the creator, and never relax.
 */
export function evaluateVelocity(counts: VelocityCounts, config: TrustConfig, established: boolean): VelocityResult {
  const v = config.velocity;
  const m = established ? v.establishedCreatorMultiplier : 1;
  const block = (rule: VelocityRule): VelocityResult => ({ allowed: false, rule, userMessage: SLOW_DOWN });

  // A new attempt would be number count+1, so block once the count has reached the limit.
  if (counts.creator10m >= v.creatorAttempts10m * m) return block("creator_attempts_10m");
  if (counts.creator1h >= v.creatorAttempts1h * m) return block("creator_attempts_1h");
  if (counts.creatorUncompleted1h >= v.creatorUncompletedSessions1h * m && counts.creatorSucceeded1h === 0) {
    return block("creator_uncompleted_sessions_1h");
  }
  if (counts.fan10m !== null && counts.fan10m >= v.fanAttempts10m) return block("fan_attempts_10m");
  if (counts.fan1h !== null && counts.fan1h >= v.fanAttempts1h) return block("fan_attempts_1h");
  if (counts.guestIp10m !== null && counts.guestIp10m >= v.guestIpAttempts10m) return block("guest_ip_attempts_10m");
  if (counts.guestIp1h !== null && counts.guestIp1h >= v.guestIpAttempts1h) return block("guest_ip_attempts_1h");
  return { allowed: true, rule: null, userMessage: null };
}

/** Is this creator established enough to get the relaxed per creator limits? Pure. */
export function isEstablishedCreator(args: { createdAt: string | null; publishedPostCount: number; hasOpenFlags: boolean; now: Date }, config: TrustConfig): boolean {
  if (args.hasOpenFlags || !args.createdAt) return false;
  const ageDays = (args.now.getTime() - new Date(args.createdAt).getTime()) / 86_400_000;
  return ageDays >= config.establishedCreatorDays && args.publishedPostCount >= config.establishedCreatorPosts;
}

async function countAttempts(admin: any, filters: (q: any) => any, sinceIso: string): Promise<number> {
  const base = admin.from("tip_checkout_attempts").select("id", { count: "exact", head: true })
    .eq("outcome", "session_created").gte("created_at", sinceIso);
  const { count, error } = await filters(base);
  if (error) throw new Error(`velocity count failed: ${error.code ?? error.message}`);
  return count ?? 0;
}

/** Load all counts for one prospective attempt. Service role only. */
export async function loadVelocityCounts(admin: any, args: {
  creatorProfileId: string;
  fanUserId: string | null;
  ip: string | null;
  now: Date;
}): Promise<VelocityCounts> {
  const t10m = new Date(args.now.getTime() - 10 * 60_000).toISOString();
  const t1h = new Date(args.now.getTime() - 3600_000).toISOString();
  const byCreator = (q: any) => q.eq("creator_profile_id", args.creatorProfileId);

  const [creator10m, creator1h, creatorUncompleted1h, succeeded] = await Promise.all([
    countAttempts(admin, byCreator, t10m),
    countAttempts(admin, byCreator, t1h),
    countAttempts(admin, (q) => byCreator(q).is("completed_at", null), t1h),
    admin.from("tips").select("id", { count: "exact", head: true })
      .eq("creator_profile_id", args.creatorProfileId).eq("status", "succeeded").gte("succeeded_at", t1h),
  ]);
  if (succeeded.error) throw new Error(`velocity succeeded count failed: ${succeeded.error.code ?? succeeded.error.message}`);

  let fan10m: number | null = null, fan1h: number | null = null;
  let guestIp10m: number | null = null, guestIp1h: number | null = null;
  if (args.fanUserId) {
    const byFan = (q: any) => q.eq("fan_user_id", args.fanUserId);
    [fan10m, fan1h] = await Promise.all([countAttempts(admin, byFan, t10m), countAttempts(admin, byFan, t1h)]);
  } else if (args.ip) {
    const byIp = (q: any) => q.eq("ip", args.ip).is("fan_user_id", null);
    [guestIp10m, guestIp1h] = await Promise.all([countAttempts(admin, byIp, t10m), countAttempts(admin, byIp, t1h)]);
  }

  return {
    creator10m, creator1h, creatorUncompleted1h,
    creatorSucceeded1h: succeeded.count ?? 0,
    guestIp10m, guestIp1h, fan10m, fan1h,
  };
}
