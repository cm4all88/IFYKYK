import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { bunnySignUrl } from "@/lib/bunny";
import { loadFeedUrls } from "@/lib/videoStudioFeed";

export const dynamic = "force-dynamic";

// Sign BunnyCDN urls so videos keep working if Bunny Token Authentication is
// ever enabled on the pull zone. While that feature is off, bunnySignUrl is a
// no-op and returns the url unchanged. Non-Bunny urls (external avatars, demo
// assets) pass through untouched. A long expiry covers load-then-export gaps.
const signImg = (u?: string | null): string | undefined => {
  if (!u) return undefined;
  return /\.b-cdn\.net\//i.test(u) ? bunnySignUrl(u, 86400) : u;
};

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
      .select("donor_user_id, amount")
      .eq("campaign_id", campaignRow.id);
    const backers = new Set((donations ?? []).map((d: any) => d.donor_user_id)).size;
    const donatedSum = (donations ?? []).reduce((a: number, d: any) => a + Number(d.amount ?? 0), 0);
    const goal = Number(campaignRow.goal_amount ?? 0);
    // The stored raised_amount can lag behind real donations; use whichever is higher.
    const raised = Math.max(Number(campaignRow.raised_amount ?? 0), donatedSum);
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
  const feed: string[] = await loadFeedUrls(supabase, id);

  // Attach any cached narrative analysis, aligned to feed by index. Cache only here;
  // the explicit "Analyze creator media" button is what populates it.
  let mediaAnalysis: (unknown | null)[] | undefined = undefined;
  if (feed.length) {
    const { data: rows } = await supabase
      .from("creator_media_analysis")
      .select("media_url, analysis_json")
      .in("media_url", feed);
    const byUrl: Record<string, unknown> = {};
    for (const r of rows ?? []) byUrl[(r as any).media_url] = (r as any).analysis_json;
    if (Object.keys(byUrl).length) mediaAnalysis = feed.map((u) => byUrl[u] ?? null);
  }

  const rawHandle = String(profile.handle ?? "");
  const handleClean = rawHandle.replace(/^@/, "");
  const handleDisplay = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : "@" + rawHandle) : "";

  // Grabbed profile text is freeform: long bios, emoji, pasted urls, overlong tier
  // perks. Tidy it so it sits in the template instead of overflowing or reading oddly.
  const stripJunk = (s: unknown): string =>
    String(s ?? "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
      .replace(/[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u20E3]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const clampText = (s: unknown, max: number): string => {
    const t = stripJunk(s);
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const sp = cut.lastIndexOf(" ");
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.\s]+$/, "");
  };
  const tidy = (s: unknown, max: number): string | undefined => clampText(s, max) || undefined;

  const data = {
    creator: {
      name: tidy(profile.display_name, 40) || "Creator",
      handle: handleDisplay,
      avatar: signImg(profile.avatar_url),
      cover: signImg(profile.cover_url),
      tagline: tidy(profile.bio, 120),
      founding: false,
    },
    intro: { headline: "One place for your biggest supporters." },
    cta: {
      headline: "Turn followers into supporters.",
      sub: "Your stage is waiting.",
      url: handleClean ? `spotlightly.app/${handleClean}` : "spotlightly.app",
    },
    memberships: (tiers ?? []).map((t: any) => ({
      name: tidy(t.name, 32) || "Membership",
      price: money(t.price_monthly),
      cadence: "mo",
      perks: (Array.isArray(t.perks) ? t.perks : [])
        .map((p: unknown) => tidy(p, 64))
        .filter(Boolean)
        .slice(0, 4),
    })),
    campaign,
    marketplace: (listings ?? []).map((l: any) => ({
      title: l.title,
      price: money(l.price_usd),
      image: signImg(Array.isArray(l.images) && l.images[0] ? l.images[0] : undefined),
    })),
    merch: (merchRows ?? []).map((m: any) => ({
      name: m.name,
      price: money(m.retail_price),
      image: signImg((Array.isArray(m.mockup_urls) && m.mockup_urls[0]) || m.design_url || undefined),
    })),
    feedScreenshots: feed.length ? feed.map((u) => signImg(u) as string) : undefined,
    mediaAnalysis: mediaAnalysis as any,
    bgIntensity: 0.4,
    goal: "subs",
    videoType: "launch",
  };

  return NextResponse.json({ data });
}
