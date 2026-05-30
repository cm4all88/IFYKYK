import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = user.id;

  // Run all queries in parallel
  const [subsRes, tipsRes, superTipsRes, digitalRes, unlockRes, profileRes] = await Promise.all([
    // Subscriptions with creator info
    (supabase as any)
      .from("subscriptions")
      .select("id, status, price, tier, current_period_end, created_at, canceled_at, creator:creator_profiles!creator_id(id, handle, display_name, avatar_url)")
      .eq("fan_user_id", uid)
      .order("created_at", { ascending: false }),

    // Tips sent
    (supabase as any)
      .from("tips")
      .select("id, amount, message, created_at, creator:creator_profiles!creator_profile_id(handle, display_name, avatar_url)")
      .eq("fan_user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50),

    // Super tips sent
    (supabase as any)
      .from("super_tips")
      .select("id, amount, message, created_at, creator:creator_profiles!creator_profile_id(handle, display_name, avatar_url)")
      .eq("fan_user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50),

    // Digital purchases
    (supabase as any)
      .from("digital_purchases")
      .select("id, amount_paid, created_at, product:digital_products(title, creator:creator_profiles!creator_profile_id(handle, display_name))")
      .eq("fan_user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50),

    // Post unlocks
    (supabase as any)
      .from("post_unlocks")
      .select("id, amount_paid, created_at, post:posts(title, caption, creator:creator_profiles!creator_profile_id(handle, display_name))")
      .eq("fan_user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50),

    // Creator profile (if they have one)
    (supabase as any)
      .from("creator_profiles")
      .select("id, handle, display_name, avatar_url, kind")
      .eq("user_id", uid)
      .eq("kind", "spotlight")
      .maybeSingle(),
  ]);

  // Combine tips + super tips into one list
  const allTips = [
    ...(tipsRes.data ?? []).map((t: any) => ({ ...t, type: "tip" })),
    ...(superTipsRes.data ?? []).map((t: any) => ({ ...t, type: "super_tip" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const allPurchases = [
    ...(digitalRes.data ?? []).map((p: any) => ({ ...p, type: "digital" })),
    ...(unlockRes.data ?? []).map((p: any) => ({ ...p, type: "unlock" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({
    subscriptions: subsRes.data ?? [],
    tips: allTips,
    purchases: allPurchases,
    creatorProfile: profileRes.data ?? null,
    totalTipped: allTips.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0),
    totalSpent: [
      ...allTips,
      ...allPurchases,
    ].reduce((sum: number, item: any) => sum + (parseFloat(item.amount || item.amount_paid) || 0), 0),
  });
}
