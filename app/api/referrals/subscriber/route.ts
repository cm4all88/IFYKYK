import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Records a subscriber referral (creator shared link → a fan landed/subscribed).
// Analytics only — no money moves here — but we still bind the record to the
// authenticated caller so the fan id can't be forged, and dedupe per fan so a
// single visitor can't inflate a creator's referral count by refreshing.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { referrerHandle, fanEmail, subscribed } = await req.json();
  if (!referrerHandle) return NextResponse.json({ ok: true });

  // Only logged-in fans produce a tracked record. Anonymous visits are ignored
  // rather than written under a forgeable/empty id.
  const fanUserId = user?.id ?? null;
  if (!fanUserId) return NextResponse.json({ ok: true });

  // Find referrer
  const { data: referrer } = await (supabase as any)
    .from("creator_profiles")
    .select("id, user_id")
    .eq("handle", referrerHandle)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (!referrer) return NextResponse.json({ ok: true });

  // A creator can't refer themselves.
  if (referrer.user_id === fanUserId) return NextResponse.json({ ok: true });

  const { data: existing } = await (supabase as any)
    .from("subscriber_referrals")
    .select("id")
    .eq("referrer_profile_id", referrer.id)
    .eq("fan_user_id", fanUserId)
    .maybeSingle();

  if (subscribed) {
    // Mark an existing referral converted (only if we already have the visit).
    if (existing) {
      await (supabase as any)
        .from("subscriber_referrals")
        .update({ subscribed: true, subscribed_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
  } else if (!existing) {
    // First visit by this fan via this creator's link — record it once.
    await (supabase as any).from("subscriber_referrals").insert({
      referrer_profile_id: referrer.id,
      fan_user_id: fanUserId,
      fan_email: fanEmail ?? user?.email ?? null,
      subscribed: false,
    });
  }

  return NextResponse.json({ ok: true });
}
