import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
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
      await (supabase as any)
        .from("subscriber_referrals")
        .update({ subscribed: true, subscribed_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
  } else {
    // New fan visit — record it
    await (supabase as any).from("subscriber_referrals").insert({
      referrer_profile_id: referrer.id,
      fan_user_id: fanUserId ?? null,
      fan_email: fanEmail ?? null,
      subscribed: false,
    });
  }

  return NextResponse.json({ ok: true });
}
