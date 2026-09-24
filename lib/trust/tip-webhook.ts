// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/tip-webhook.ts
//
// Webhook side of tip integrity and creator trust. Called from
// app/api/webhooks/stripe/route.ts AFTER signature verification and event
// de-duplication. Each handler:
//   1. finds the tip row (tip_id metadata first, then session / payment intent)
//   2. asks lib/trust/tip-state.ts for a plan
//   3. applies it with a conditional update on the prior status, so a
//      concurrent duplicate can never apply the same transition twice
//
// Returning status >= 500 makes Stripe retry. Only genuine write failures do.
// ──────────────────────────────────────────────────────────────────────────────

import type { TrustConfig } from "@/lib/trust/config";
import { recordTrustEvent } from "@/lib/trust/audit";
import { normalizeStripeAccount, classifyStripeAccount } from "@/lib/trust/stripe-status";
import { setStripePayoutHold } from "@/lib/trust/payouts";
import {
  planAsyncFailed, planDispute, planExpired, planRefund, planSessionPaid,
  type ExistingTip, type TipPlan,
} from "@/lib/trust/tip-state";

export type TrustWebhookDeps = {
  admin: any;
  config: TrustConfig;
  getStripe: () => Promise<any | null>;
  now?: Date;
  onTipSucceeded?: (tip: { id: string | null; creatorProfileId: string; amount: number; fanUserId: string | null }) => Promise<void>;
};

export type TrustWebhookResult = { handled: boolean; status: number; note?: string };

const TIP_COLUMNS = "id, status, amount, creator_profile_id, fan_user_id, stripe_payment_intent_id, stripe_session_id";

async function findTip(admin: any, by: { tipId?: string | null; sessionId?: string | null; paymentIntentId?: string | null }) {
  const tries: [string, string | null | undefined][] = [
    ["id", by.tipId], ["stripe_session_id", by.sessionId], ["stripe_payment_intent_id", by.paymentIntentId],
  ];
  for (const [col, val] of tries) {
    if (!val) continue;
    const { data, error } = await admin.from("tips").select(TIP_COLUMNS).eq(col, val).maybeSingle();
    if (error) throw new Error(`tip lookup by ${col} failed: ${error.code ?? error.message}`);
    if (data) return data as ExistingTip & { creator_profile_id: string; fan_user_id: string | null };
  }
  return null;
}

/** Apply a plan. Returns whether a row actually changed (false = someone else got there first). */
async function applyPlan(admin: any, existing: { id: string } | null, plan: TipPlan): Promise<{ changed: boolean; id: string | null; error?: string }> {
  if (plan.kind === "noop") return { changed: false, id: existing?.id ?? null };
  if (plan.kind === "insert") {
    const { data, error } = await admin.from("tips").insert(plan.row).select("id").maybeSingle();
    if (error) {
      if (error.code === "23505") return { changed: false, id: null }; // concurrent duplicate already inserted it
      return { changed: false, id: null, error: `${error.code ?? ""} ${error.message ?? ""}`.trim() };
    }
    return { changed: true, id: data?.id ?? null };
  }
  const { data, error } = await admin.from("tips").update(plan.patch)
    .eq("id", existing!.id).eq("status", plan.from).select("id");
  if (error) return { changed: false, id: existing!.id, error: `${error.code ?? ""} ${error.message ?? ""}`.trim() };
  return { changed: Array.isArray(data) && data.length > 0, id: existing!.id };
}

function piId(x: any): string | null {
  if (!x) return null;
  return typeof x === "string" ? x : x.id ?? null;
}

async function markAttemptCompleted(admin: any, sessionId: string | null, now: Date) {
  if (!sessionId) return;
  const { error } = await admin.from("tip_checkout_attempts")
    .update({ completed_at: now.toISOString() }).eq("stripe_session_id", sessionId).is("completed_at", null);
  if (error && error.code !== "42P01") {
    console.error(JSON.stringify({ at: "lib/trust/tip-webhook", event: "attempt_complete_failed", code: error.code ?? null }));
  }
}

/**
 * After a successful tip: record the card fingerprint and Stripe's own risk
 * assessment for review. Best effort; never fails the webhook. The raw
 * fingerprint is a Stripe token that identifies a card across payments without
 * revealing it; no card number, expiry or name is read or stored.
 */
