// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/eligibility.ts
//
// canCreatorReceiveTips: the ONE server side answer to "may a tip checkout be
// created for this creator right now". Every tip checkout route calls it. The
// UI may hide a button, but the decision lives here.
//
// Split in two:
//   evaluateTipEligibility  pure, deterministic, unit tested
//   canCreatorReceiveTips   loads the facts (service role) and calls the above
//
// Stripe onboarding alone is not enough. The fraud pattern this exists for was:
// empty profile, Stripe connected within minutes, published, then a burst of $9
// card charges. Each rule below removes one step of that path.
// ──────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase-server";
import type { TrustConfig } from "@/lib/trust/config";
import { classifyStripeAccount, normalizeStripeAccount, payoutsAreHeld, type StripeAccountStatus } from "@/lib/trust/stripe-status";

export type MonetizationStatus = "active" | "under_review" | "blocked";

export type TrustRow = {
  creator_profile_id: string;
  tips_disabled: boolean;
  monetization_status: MonetizationStatus;
  payout_hold_active: boolean;
  stripe_onboarded_at: string | null;
  stripe_status_updated_at: string | null;
} & Partial<StripeAccountStatus>;

export type EligibilityCreator = {
  id: string;
  kind: string | null;
  published: boolean | null;
  is_active: boolean | null;
  deleted_at: string | null;
  created_at: string | null;
  stripe_account_id: string | null;
  stripe_onboarded: boolean | null;
  wants_tips?: boolean | null;
};

export type IneligibleReason =
  | "not_found"
  | "deleted"
  | "inactive"
  | "unpublished"
  | "not_spotlight"
  | "tips_turned_off"
  | "stripe_not_connected"
  | "stripe_status_unknown"
  | "stripe_rejected"
  | "stripe_restricted"
  | "stripe_charges_disabled"
  | "monetization_blocked"
  | "monetization_under_review"
  | "tips_disabled_by_admin"
  | "no_published_posts"
  | "new_creator_risk_period";

export type EligibilityResult = {
  eligible: boolean;
  reason: IneligibleReason | null;
  /** Safe to show a fan. Never names a fraud signal. */
  userMessage: string | null;
  riskPeriod: { active: boolean; endsAt: string | null };
  /** True when the creator is in the risk period and accepted only because payouts are held. */
  acceptedUnderPayoutHold: boolean;
};

export type EligibilityInput = {
  creator: EligibilityCreator | null;
  trust: TrustRow | null;
  publishedPostCount: number;
  now: Date;
};

// Copy rule for this repo: no dashes of any kind in user facing strings.
const MSG_UNAVAILABLE = "Tips aren't open for this creator right now. Check back soon.";
const MSG_NOT_READY = "This creator isn't set up for tips yet. Check back soon.";
const MSG_TEMPORARY = "Tips are briefly unavailable. Please try again in a few minutes.";

function msgFor(reason: IneligibleReason): string {
  switch (reason) {
    case "not_found":
    case "deleted":
    case "inactive":
    case "unpublished":
    case "not_spotlight":
      return "We couldn't find that creator.";
    case "stripe_status_unknown":
      return MSG_TEMPORARY;
    case "stripe_not_connected":
    case "no_published_posts":
    case "new_creator_risk_period":
    case "tips_turned_off":
      return MSG_NOT_READY;
    default:
      // Review, blocks and Stripe restrictions all read the same to a fan.
      return MSG_UNAVAILABLE;
  }
}

/** Start of the new creator window: the later of profile creation and onboarding completion. */
export function riskPeriodStart(creator: Pick<EligibilityCreator, "created_at">, trust: Pick<TrustRow, "stripe_onboarded_at"> | null): Date | null {
  const times = [creator.created_at, trust?.stripe_onboarded_at]
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t));
  if (times.length === 0) return null;
  return new Date(Math.max(...times));
}

