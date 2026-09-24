import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { loadTrustConfig } from "@/lib/trust/config";
import { loadTrustOverview } from "@/lib/trust/admin-data";
import { canAutoReleasePayoutHold, setStripePayoutHold } from "@/lib/trust/payouts";
import { riskPeriodStart } from "@/lib/trust/eligibility";
import { recordTrustEvent } from "@/lib/trust/audit";
import { getStripeClient } from "@/lib/trust/stripe-client";

// Daily. Releases NEW ACCOUNT payout holds once the hold period has passed and
// no review flag is present. Holds placed for a dispute, a fraud warning, a
// review, a block or by an admin are never released here.
//
// ?dry=1 reports what would be released without calling Stripe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const admin = await createServiceClient();
  const config = await loadTrustConfig();
  const now = new Date();

  const { data: held, error } = await (admin as any).from("creator_trust")
    .select("creator_profile_id, payout_hold_active, payout_hold_reason, monetization_status, stripe_onboarded_at")
    .eq("payout_hold_active", true).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!held?.length) return NextResponse.json({ released: 0, checked: 0 });

  const summaries = await loadTrustOverview(admin, config, now, { creatorIds: held.map((h: any) => h.creator_profile_id) });
  const byId = new Map(summaries.map((s) => [s.id, s]));
  const stripe = dry ? null : await getStripeClient();

  const results: any[] = [];
  for (const h of held) {
    const s = byId.get(h.creator_profile_id);
    if (!s) continue;
    const decision = canAutoReleasePayoutHold({
      payoutHoldActive: true,
      payoutHoldReason: h.payout_hold_reason,
      monetizationStatus: h.monetization_status,
      riskPeriodStart: riskPeriodStart({ created_at: s.created_at }, { stripe_onboarded_at: h.stripe_onboarded_at }),
      publishedPostCount: s.post_count,
      flags: s.flags,
      now,
    }, config);
    if (!decision.release) { results.push({ id: s.id, release: false, reason: decision.reason }); continue; }
    if (dry || !stripe || !s.stripe_account_id) { results.push({ id: s.id, release: "dry_run" }); continue; }

    const r = await setStripePayoutHold(stripe, s.stripe_account_id, false);
    if (!r.ok) {
      await recordTrustEvent(admin, { creatorProfileId: s.id, kind: "payout_release_failed", actor: "system", detail: { error: r.error } });
      results.push({ id: s.id, release: false, reason: "stripe_error" });
      continue;
    }
    await (admin as any).from("creator_trust").update({
      payout_hold_active: false, payout_hold_reason: null, payout_released_at: now.toISOString(),
      stripe_payout_interval: r.interval, updated_at: now.toISOString(),
    }).eq("creator_profile_id", s.id);
    await recordTrustEvent(admin, { creatorProfileId: s.id, kind: "release_payouts", actor: "system", reason: "new account hold period complete, no review flags", detail: { interval: r.interval } });
    results.push({ id: s.id, release: true });
  }

  return NextResponse.json({ checked: held.length, released: results.filter((r) => r.release === true).length, dry, results });
}
