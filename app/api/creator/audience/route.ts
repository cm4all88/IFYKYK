import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * A creator's audience: everyone who has actually given them money or joined.
 *
 * This has to be a server route. Fan identity lives in auth.users and there is no
 * public mirror of it, so the dashboard's `select("*, fan:fan_user_id(email))"`
 * was asking PostgREST to embed the auth schema from a browser client. That is
 * not permitted, the query errored, the error was discarded, and the subscriber
 * list rendered permanently empty. A creator with paying supporters saw nothing.
 *
 * Auth is checked against the caller's own session; only the identity lookup uses
 * the service role, and only for people who are already this creator's audience.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profiles } = await (supabase as any)
    .from("creator_profiles").select("id").eq("user_id", user.id);
  const profileIds = (profiles ?? []).map((p: any) => p.id);
  if (profileIds.length === 0) return NextResponse.json({ members: [] });

  const admin = await createServiceClient();

  const [{ data: subs }, { data: campaigns }] = await Promise.all([
    (admin as any)
      .from("subscriptions")
      .select("id, fan_user_id, status, tier, price, created_at, current_period_end")
      .in("creator_profile_id", profileIds)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    (admin as any).from("campaigns").select("id").in("creator_profile_id", profileIds),
  ]);

  const campaignIds = (campaigns ?? []).map((c: any) => c.id);
  let donations: any[] = [];
  if (campaignIds.length) {
    const { data } = await (admin as any)
      .from("campaign_donations")
      .select("donor_user_id, amount, created_at")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false });
    donations = data ?? [];
  }

  // One entry per person, not per transaction. Someone who subscribed and also
  // backed the campaign is one supporter, and their total is what matters.
  type Member = {
    userId: string;
    email: string | null;
    name: string | null;
    subscribed: boolean;
    tier: string | null;
    monthly: number;
    backed: number;
    backCount: number;
    since: string;
  };
  const byUser = new Map<string, Member>();

  const touch = (userId: string, since: string): Member => {
    let m = byUser.get(userId);
    if (!m) {
      m = { userId, email: null, name: null, subscribed: false, tier: null, monthly: 0, backed: 0, backCount: 0, since };
      byUser.set(userId, m);
    }
    if (since < m.since) m.since = since;
    return m;
  };

  for (const s of subs ?? []) {
    if (!s.fan_user_id) continue;
    const m = touch(s.fan_user_id, s.created_at);
    m.subscribed = true;
    m.tier = s.tier ?? null;
    m.monthly += Number(s.price ?? 0);
  }

  for (const d of donations) {
    if (!d.donor_user_id) continue;
    const m = touch(d.donor_user_id, d.created_at);
    m.backed += Number(d.amount ?? 0);
    m.backCount += 1;
  }

  // Resolve identities. One lookup per person, and a failure on any single one
  // must not empty the whole list.
  await Promise.all(
    Array.from(byUser.values()).map(async (m) => {
      try {
        const { data } = await (admin as any).auth.admin.getUserById(m.userId);
        m.email = data?.user?.email ?? null;
        m.name =
          data?.user?.user_metadata?.display_name ??
          data?.user?.user_metadata?.full_name ??
          data?.user?.user_metadata?.name ??
          null;
      } catch {
        /* leave unresolved rather than dropping the supporter */
      }
    })
  );

  const members = Array.from(byUser.values()).sort(
    (a, b) => b.monthly + b.backed - (a.monthly + a.backed)
  );

  return NextResponse.json({
    members,
    totals: {
      people: members.length,
      subscribers: members.filter((m) => m.subscribed).length,
      backers: members.filter((m) => m.backCount > 0).length,
      monthly: members.reduce((s, m) => s + m.monthly, 0),
    },
  });
}