async function enrichSucceededPayment(deps: TrustWebhookDeps, args: { paymentIntentId: string | null; sessionId: string | null; creatorProfileId: string | null }) {
  if (!args.paymentIntentId) return;
  try {
    const stripe = await deps.getStripe();
    if (!stripe) return;
    const pi = await stripe.paymentIntents.retrieve(args.paymentIntentId, { expand: ["latest_charge"] });
    const ch = pi?.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
    const card = ch?.payment_method_details?.card ?? null;
    const riskLevel: string | null = ch?.outcome?.risk_level ?? null;
    const riskScore: number | null = typeof ch?.outcome?.risk_score === "number" ? ch.outcome.risk_score : null;
    if (args.sessionId) {
      await deps.admin.from("tip_checkout_attempts").update({
        card_fingerprint: card?.fingerprint ?? null,
        card_country: card?.country ?? null,
        stripe_risk_level: riskLevel,
        stripe_risk_score: riskScore,
      }).eq("stripe_session_id", args.sessionId);
    }
    if (args.creatorProfileId && (riskLevel === "elevated" || riskLevel === "highest")) {
      await recordTrustEvent(deps.admin, {
        creatorProfileId: args.creatorProfileId, kind: "stripe_high_risk", actor: "system",
        detail: { payment_intent: args.paymentIntentId, risk_level: riskLevel, risk_score: riskScore },
      });
    }
  } catch (e: any) {
    console.error(JSON.stringify({ at: "lib/trust/tip-webhook", event: "enrich_failed", message: String(e?.message ?? "").slice(0, 200) }));
  }
}

