import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeOrLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to redeem" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Missing redemption code" }, { status: 400 });

  const { data: gift } = await (supabase as any)
    .from("gift_subscriptions")
    .select("*, creator:creator_profile_id(handle, subscription_price)")
    .eq("redemption_code", code.trim().toLowerCase())
    .maybeSingle();

  if (!gift) return NextResponse.json({ error: "Code not found" }, { status: 404 });
  if (gift.redeemed_at) return NextResponse.json({ error: "This code has already been redeemed" }, { status: 409 });

  // Activate subscription for this user
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + gift.months);

  await writeOrLog("gift-subscription/redeem upsert subscriptions", (supabase as any).from("subscriptions").upsert({
    fan_user_id: user.id,
    creator_profile_id: gift.creator_profile_id,
    status: "active",
    tier: "premium",
    gift_subscription_id: gift.id,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "fan_user_id,creator_profile_id" }));

  // Mark gift as redeemed
  await writeOrLog("gift-subscription/redeem update gift_subscriptions", (supabase as any)
    .from("gift_subscriptions")
    .update({ redeemed_at: new Date().toISOString(), recipient_user_id: user.id })
    .eq("id", gift.id));

  return NextResponse.json({
    ok: true,
    creatorHandle: gift.creator?.handle,
    months: gift.months,
  });
}
