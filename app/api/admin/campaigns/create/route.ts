import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const s = (v: any) => String(v ?? "").trim();

// Create a single campaign (and its backing tiers) for a creator, on their
// behalf. Standalone, so it never touches their bio or subscription tiers.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { creatorProfileId, title, description, goal, category, tiers } = body ?? {};
  if (!creatorProfileId) return NextResponse.json({ error: "Missing creator" }, { status: 400 });
  if (!s(title) || !(Number(goal) > 0)) return NextResponse.json({ error: "A campaign needs a title and a goal." }, { status: 200 });

  const admin = await createServiceClient();

  const { data: camp, error: ce } = await (admin as any).from("campaigns").insert({
    creator_profile_id: creatorProfileId,
    title: s(title),
    description: s(description) || null,
    goal_amount: Number(goal),
    category: s(category) || null,
    status: "active",
  }).select().single();
  if (ce) return NextResponse.json({ error: "Campaign: " + ce.message }, { status: 200 });

  const rows = (Array.isArray(tiers) ? tiers : [])
    .filter((t: any) => s(t?.title) && Number(t?.amount) > 0)
    .map((t: any, idx: number) => ({
      campaign_id: camp.id,
      title: s(t.title),
      amount: Number(t.amount),
      description: s(t.description) || null,
      rewards: Array.isArray(t.rewards) ? t.rewards.filter((r: any) => s(r?.label)).map((r: any) => ({ type: s(r.type) || "content", label: s(r.label) })) : [],
      sort_order: idx,
    }));
  if (rows.length) {
    const { error: te } = await (admin as any).from("campaign_tiers").insert(rows);
    if (te) return NextResponse.json({ ok: true, campaignId: camp.id, warning: "Campaign created, but tiers failed: " + te.message });
  }

  return NextResponse.json({ ok: true, campaignId: camp.id });
}
