import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const money = (v: unknown): string => {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return "$0";
  const s = Number.isInteger(n)
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + s;
};

// Assembles a full VideoData object for one creator from the existing Spotlightly
// tables. No new storage, no re-upload: it reuses the public image urls already
// saved on the creator's profile, posts, campaign, listings, and merch.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = (await createServiceClient()) as any;

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("id, display_name, handle, bio, avatar_url, cover_url")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  // Membership tiers
  const { data: tiers } = await supabase
    .from("subscription_tiers")
    .select("name, price_monthly, perks, sort_order, is_active")
    .eq("creator_profile_id", id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // Latest campaign + backer count
  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("id, title, goal_amount, raised_amount, created_at")
    .eq("creator_profile_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let campaign: unknown = undefined;
  if (campaignRow) {
    const { data: donations } = await supabase
      .from("campaign_donations")
      .select("donor_user_id")
      .eq("campaign_id", campaignRow.id);
    const backers = new Set((donations ?? []).map((d: any) => d.donor_user_id)).size;
    const goal = Number(campaignRow.goal_amount ?? 0);
    const raised = Number(campaignRow.raised_amount ?? 0);
    campaign = {
      title: campaignRow.title,
      raised: money(raised),
      goal: money(goal),
      pct: goal > 0 ? Math.round((raised / goal) * 100) : 0,
      backers,
    };
  }

  // Marketplace listings (reuse their saved image urls)
  const { data: listings } = await supabase
    .from("marketplace_listings")
    .select("title, price_usd, images, status, created_at")
    .eq("creator_profile_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(4);

  // Merch products (reuse mockup / design urls)
  const { data: merchRows } = await supabase
    .from("merch_products")
    .select("name, retail_price, mockup_urls, design_url, status, created_at")
    .eq("creator_profile_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(4);

  // Posts with images (reuse their media urls)
  const { data: posts } = await supabase
    .from("posts")
    .select("media_url, media_type, is_pinned, status, created_at")
    .eq("creator_profile_id", id)
    .eq("status", "live")
    .not("media_url", "is", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);

  const feed: string[] = (posts ?? [])
    .filter((p: any) => p.media_url && (p.media_type ?? "image") !== "video")
    .map((p: any) => p.media_url as string)
    .slice(0, 6);

  const rawHandle = String(profile.handle ?? "");
  const handleClean = rawHandle.replace(/^@/, "");
  const handleDisplay = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : "@" + rawHandle) : "";

  const data = {
    creator: {
      name: profile.display_name || "Creator",
      handle: handleDisplay,
      avatar: profile.avatar_url || undefined,
      cover: profile.cover_url || undefined,
      tagline: profile.bio || undefined,
      founding: false,
    },
    intro: { headline: "One place for your biggest supporters." },
    cta: {
      headline: "Turn followers into supporters.",
      sub: "Your stage is waiting.",
      url: handleClean ? `spotlightly.app/${handleClean}` : "spotlightly.app",
    },
    memberships: (tiers ?? []).map((t: any) => ({
      name: t.name,
      price: money(t.price_monthly),
      cadence: "mo",
      perks: Array.isArray(t.perks) ? t.perks : [],
    })),
    campaign,
    marketplace: (listings ?? []).map((l: any) => ({
      title: l.title,
      price: money(l.price_usd),
      image: Array.isArray(l.images) && l.images[0] ? l.images[0] : undefined,
    })),
    merch: (merchRows ?? []).map((m: any) => ({
      name: m.name,
      price: money(m.retail_price),
      image: (Array.isArray(m.mockup_urls) && m.mockup_urls[0]) || m.design_url || undefined,
    })),
    feedScreenshots: feed.length ? feed : undefined,
    bgIntensity: 0.4,
    videoType: "launch",
  };

  return NextResponse.json({ data });
}
