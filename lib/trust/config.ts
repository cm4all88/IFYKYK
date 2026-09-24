// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/config.ts
//
// Every trust and safety threshold lives here, in one object. Nothing else in
// the codebase hardcodes a risk window, a velocity limit or a hold length.
//
// Defaults are conservative. Any value can be overridden without a deploy by
// writing a JSON object to platform_settings under the key TRUST_SAFETY_CONFIG,
// for example:
//
//   {"newCreatorRiskHours": 48, "velocity": {"creatorAttempts10m": 8}}
//
// Overrides are merged over the defaults key by key and validated. A malformed
// override is logged and ignored; it can never loosen a limit to NaN or zero by
// accident.
// ──────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase-server";

export type VelocityConfig = {
  /** Tip checkout sessions created for one creator in 10 minutes. */
  creatorAttempts10m: number;
  /** Tip checkout sessions created for one creator in 1 hour. */
  creatorAttempts1h: number;
  /** Anonymous (guest) checkout sessions from one IP in 10 minutes. */
  guestIpAttempts10m: number;
  /** Anonymous (guest) checkout sessions from one IP in 1 hour. */
  guestIpAttempts1h: number;
  /** Checkout sessions from one signed in fan in 10 minutes. */
  fanAttempts10m: number;
  /** Checkout sessions from one signed in fan in 1 hour. */
  fanAttempts1h: number;
  /**
   * Sessions created for one creator in the last hour with zero completions.
   * Card testing looks exactly like this: lots of sessions, few or no wins.
   */
  creatorUncompletedSessions1h: number;
  /** Successful tips to one creator in 10 minutes before high_tip_velocity is raised (signal only). */
  creatorSucceeded10m: number;
  /** Successful tips to one creator in 1 hour before high_tip_velocity is raised (signal only). */
  creatorSucceeded1h: number;
  /**
   * Multiplier applied to the per creator limits for established creators
   * (see establishedCreator*). Keeps a real creator's busy night from being
   * throttled like a brand new empty account. 1 disables the relaxation.
   */
  establishedCreatorMultiplier: number;
};

export type TrustConfig = {
  /** Hours after max(profile created, Stripe onboarding completed) that a creator is "new". */
  newCreatorRiskHours: number;
  /** Published (live, unarchived, unexpired) posts required before tips are accepted. */
  minPublishedPostsForTips: number;
  /**
   * Days a new creator's Stripe payouts stay on manual (held) before they can
   * be released automatically, counted from the start of the risk period.
   */
  payoutHoldDays: number;
  /** Create new Connect accounts with payouts on manual so Spotlightly controls first release. */
  holdPayoutsForNewAccounts: boolean;
  /** Put a creator under review and hold payouts automatically when a dispute or early fraud warning arrives. */
  autoHoldOnDispute: boolean;
  /** Re-read Stripe account status at checkout time when the cached copy is older than this. */
  stripeStatusMaxAgeMinutes: number;
  /** Stripe Checkout session lifetime for tips. Stripe's minimum is 30. */
  tipSessionExpiryMinutes: number;
  /** A creator counts as established after this many days AND this many posts, with no open flags. */
  establishedCreatorDays: number;
  establishedCreatorPosts: number;
  /** Creators whose first IP shares a /24 with this many other creators in the window raise multiple_accounts_same_network. */
  sameNetworkCreatorThreshold: number;
  sameNetworkWindowDays: number;
  velocity: VelocityConfig;
};

export const DEFAULT_TRUST_CONFIG: TrustConfig = {
  newCreatorRiskHours: 24,
  minPublishedPostsForTips: 1,
  payoutHoldDays: 7,
  holdPayoutsForNewAccounts: true,
  autoHoldOnDispute: true,
  stripeStatusMaxAgeMinutes: 360,
  tipSessionExpiryMinutes: 30,
  establishedCreatorDays: 30,
  establishedCreatorPosts: 3,
  sameNetworkCreatorThreshold: 2,
  sameNetworkWindowDays: 14,
  velocity: {
    creatorAttempts10m: 5,
    creatorAttempts1h: 10,
    guestIpAttempts10m: 5,
    guestIpAttempts1h: 10,
    fanAttempts10m: 5,
    fanAttempts1h: 15,
    creatorUncompletedSessions1h: 8,
    creatorSucceeded10m: 5,
    creatorSucceeded1h: 10,
    establishedCreatorMultiplier: 3,
  },
};