/** Resolve the creator a charge paid, for disputes and fraud warnings on ANY product, not only tips. */
async function creatorForCharge(deps: TrustWebhookDeps, args: { paymentIntentId: string | null; chargeId: string | null }): Promise<string | null> {
  const tip = await findTip(deps.admin, { paymentIntentId: args.paymentIntentId }).catch(() => null);
  if (tip?.creator_profile_id) return tip.creator_profile_id;
  if (!args.chargeId) return null;
  try {
    const stripe = await deps.getStripe();
    if (!stripe) return null;
    const ch = await stripe.charges.retrieve(args.chargeId);
    const dest = typeof ch?.transfer_data?.destination === "string" ? ch.transfer_data.destination
      : typeof ch?.destination === "string" ? ch.destination : null;
    if (!dest) return null;
    const { data } = await deps.admin.from("creator_profiles").select("id").eq("stripe_account_id", dest).maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** Put a creator under review with payouts held. Used for disputes and early fraud warnings. */
async function autoHold(deps: TrustWebhookDeps, creatorProfileId: string, reason: string, detail: Record<string, unknown>) {
  const { admin, config } = deps;
  await recordTrustEvent(admin, { creatorProfileId, kind: reason, actor: "system", detail });
  if (!config.autoHoldOnDispute) return;

  const { data: cur } = await admin.from("creator_trust").select("monetization_status, payout_hold_active").eq("creator_profile_id", creatorProfileId).maybeSingle();
  const now = (deps.now ?? new Date()).toISOString();
  const patch: Record<string, unknown> = { creator_profile_id: creatorProfileId, updated_at: now };
  if (!cur || cur.monetization_status === "active") {
    patch.monetization_status = "under_review";
    patch.review_reason = `automatic: ${reason}`;
    patch.review_started_at = now;
  }
  const needsHold = !cur?.payout_hold_active;
  if (needsHold) { patch.payout_hold_active = true; patch.payout_hold_reason = reason; patch.payout_hold_set_at = now; }
  const { error } = await admin.from("creator_trust").upsert(patch, { onConflict: "creator_profile_id" });
  if (error) console.error(JSON.stringify({ at: "lib/trust/tip-webhook", event: "auto_hold_write_failed", code: error.code ?? null }));

  if (needsHold) {
    const { data: cp } = await admin.from("creator_profiles").select("stripe_account_id").eq("id", creatorProfileId).maybeSingle();
    const stripe = cp?.stripe_account_id ? await deps.getStripe() : null;
    if (stripe && cp?.stripe_account_id) {
      const r = await setStripePayoutHold(stripe, cp.stripe_account_id, true);
      await recordTrustEvent(admin, {
        creatorProfileId, kind: r.ok ? "payout_hold_applied" : "payout_hold_failed", actor: "system",
        detail: r.ok ? { interval: r.interval, trigger: reason } : { error: r.error, trigger: reason },
      });
    }
  }
}

export async function handleTrustEvent(event: any, deps: TrustWebhookDeps): Promise<TrustWebhookResult> {
  const now = deps.now ?? new Date();
  const obj = event?.data?.object ?? {};
  const type = String(event?.type ?? "");
  const meta = (obj.metadata ?? {}) as Record<string, any>;
  const { admin } = deps;

  // ── Tip checkout outcomes ────────────────────────────────────────────────
  if ((type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") && meta.type === "tip") {
    const existing = await findTip(admin, { tipId: meta.tip_id, sessionId: obj.id });
    const plan = planSessionPaid({ existing, session: obj, eventId: event.id, now });
    const res = await applyPlan(admin, existing, plan);
    if (res.error) return { handled: true, status: 500, note: `tip write failed: ${res.error}` };
    if (plan.kind === "noop") {
      if (plan.reason.startsWith("already_")) return { handled: true, status: 200, note: plan.reason };
      if (plan.reason.startsWith("payment_status_")) return { handled: true, status: 200, note: plan.reason };
      console.error(JSON.stringify({ at: "lib/trust/tip-webhook", event: "tip_unprocessable", reason: plan.reason, session: obj.id }));
      return { handled: true, status: 422, note: plan.reason };
    }
    if (res.changed && plan.notify) {
      const creatorProfileId = existing?.creator_profile_id ?? String(meta.creator_profile_id ?? "");
      const amount = existing?.amount ?? Number(meta.amount_usd ?? 0);
      await markAttemptCompleted(admin, obj.id ?? null, now);
      await enrichSucceededPayment(deps, { paymentIntentId: piId(obj.payment_intent), sessionId: obj.id ?? null, creatorProfileId });
      if (deps.onTipSucceeded && creatorProfileId) {
        await deps.onTipSucceeded({ id: res.id, creatorProfileId, amount, fanUserId: existing?.fan_user_id ?? (meta.fan_user_id || null) });
      }
    }
    return { handled: true, status: 200, note: res.changed ? "tip_updated" : "tip_unchanged" };
  }

  // Other checkout types (super tips, live tips) still record attempt completion for velocity review.
  if (type === "checkout.session.completed" && obj.payment_status === "paid") {
    await markAttemptCompleted(admin, obj.id ?? null, now);
    return { handled: false, status: 200 };
  }

  if (type === "checkout.session.async_payment_failed" && meta.type === "tip") {
    const existing = await findTip(admin, { tipId: meta.tip_id, sessionId: obj.id });
    const res = await applyPlan(admin, existing, planAsyncFailed(existing, event.id, now));
    return res.error ? { handled: true, status: 500, note: res.error } : { handled: true, status: 200 };
  }

  if (type === "checkout.session.expired" && meta.type === "tip") {
    const existing = await findTip(admin, { tipId: meta.tip_id, sessionId: obj.id });
    const res = await applyPlan(admin, existing, planExpired(existing, event.id, now));
    return res.error ? { handled: true, status: 500, note: res.error } : { handled: true, status: 200 };
  }

  // A declined card inside an open session. The session stays open and the fan
  // may retry, so this is a counter, not a terminal state. Many failures on one
  // session is what card testing looks like.
  if (type === "payment_intent.payment_failed" && meta.type === "tip" && meta.tip_id) {
    const { data } = await admin.from("tips").select("id, payment_failure_count").eq("id", meta.tip_id).maybeSingle();
    if (data) {
      await admin.from("tips").update({
        payment_failure_count: (data.payment_failure_count ?? 0) + 1,
        last_payment_failure_code: String(obj.last_payment_error?.decline_code ?? obj.last_payment_error?.code ?? "unknown").slice(0, 60),
      }).eq("id", data.id);
    }
    return { handled: true, status: 200 };
  }

  // ── Refunds (tips) ──────────────────────────────────────────────────────
  if (type === "charge.refunded") {
    const existing = await findTip(admin, { paymentIntentId: piId(obj.payment_intent) });
    if (!existing) return { handled: false, status: 200 };
    const res = await applyPlan(admin, existing, planRefund(existing, obj, event.id, now));
    if (res.error) return { handled: true, status: 500, note: res.error };
    if (res.changed) await recordTrustEvent(admin, { creatorProfileId: existing.creator_profile_id, kind: "refund", actor: "system", detail: { tip_id: existing.id, amount_refunded_cents: obj.amount_refunded ?? null } });
    return { handled: true, status: 200 };
  }

  // ── Disputes (any product; tips also update their row) ──────────────────
  if (type === "charge.dispute.created" || type === "charge.dispute.updated" || type === "charge.dispute.closed") {
    const pi = piId(obj.payment_intent);
    const existing = await findTip(admin, { paymentIntentId: pi });
    if (existing) {
      const res = await applyPlan(admin, existing, planDispute(existing, obj, type, event.id, now));
      if (res.error) return { handled: true, status: 500, note: res.error };
    }
    if (type === "charge.dispute.created") {
      const creatorProfileId = existing?.creator_profile_id ?? (await creatorForCharge(deps, { paymentIntentId: pi, chargeId: typeof obj.charge === "string" ? obj.charge : null }));
      if (creatorProfileId) {
        await autoHold(deps, creatorProfileId, "chargeback_or_dispute", { dispute: obj.id ?? null, payment_intent: pi, amount: obj.amount ?? null, reason: obj.reason ?? null });
      }
    } else if (type === "charge.dispute.closed" && existing) {
      await recordTrustEvent(admin, { creatorProfileId: existing.creator_profile_id, kind: "dispute_closed", actor: "system", detail: { dispute: obj.id ?? null, status: obj.status ?? null } });
    }
    return { handled: true, status: 200 };
  }

  // ── Radar early fraud warning ───────────────────────────────────────────
  if (type === "radar.early_fraud_warning.created") {
    const pi = piId(obj.payment_intent);
    const existing = await findTip(admin, { paymentIntentId: pi });
    if (existing) {
      await admin.from("tips").update({ early_fraud_warning_at: now.toISOString() }).eq("id", existing.id);
    }
    const creatorProfileId = existing?.creator_profile_id ?? (await creatorForCharge(deps, { paymentIntentId: pi, chargeId: typeof obj.charge === "string" ? obj.charge : null }));
    if (creatorProfileId) {
      await autoHold(deps, creatorProfileId, "early_fraud_warning", { warning: obj.id ?? null, fraud_type: obj.fraud_type ?? null, payment_intent: pi });
    }
    return { handled: true, status: 200 };
  }

  // ── Connect account status ──────────────────────────────────────────────
  if (type === "account.updated") {
    const acct = obj;
    if (!acct?.id) return { handled: false, status: 200 };
    const { data: cp, error } = await admin.from("creator_profiles").select("id, stripe_onboarded").eq("stripe_account_id", acct.id).maybeSingle();
    if (error) return { handled: true, status: 500, note: `creator lookup failed: ${error.code ?? ""}` };
    if (!cp) return { handled: false, status: 200 };

    const status = normalizeStripeAccount(acct);
    const { data: prior } = await admin.from("creator_trust").select("stripe_disabled_reason, stripe_onboarded_at").eq("creator_profile_id", cp.id).maybeSingle();
    const patch: Record<string, unknown> = {
      creator_profile_id: cp.id, ...status,
      stripe_status_updated_at: now.toISOString(), updated_at: now.toISOString(),
    };
    // Only a real transition from not onboarded to onboarded dates onboarding.
    // A legacy creator who was already onboarded keeps a null date rather than
    // being dropped back into a risk period by today's timestamp.
    if (cp.stripe_onboarded !== true && acct.details_submitted && acct.charges_enabled && !prior?.stripe_onboarded_at) {
      patch.stripe_onboarded_at = now.toISOString();
    }
    const up = await admin.from("creator_trust").upsert(patch, { onConflict: "creator_profile_id" });
    if (up.error) return { handled: true, status: 500, note: `creator_trust upsert failed: ${up.error.code ?? ""}` };

    const before = prior?.stripe_disabled_reason ?? null;
    if (status.stripe_disabled_reason && status.stripe_disabled_reason !== before) {
      const cls = classifyStripeAccount(status);
      await recordTrustEvent(admin, {
        creatorProfileId: cp.id, kind: cls === "rejected" ? "stripe_rejected" : "stripe_restricted", actor: "system",
        detail: { disabled_reason: status.stripe_disabled_reason, past_due: status.stripe_requirements_past_due.slice(0, 20) },
      });
    }
    // Not handled: the route keeps its existing stripe_onboarded update.
    return { handled: false, status: 200 };
  }

  if (type === "account.application.deauthorized") {
    const accountId = event.account ? String(event.account) : null;
    if (!accountId) return { handled: false, status: 200 };
    const { data: cp } = await admin.from("creator_profiles").select("id").eq("stripe_account_id", accountId).maybeSingle();
    if (cp) {
      await admin.from("creator_trust").upsert({
        creator_profile_id: cp.id, stripe_charges_enabled: false, stripe_payouts_enabled: false,
        stripe_disabled_reason: "platform_deauthorized", stripe_status_updated_at: now.toISOString(), updated_at: now.toISOString(),
      }, { onConflict: "creator_profile_id" });
      await recordTrustEvent(admin, { creatorProfileId: cp.id, kind: "stripe_deauthorized", actor: "system", detail: { account: accountId } });
    }
    return { handled: true, status: 200 };
  }

  return { handled: false, status: 200 };
}
