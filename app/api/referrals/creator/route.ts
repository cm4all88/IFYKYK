import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const REFERRALS_PER_CREDIT = 5;
const CREDIT_AMOUNT_USD = 29.00; // Starter tier price — lowest tier, fair for all

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { referrerHandle, referredUserId, referredHandle } = await req.json();

  if (!referrerHandle) return NextResponse.json({ ok: true });

  // Find referrer profile
  const { data: referrer } = await (supabase as any)
    .from("creator_profiles")
    .select("id, display_name")
    .eq("handle", referrerHandle)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (!referrer) return NextResponse.json({ ok: true });

  // Don't let someone refer themselves
  if (referredUserId) {
    const { data: referredProfile } = await (supabase as any)
      .from("creator_profiles")
      .select("user_id")
      .eq("id", referrer.id)
      .maybeSingle();
    if (referredProfile?.user_id === referredUserId) {
      return NextResponse.json({ ok: true });
    }
  }

  // Record the referral
  await (supabase as any).from("creator_referrals").insert({
    referrer_profile_id: referrer.id,
    referred_user_id: referredUserId ?? null,
    referred_handle: referredHandle ?? null,
    credited: false,
  });

  // Count uncredited referrals
  const { count } = await (supabase as any)
    .from("creator_referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_profile_id", referrer.id)
    .eq("credited", false);

  // Every 5 referrals → $29 credit (Starter tier price)
  if (count && count >= REFERRALS_PER_CREDIT) {
    const creditsToIssue = Math.floor(count / REFERRALS_PER_CREDIT);
    const referralsToMark = creditsToIssue * REFERRALS_PER_CREDIT;

    // Mark referrals as credited
    const { data: toCredit } = await (supabase as any)
      .from("creator_referrals")
      .select("id")
      .eq("referrer_profile_id", referrer.id)
      .eq("credited", false)
      .limit(referralsToMark);

    if (toCredit?.length) {
      await (supabase as any)
        .from("creator_referrals")
        .update({ credited: true })
        .in("id", toCredit.map((r: any) => r.id));
    }

    // Issue $29 credits
    const credits = Array.from({ length: creditsToIssue }, () => ({
      creator_profile_id: referrer.id,
      amount_usd: CREDIT_AMOUNT_USD,
      reason: `${REFERRALS_PER_CREDIT} creator referrals — $${CREDIT_AMOUNT_USD} off next bill`,
      applied: false,
    }));

    await (supabase as any).from("billing_credits").insert(credits);
  }

  return NextResponse.json({ ok: true });
}