export function riskPeriodEnd(creator: Pick<EligibilityCreator, "created_at">, trust: Pick<TrustRow, "stripe_onboarded_at"> | null, config: TrustConfig): Date | null {
  const start = riskPeriodStart(creator, trust);
  return start ? new Date(start.getTime() + config.newCreatorRiskHours * 3600_000) : null;
}

export function evaluateTipEligibility(input: EligibilityInput, config: TrustConfig): EligibilityResult {
  const { creator, trust, publishedPostCount, now } = input;
  const no = (reason: IneligibleReason, riskEndsAt: Date | null = null): EligibilityResult => ({
    eligible: false,
    reason,
    userMessage: msgFor(reason),
    riskPeriod: { active: !!riskEndsAt && now < riskEndsAt, endsAt: riskEndsAt ? riskEndsAt.toISOString() : null },
    acceptedUnderPayoutHold: false,
  });

  if (!creator) return no("not_found");
  if (creator.deleted_at) return no("deleted");
  if (creator.is_active === false) return no("inactive");
  if (creator.published !== true) return no("unpublished");
  if ((creator.kind ?? "spotlight") !== "spotlight") return no("not_spotlight");
  if (creator.wants_tips === false) return no("tips_turned_off");

  // Admin state beats everything the creator or Stripe says.
  if (trust?.monetization_status === "blocked") return no("monetization_blocked");
  if (trust?.monetization_status === "under_review") return no("monetization_under_review");
  if (trust?.tips_disabled) return no("tips_disabled_by_admin");

  if (!creator.stripe_account_id || creator.stripe_onboarded !== true) return no("stripe_not_connected");

  // Stripe's view. The caller refreshes the cache when it is stale; if there is
  // still nothing, fail closed rather than trust a boolean set at onboarding.
  if (!trust || !trust.stripe_status_updated_at) return no("stripe_status_unknown");
  const cls = classifyStripeAccount({
    stripe_charges_enabled: trust.stripe_charges_enabled === true,
    stripe_details_submitted: trust.stripe_details_submitted === true,
    stripe_disabled_reason: trust.stripe_disabled_reason ?? null,
  });
  if (cls === "rejected") return no("stripe_rejected");
  if (cls === "restricted") return no("stripe_restricted");
  if (cls !== "ok") return no("stripe_charges_disabled");

  if (publishedPostCount < config.minPublishedPostsForTips) return no("no_published_posts");

  const endsAt = riskPeriodEnd(creator, trust, config);
  const inRisk = !!endsAt && now < endsAt;
  if (inRisk) {
    // Preferred path: accept, because the money cannot leave Stripe until we
    // release it. If that cannot be guaranteed, do not accept at all.
    if (!payoutsAreHeld(trust)) return no("new_creator_risk_period", endsAt);
    return {
      eligible: true, reason: null, userMessage: null,
      riskPeriod: { active: true, endsAt: endsAt!.toISOString() },
      acceptedUnderPayoutHold: true,
    };
  }

  return {
    eligible: true, reason: null, userMessage: null,
    riskPeriod: { active: false, endsAt: endsAt ? endsAt.toISOString() : null },
    acceptedUnderPayoutHold: false,
  };
}

// ── Loaders (service role) ─────────────────────────────────────────────────

const CREATOR_COLUMNS = "id, kind, published, is_active, deleted_at, created_at, stripe_account_id, stripe_onboarded, wants_tips";
const CREATOR_COLUMNS_FALLBACK = "id, kind, published, is_active, deleted_at, created_at, stripe_account_id, stripe_onboarded";

export async function loadEligibilityCreator(admin: any, creatorProfileId: string): Promise<EligibilityCreator | null> {
  let res = await admin.from("creator_profiles").select(CREATOR_COLUMNS).eq("id", creatorProfileId).maybeSingle();
  if (res.error && /wants_tips/.test(String(res.error.message ?? ""))) {
    // wants_tips arrived in 053; tolerate a database that predates it.
    res = await admin.from("creator_profiles").select(CREATOR_COLUMNS_FALLBACK).eq("id", creatorProfileId).maybeSingle();
  }
  if (res.error) throw new Error(`eligibility creator read failed: ${res.error.code ?? res.error.message}`);
  return (res.data as EligibilityCreator) ?? null;
}