/** Positive finite number, or the fallback. Zero and negatives are rejected: a limit of 0 would silently block everyone. */
function pos(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Non negative integer, or the fallback. Used where 0 is a legitimate setting. */
function nonNeg(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** Merge an untrusted override object over the defaults. Pure; exported for tests. */
export function mergeTrustConfig(override: unknown, base: TrustConfig = DEFAULT_TRUST_CONFIG): TrustConfig {
  const o = (override && typeof override === "object" ? override : {}) as Record<string, any>;
  const v = (o.velocity && typeof o.velocity === "object" ? o.velocity : {}) as Record<string, any>;
  const bv = base.velocity;
  return {
    newCreatorRiskHours: nonNeg(o.newCreatorRiskHours, base.newCreatorRiskHours),
    minPublishedPostsForTips: nonNeg(o.minPublishedPostsForTips, base.minPublishedPostsForTips),
    payoutHoldDays: nonNeg(o.payoutHoldDays, base.payoutHoldDays),
    holdPayoutsForNewAccounts: bool(o.holdPayoutsForNewAccounts, base.holdPayoutsForNewAccounts),
    autoHoldOnDispute: bool(o.autoHoldOnDispute, base.autoHoldOnDispute),
    stripeStatusMaxAgeMinutes: pos(o.stripeStatusMaxAgeMinutes, base.stripeStatusMaxAgeMinutes),
    tipSessionExpiryMinutes: Math.max(30, Math.min(1440, pos(o.tipSessionExpiryMinutes, base.tipSessionExpiryMinutes))),
    establishedCreatorDays: nonNeg(o.establishedCreatorDays, base.establishedCreatorDays),
    establishedCreatorPosts: nonNeg(o.establishedCreatorPosts, base.establishedCreatorPosts),
    sameNetworkCreatorThreshold: pos(o.sameNetworkCreatorThreshold, base.sameNetworkCreatorThreshold),
    sameNetworkWindowDays: pos(o.sameNetworkWindowDays, base.sameNetworkWindowDays),
    velocity: {
      creatorAttempts10m: pos(v.creatorAttempts10m, bv.creatorAttempts10m),
      creatorAttempts1h: pos(v.creatorAttempts1h, bv.creatorAttempts1h),
      guestIpAttempts10m: pos(v.guestIpAttempts10m, bv.guestIpAttempts10m),
      guestIpAttempts1h: pos(v.guestIpAttempts1h, bv.guestIpAttempts1h),
      fanAttempts10m: pos(v.fanAttempts10m, bv.fanAttempts10m),
      fanAttempts1h: pos(v.fanAttempts1h, bv.fanAttempts1h),
      creatorUncompletedSessions1h: pos(v.creatorUncompletedSessions1h, bv.creatorUncompletedSessions1h),
      creatorSucceeded10m: pos(v.creatorSucceeded10m, bv.creatorSucceeded10m),
      creatorSucceeded1h: pos(v.creatorSucceeded1h, bv.creatorSucceeded1h),
      establishedCreatorMultiplier: Math.max(1, pos(v.establishedCreatorMultiplier, bv.establishedCreatorMultiplier)),
    },
  };
}

export const TRUST_CONFIG_SETTINGS_KEY = "TRUST_SAFETY_CONFIG";

let cached: { at: number; value: TrustConfig } | null = null;
const CACHE_MS = 60_000;

/**
 * Load the live config. Reads platform_settings with the service role because
 * that table is admin only under RLS, and tip checkout runs for guests.
 * Any failure returns the defaults, never a looser config.
 */
export async function loadTrustConfig(): Promise<TrustConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  let value = DEFAULT_TRUST_CONFIG;
  try {
    const admin = await createServiceClient();
    const { data, error } = await (admin as any)
      .from("platform_settings").select("value").eq("key", TRUST_CONFIG_SETTINGS_KEY).maybeSingle();
    if (error) {
      console.error(JSON.stringify({ at: "lib/trust/config", event: "config_read_failed", code: error.code ?? null }));
    } else if (data?.value) {
      try {
        value = mergeTrustConfig(JSON.parse(String(data.value)));
      } catch {
        console.error(JSON.stringify({ at: "lib/trust/config", event: "config_parse_failed" }));
      }
    }
  } catch {
    // defaults
  }
  cached = { at: Date.now(), value };
  return value;
}

export function clearTrustConfigCache() {
  cached = null;
}
