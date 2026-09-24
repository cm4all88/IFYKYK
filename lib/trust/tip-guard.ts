// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/tip-guard.ts
//
// The gate in front of every tip family Stripe Checkout session:
//   /api/tip, /api/super-tip, /api/live/tip
//
//   eligibility (lib/trust/eligibility.ts)
//   -> velocity (lib/trust/velocity.ts)
//   -> attempt row in tip_checkout_attempts (service role only)
//
// If the guard says no, the route MUST NOT call Stripe. Every refusal is logged
// with its reason so the admin trust view can see blocked pressure too.
// ──────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase-server";
import { loadTrustConfig, type TrustConfig } from "@/lib/trust/config";
import { canCreatorReceiveTips, type EligibilityResult } from "@/lib/trust/eligibility";
import { evaluateVelocity, isEstablishedCreator, loadVelocityCounts } from "@/lib/trust/velocity";
import { requestContextFrom, type RequestContext } from "@/lib/trust/request-context";
import { getStripeClient } from "@/lib/trust/stripe-client";
import { recordTrustEvent } from "@/lib/trust/audit";

export type TipKind = "tip" | "super_tip" | "live_tip";

export type GuardOk = {
  ok: true;
  admin: any;
  config: TrustConfig;
  ctx: RequestContext;
  attemptId: string | null;
  eligibility: EligibilityResult;
};
export type GuardNo = { ok: false; status: number; message: string; reason: string };

export async function guardTipCheckout(args: {
  kind: TipKind;
  creatorProfileId: string;
  fanUserId: string | null;
  headers: { get(k: string): string | null };
  amountUsd: number;
  postId?: string | null;
  source?: string | null;
}): Promise<GuardOk | GuardNo> {
  const now = new Date();
  const config = await loadTrustConfig();
  const ctx = requestContextFrom(args.headers);
  let admin: any;
  try {
    admin = await createServiceClient();
  } catch {
    return { ok: false, status: 503, message: "Tips are briefly unavailable. Please try again in a few minutes.", reason: "service_unavailable" };
  }

  const log = async (outcome: string, reason: string | null) => {
    const { data, error } = await admin.from("tip_checkout_attempts").insert({
      kind: args.kind,
      creator_profile_id: args.creatorProfileId,
      fan_user_id: args.fanUserId,
      post_id: args.postId ?? null,
      tip_source: args.source ?? null,
      amount_usd: args.amountUsd,
      ip: ctx.ip,
      country: ctx.country,
      region: ctx.region,
      user_agent: ctx.userAgent,
      outcome,
      block_reason: reason,
    }).select("id").maybeSingle();
    if (error) {
      console.error(JSON.stringify({ at: "lib/trust/tip-guard", event: "attempt_log_failed", code: error.code ?? null }));
      return null;
    }
    return (data?.id as string) ?? null;
  };

  let elig;
  try {
    elig = await canCreatorReceiveTips(args.creatorProfileId, {
      config, now, admin,
      retrieveAccount: async (id) => {
        const stripe = await getStripeClient();
        if (!stripe) throw new Error("stripe not configured");
        return stripe.accounts.retrieve(id);
      },
    });
  } catch (e: any) {
    console.error(JSON.stringify({ at: "lib/trust/tip-guard", event: "eligibility_failed", message: String(e?.message ?? "").slice(0, 200) }));
    return { ok: false, status: 503, message: "Tips are briefly unavailable. Please try again in a few minutes.", reason: "eligibility_error" };
  }

  if (!elig.eligible) {
    // Unknown creators are not logged: there is no creator row to attach them to.
    if (elig.creator) await log("blocked_eligibility", elig.reason);
    const status = elig.reason === "not_found" || elig.reason === "deleted" || elig.reason === "unpublished" || elig.reason === "inactive" ? 404
      : elig.reason === "stripe_status_unknown" ? 503 : 403;
    return { ok: false, status, message: elig.userMessage ?? "Tips aren't available right now.", reason: elig.reason ?? "ineligible" };
  }

  try {
    const counts = await loadVelocityCounts(admin, { creatorProfileId: args.creatorProfileId, fanUserId: args.fanUserId, ip: ctx.ip, now });
    const established = isEstablishedCreator({
      createdAt: elig.creator?.created_at ?? null,
      publishedPostCount: elig.publishedPostCount,
      hasOpenFlags: !!elig.trust?.payout_hold_active || elig.riskPeriod.active,
      now,
    }, config);
    const v = evaluateVelocity(counts, config, established);
    if (!v.allowed) {
      await log("blocked_velocity", v.rule);
      if (v.rule?.startsWith("creator_")) {
        await recordTrustEvent(admin, {
          creatorProfileId: args.creatorProfileId, kind: v.rule === "creator_uncompleted_sessions_1h" ? "many_checkout_sessions" : "high_tip_velocity",
          actor: "system", detail: { rule: v.rule, counts, kind: args.kind },
        });
      }
      return { ok: false, status: 429, message: v.userMessage!, reason: v.rule ?? "velocity" };
    }
  } catch (e: any) {
    console.error(JSON.stringify({ at: "lib/trust/tip-guard", event: "velocity_failed", message: String(e?.message ?? "").slice(0, 200) }));
    return { ok: false, status: 503, message: "Tips are briefly unavailable. Please try again in a few minutes.", reason: "velocity_error" };
  }

  // Logged as session_created BEFORE the Stripe call so concurrent requests
  // count each other. finishAttempt corrects it if Stripe refuses.
  const attemptId = await log("session_created", null);
  if (!attemptId) {
    // Without the attempt log there is no velocity limit. Fail closed.
    return { ok: false, status: 503, message: "Tips are briefly unavailable. Please try again in a few minutes.", reason: "attempt_log_failed" };
  }
  return { ok: true, admin, config, ctx, attemptId, eligibility: elig };
}

export async function finishAttempt(admin: any, attemptId: string | null, patch: { stripe_session_id?: string | null; tip_id?: string | null; outcome?: string; block_reason?: string | null }) {
  if (!attemptId) return;
  const { error } = await admin.from("tip_checkout_attempts").update(patch).eq("id", attemptId);
  if (error) console.error(JSON.stringify({ at: "lib/trust/tip-guard", event: "attempt_finish_failed", code: error.code ?? null }));
}

/** Validate a post id for a post based tip. Returns null when it is not a live post of this creator. */
export async function validateTipPost(admin: any, creatorProfileId: string, postId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return null;
  const { data } = await admin.from("posts").select("id").eq("id", postId).eq("creator_profile_id", creatorProfileId).eq("status", "live").maybeSingle();
  return data?.id ?? null;
}
