import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const REFERRALS_PER_CREDIT = 5;
const CREDIT_AMOUNT_USD = 29.00;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, handle")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [
    { count: totalCreatorReferrals },
    { count: pendingCreatorReferrals },
    { count: totalSubReferrals },
    { count: convertedSubReferrals },
    { data: pendingCredits },
    { data: appliedCredits },
  ] = await Promise.all([
    (supabase as any).from("creator_referrals").select("*", { count: "exact", head: true }).eq("referrer_profile_id", profile.id),
    (supabase as any).from("creator_referrals").select("*", { count: "exact", head: true }).eq("referrer_profile_id", profile.id).eq("credited", false),
    (supabase as any).from("subscriber_referrals").select("*", { count: "exact", head: true }).eq("referrer_profile_id", profile.id),
    (supabase as any).from("subscriber_referrals").select("*", { count: "exact", head: true }).eq("referrer_profile_id", profile.id).eq("subscribed", true),
    (supabase as any).from("billing_credits").select("amount_usd").eq("creator_profile_id", profile.id).eq("applied", false),
    (supabase as any).from("billing_credits").select("amount_usd").eq("creator_profile_id", profile.id).eq("applied", true),
  ]);

  const uncreditedCount = pendingCreatorReferrals ?? 0;
  const progressToNextCredit = uncreditedCount % REFERRALS_PER_CREDIT;
  const pendingUsd = (pendingCredits ?? []).reduce((sum: number, c: any) => sum + Number(c.amount_usd), 0);
  const appliedUsd = (appliedCredits ?? []).reduce((sum: number, c: any) => sum + Number(c.amount_usd), 0);

  return NextResponse.json({
    handle: profile.handle,
    creditAmountUsd: CREDIT_AMOUNT_USD,
    referralsPerCredit: REFERRALS_PER_CREDIT,
    creatorReferrals: {
      total: totalCreatorReferrals ?? 0,
      progressToNextCredit,
      needed: REFERRALS_PER_CREDIT,
      percentage: Math.round((progressToNextCredit / REFERRALS_PER_CREDIT) * 100),
    },
    subscriberReferrals: {
      total: totalSubReferrals ?? 0,
      converted: convertedSubReferrals ?? 0,
      conversionRate: totalSubReferrals
        ? Math.round(((convertedSubReferrals ?? 0) / totalSubReferrals) * 100)
        : 0,
    },
    credits: {
      pendingUsd,
      appliedUsd,
      totalUsd: pendingUsd + appliedUsd,
    },
    links: {
      creator: `https://spotlightly.app/signup?ref=${profile.handle}`,
      subscriber: `https://spotlightly.app/${profile.handle}?ref=${profile.handle}`,
    },
  });
}
