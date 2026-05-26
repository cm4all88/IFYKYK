import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const profileId = profile.id;

  // Last 30 days subscriber growth (daily counts)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [{ data: subs }, { data: tips }, { data: posts }] = await Promise.all([
    (supabase as any)
      .from("subscriptions")
      .select("created_at, status")
      .eq("creator_profile_id", profileId)
      .gte("created_at", thirtyDaysAgo),
    (supabase as any)
      .from("tips")
      .select("amount_usd, created_at")
      .eq("creator_profile_id", profileId)
      .gte("created_at", thirtyDaysAgo),
    (supabase as any)
      .from("posts")
      .select("created_at, status")
      .eq("creator_profile_id", profileId)
      .gte("created_at", thirtyDaysAgo),
  ]);

  // Build daily buckets for last 30 days
  const days: Record<string, { subs: number; tips: number; posts: number; revenue: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days[key] = { subs: 0, tips: 0, posts: 0, revenue: 0 };
  }

  (subs ?? []).forEach((s: any) => {
    const key = s.created_at?.slice(0, 10);
    if (days[key]) days[key].subs += 1;
  });

  (tips ?? []).forEach((t: any) => {
    const key = t.created_at?.slice(0, 10);
    if (days[key]) {
      days[key].tips += 1;
      days[key].revenue += Number(t.amount_usd ?? 0);
    }
  });

  (posts ?? []).forEach((p: any) => {
    const key = p.created_at?.slice(0, 10);
    if (days[key]) days[key].posts += 1;
  });

  const chart = Object.entries(days).map(([date, data]) => ({ date, ...data }));

  // Totals
  const totalSubs = (await (supabase as any)
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("creator_profile_id", profileId)
    .eq("status", "active")).count ?? 0;

  const totalRevenue = (tips ?? []).reduce((s: number, t: any) => s + Number(t.amount_usd ?? 0), 0);

  return NextResponse.json({ chart, totalSubs, totalRevenue });
}
