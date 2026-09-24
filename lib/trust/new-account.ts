// Payout hold for NEW Connect accounts.
//
// A brand new Express account is created with payouts on "manual", so the first
// money it receives cannot leave Stripe until Spotlightly releases it (the
// payout release cron after the hold period, or an admin). This is the
// guarantee that lets a new creator accept tips during the risk period at all;
// see evaluateTipEligibility. Existing accounts are never touched here.

import { loadTrustConfig } from "@/lib/trust/config";
import { createServiceClient } from "@/lib/supabase-server";

/** Extra params to merge into stripe.accounts.create for a new creator account. */
export async function newAccountPayoutSettings(): Promise<{ settings?: { payouts: { schedule: { interval: "manual" } } } }> {
  const config = await loadTrustConfig();
  return config.holdPayoutsForNewAccounts
    ? { settings: { payouts: { schedule: { interval: "manual" } } } }
    : {};
}

/** Record the hold Spotlightly just placed. Best effort; the Stripe schedule is the real control. */
export async function recordNewAccountHold(creatorProfileId: string, interval: string | null | undefined) {
  if (interval !== "manual") return;
  try {
    const admin = await createServiceClient();
    const now = new Date().toISOString();
    const { error } = await (admin as any).from("creator_trust").upsert({
      creator_profile_id: creatorProfileId,
      payout_hold_active: true,
      payout_hold_reason: "new_account",
      payout_hold_set_at: now,
      stripe_payout_interval: "manual",
      updated_at: now,
    }, { onConflict: "creator_profile_id" });
    if (error) console.error(JSON.stringify({ at: "lib/trust/new-account", event: "hold_record_failed", code: error.code ?? null }));
  } catch {
    // logged above when possible; never block onboarding
  }
}
