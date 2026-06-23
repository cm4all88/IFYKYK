import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const s = (v: any) => String(v ?? "").trim();

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { creatorProfileId, bio, freeTier, tiers, includeCampaign, campaign } = body ?? {};
  if (!creatorProfileId) return NextResponse.json({ error: "Missing creator" }, { status: 400 });

  const admin = await createServiceClient();

  // 1) profile: bio + free tier (resilient if free tier columns are absent)
  const profilePayload: any = {
    bio: s(bio) || null,
    free_tier_name: s(freeTier?.name) || null,
    free_tier_blurb: s(freeTier?.blurb) || null,
    free_tier_perks: Array.isArray(freeTier?.perks) ? freeTier.perks.map((p: any) => s(p)).filter(Boolean) : [],
  };
  const { error: pe } = await (admin as any).from("creator_profiles").update(profilePayload).eq("id", creatorProfileId);
  if (pe) { await (admin as any).from("creator_profiles").update({ bio: profilePayload.bio }).eq("id", creatorProfileId); }

  // 2) subscription tiers (appended after any existing)
  const { count } = await (admin as any).from("subscription_tiers").select("id", { count: "exact", head: true }).eq("creator_profile_id", creatorProfileId);
  const tierRows = (Array.isArray(tiers) ? tiers : [])
    .filter((t: any) => s(t?.name) && Number(t?.price_monthly) > 0)
    .map((t: any, idx: number) => ({
      creator_profile_id: creatorProfileId,
      name: s(t.name),
      description: s(t.description) || null,
      price_monthly: Number(t.price_monthly),
      price_yearly: t.price_yearly != null && Number(t.price_yearly) > 0 ? Number(t.price_yearly) : null,
      perks: Array.isArray(t.perks) ? t.perks.map((p: any) => s(p)).filter(Boolean) : [],
      color: "#F0B429",
      sort_order: (count ?? 0) + idx,
    }));
  if (tierRows.length) {
    const { error: te } = await (admin as any).from("subscription_tiers").insert(tierRows);
    if (te) return NextResponse.json({ error: "Tiers: " + te.message }, { status: 200 });
  }

  // 3) starter campaign (optional) + its backing tiers
  let campaignId: string | null = null;
  if (includeCampaign && s(campaign?.title) && Number(campaign?.goal) > 0) {
    const { data: camp, error: ce } = await (admin as any).from("campaigns").insert({
      creator_profile_id: creatorProfileId,
      title: s(campaign.title),
      description: s(campaign.description) || null,
      goal_amount: Number(campaign.goal),
      category: campaign.category ?? null,
      status: "active",
    }).select().single();
    if (ce) return NextResponse.json({ error: "Campaign: " + ce.message }, { status: 200 });
    campaignId = camp?.id ?? null;
    if (camp) {
      const rows = (Array.isArray(campaign.tiers) ? campaign.tiers : [])
        .filter((t: any) => s(t?.title) && Number(t?.amount) > 0)
        .map((t: any, idx: number) => ({ campaign_id: camp.id, title: s(t.title), amount: Number(t.amount), description: s(t.description) || null, rewards: Array.isArray(t.rewards) ? t.rewards.filter((r: any) => s(r?.label)) : [], sort_order: idx }));
      if (rows.length) await (admin as any).from("campaign_tiers").insert(rows);
    }
  }

  return NextResponse.json({ ok: true, tiersCreated: tierRows.length, campaignId });
}