export async function loadTrustRow(admin: any, creatorProfileId: string): Promise<TrustRow | null> {
  const { data, error } = await admin.from("creator_trust").select("*").eq("creator_profile_id", creatorProfileId).maybeSingle();
  if (error) throw new Error(`creator_trust read failed: ${error.code ?? error.message}`);
  return (data as TrustRow) ?? null;
}

/** Live, unarchived, unexpired, not moderation blocked. The same definition the public page uses. */
export async function countPublishedPosts(admin: any, creatorProfileId: string, now: Date): Promise<number> {
  const { count, error } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("creator_profile_id", creatorProfileId)
    .eq("status", "live")
    .is("archived_at", null)
    .neq("moderation_status", "blocked")
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);
  if (error) throw new Error(`post count failed: ${error.code ?? error.message}`);
  return count ?? 0;
}

/** Write a fresh Stripe status into creator_trust (upsert). */
export async function saveStripeStatus(admin: any, creatorProfileId: string, status: StripeAccountStatus, extra: Record<string, unknown> = {}) {
  const { error } = await admin.from("creator_trust").upsert({
    creator_profile_id: creatorProfileId,
    ...status,
    stripe_status_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...extra,
  }, { onConflict: "creator_profile_id" });
  if (error) console.error(JSON.stringify({ at: "lib/trust/eligibility", event: "stripe_status_save_failed", code: error.code ?? null }));
}

function isStale(trust: TrustRow | null, config: TrustConfig, now: Date): boolean {
  if (!trust?.stripe_status_updated_at) return true;
  const age = now.getTime() - new Date(trust.stripe_status_updated_at).getTime();
  return !(age >= 0 && age < config.stripeStatusMaxAgeMinutes * 60_000);
}

export type RetrieveAccount = (accountId: string) => Promise<any>;

/**
 * The full check. Refreshes the cached Stripe status when stale, then decides.
 * Throws only on database failure; callers treat a throw as "do not create a
 * checkout".
 */
export async function canCreatorReceiveTips(
  creatorProfileId: string,
  deps: { config: TrustConfig; retrieveAccount: RetrieveAccount; now?: Date; admin?: any },
): Promise<EligibilityResult & { creator: EligibilityCreator | null; trust: TrustRow | null; publishedPostCount: number }> {
  const now = deps.now ?? new Date();
  const admin = deps.admin ?? (await createServiceClient());
  const creator = await loadEligibilityCreator(admin, creatorProfileId);
  let trust = creator ? await loadTrustRow(admin, creatorProfileId) : null;

  if (creator?.stripe_account_id && creator.stripe_onboarded && isStale(trust, deps.config, now)) {
    try {
      const acct = await deps.retrieveAccount(creator.stripe_account_id);
      const status = normalizeStripeAccount(acct);
      await saveStripeStatus(admin, creator.id, status);
      trust = { ...(trust ?? {
        creator_profile_id: creator.id, tips_disabled: false, monetization_status: "active",
        payout_hold_active: false, stripe_onboarded_at: null,
      }), ...status, stripe_status_updated_at: now.toISOString() } as TrustRow;
    } catch (e: any) {
      // Keep whatever cache exists. With none, evaluate fails closed.
      console.error(JSON.stringify({ at: "lib/trust/eligibility", event: "stripe_account_refresh_failed", message: String(e?.message ?? "").slice(0, 200) }));
    }
  }

  const publishedPostCount = creator ? await countPublishedPosts(admin, creator.id, now) : 0;
  const result = evaluateTipEligibility({ creator, trust, publishedPostCount, now }, deps.config);
  return { ...result, creator, trust, publishedPostCount };
}
