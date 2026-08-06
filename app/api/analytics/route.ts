import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { entitlementsFor } from "@/lib/entitlements";
import { creatorEarnings } from "@/lib/earnings";

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

  // Analytics window is gated by plan: Opening Act = 7 days, Starter+ = 30.
  // lib/entitlements.ts is the source of truth. Enforced server-side so the cap
  // cannot be exceeded by passing a larger ?days= value.
  const { data: billing } = await (supabase as any)
    .from("creator_billing").select("status, tier").eq("user_id", user.id).maybeSingle();
  const maxDays = entitlementsFor(billing).analyticsMaxDays;
  const requested = Number(new URL(req.url).searchParams.get("days")) || 30;
  const windowDays = Math.min([7, 30, 90].includes(requested) ? requested : 30, maxDays);

  const windowStart = new Date(Date.now() - windowDays * 86400000).toISOString();

  const [{ data: subs }, { data: tips }, { data: posts }] = await Promise.all([
    (supabase as any)
      .from("subscriptions")
      .select("created_at, status")
      .eq("creator_profile_id", profileId)
      .gte("created_at", windowStart),
    (supabase as any)
      .from("tips")
      .select("amount, platform_receives, created_at")
      .eq("creator_profile_id", profileId)
      .gte("created_at", windowStart),
    (supabase as any)
      .from("posts")
      .select("created_at, status")
      .eq("creator_profile_id", profileId)
      .gte("created_at", windowStart),
  ]);

  // Build daily buckets for the gated window
  const days: Record<string, { subs: number; tips: number; posts: number; revenue: number }> = {};
  for (let i = windowDays - 1; i >= 0; i--) {
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
      days[key].revenue += Number(t.amount ?? 0) - Number(t.platform_receives ?? 0);
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

  // Revenue across every source, creator net, for the same window. Tips alone
  // were never the whole picture and the tips query was broken besides.
  const earnings = await creatorEarnings(supabase, profileId, { since: windowStart });

  return NextResponse.json({
    chart,
    totalSubs,
    totalRevenue: earnings.net,
    totalGross: earnings.gross,
    bySource: earnings.bySource.filter((r) => r.count > 0 || r.failed),
    earningsIncomplete: earnings.failures.length > 0,
    days: windowDays,
    maxDays,
  });
}
