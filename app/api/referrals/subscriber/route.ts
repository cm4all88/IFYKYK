import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { writeOrLog } from "@/lib/db";

export async function POST(req: NextRequest) {
// Service role. Both referral routes fire during signup, before the new user is
// authenticated, and they write rows that belong to the *referrer*, not the
// caller. Under the anon client every write was denied by RLS and rolled back,
// while the route returned { ok: true } regardless. Referral credits have been
// silently vanishing.
  const supabase = await createServiceClient();
  const { referrerHandle, fanUserId, fanEmail, subscribed } = await req.json();

  if (!referrerHandle) return NextResponse.json({ ok: true });

  // Find referrer
  const { data: referrer } = await (supabase as any)
    .from("creator_profiles")
    .select("id")
    .eq("handle", referrerHandle)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (!referrer) return NextResponse.json({ ok: true });

  if (subscribed) {
    // Update existing record to mark subscribed
    const { data: existing } = await (supabase as any)
      .from("subscriber_referrals")
      .select("id")
      .eq("referrer_profile_id", referrer.id)
      .eq("fan_user_id", fanUserId)
      .maybeSingle();

    if (existing) {
      await writeOrLog("referrals/subscriber update subscriber_referrals", (supabase as any)
        .from("subscriber_referrals")
        .update({ subscribed: true, subscribed_at: new Date().toISOString() })
        .eq("id", existing.id));
    }
  } else {
    // New fan visit — record it
    const { error: subRefErr } = await (supabase as any).from("subscriber_referrals").insert({
      referrer_profile_id: referrer.id,
      fan_user_id: fanUserId ?? null,
      fan_email: fanEmail ?? null,
      subscribed: false,
    });
    if (subRefErr) {
      console.error("Subscriber referral insert failed:", subRefErr);
      return NextResponse.json({ ok: false, error: "Could not record referral" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
