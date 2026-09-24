// Applies an admin trust action: state change, Stripe payout schedule (when the
// plan asks for one), and an audit row. Caller MUST have checked isAdmin().

import { planAdminAction, type AdminTrustAction, type TrustState } from "@/lib/trust/admin-actions";
import { recordTrustEvent } from "@/lib/trust/audit";
import { setStripePayoutHold } from "@/lib/trust/payouts";

export async function executeAdminTrustAction(args: {
  admin: any;
  getStripe: () => Promise<any | null>;
  creatorProfileId: string;
  action: AdminTrustAction;
  reason: string;
  adminEmail: string;
  now?: Date;
}): Promise<{ ok: true; note?: string } | { ok: false; error: string }> {
  const now = args.now ?? new Date();
  const { admin } = args;

  const { data: cp } = await admin.from("creator_profiles").select("id, stripe_account_id").eq("id", args.creatorProfileId).maybeSingle();
  if (!cp) return { ok: false, error: "Creator not found." };

  const { data: cur } = await admin.from("creator_trust")
    .select("tips_disabled, monetization_status, payout_hold_active, payout_hold_reason, review_reason")
    .eq("creator_profile_id", cp.id).maybeSingle();

  const plan = planAdminAction((cur as TrustState) ?? null, args.action, args.reason, now);
  if (!plan.ok) return plan;

  // Stripe first for a RELEASE (do not mark released unless Stripe agreed), and
  // state first for a HOLD (Spotlightly's own gate engages even if Stripe fails).
  let note: string | undefined;
  if (plan.stripePayouts === "release") {
    if (!cp.stripe_account_id) return { ok: false, error: "No Stripe account to release." };
    const stripe = await args.getStripe();
    if (!stripe) return { ok: false, error: "Stripe is not configured." };
    const r = await setStripePayoutHold(stripe, cp.stripe_account_id, false);
    if (!r.ok) return { ok: false, error: `Stripe refused the release: ${r.error}` };
    plan.patch.stripe_payout_interval = r.interval;
  }

  const { error } = await admin.from("creator_trust").upsert({ creator_profile_id: cp.id, ...plan.patch }, { onConflict: "creator_profile_id" });
  if (error) return { ok: false, error: `Could not save: ${error.message}` };

  if (plan.stripePayouts === "hold" && cp.stripe_account_id) {
    const stripe = await args.getStripe();
    const r = stripe ? await setStripePayoutHold(stripe, cp.stripe_account_id, true) : { ok: false as const, error: "Stripe not configured" };
    if (r.ok) {
      await admin.from("creator_trust").update({ stripe_payout_interval: r.interval }).eq("creator_profile_id", cp.id);
    } else {
      note = `Saved, but Stripe did not apply the payout hold: ${r.error}. Hold it in the Stripe dashboard.`;
      await recordTrustEvent(admin, { creatorProfileId: cp.id, kind: "payout_hold_failed", actor: `admin:${args.adminEmail}`, detail: { error: r.error } });
    }
  }

  await recordTrustEvent(admin, {
    creatorProfileId: cp.id,
    kind: args.action,
    actor: `admin:${args.adminEmail}`,
    reason: plan.audit.reason,
    detail: { before: plan.audit.before, after: plan.audit.after, stripe: plan.stripePayouts },
  });
  return { ok: true, note };
}
