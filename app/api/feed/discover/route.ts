import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { bunnySignUrl } from "@/lib/bunny";

// ──────────────────────────────────────────────────────────────────
// "For You" — the discovery feed. This is the cold-start fix: a fan with zero
// subscriptions should never hit an empty screen. It surfaces recent posts from
// PUBLISHED spotlight creators the fan does NOT already subscribe to, lightly
// boosted by the fan's interest tags on the first page.
//
// SECURITY: same rule as the main feed — a locked post's original media never
// reaches the client. Locked posts appear as a "curtain" teaser (a subscribe
// hook), and visible media is signed so Bunny token auth can be enabled.
// ──────────────────────────────────────────────────────────────────

const SELECT =
  "*, creator_profile:creator_profiles!inner(id, handle, display_name, avatar_url, kind, tags, published)";

function shape(p: any) {
  const isFree = p.tier === "free";
  const base = {
    id: p.id,
    creator_profile_id: p.creator_profile_id,
    caption: p.caption ?? null,
    media_type: p.media_type ?? null,
    tier: p.tier,
    content_rating: p.content_rating ?? "sfw",
    likes_count: p.likes_count ?? 0,
    views_count: p.views_count ?? 0,
    medal_count: p.medal_count ?? 0,
    created_at: p.created_at,
    is_pinned: !!p.is_pinned,
    isUnlocked: isFree,          // discovery viewer is never subscribed here
    isSubscribed: false,
    creator_profile: {
      id: p.creator_profile?.id,
      handle: p.creator_profile?.handle,
      display_name: p.creator_profile?.display_name,
      avatar_url: p.creator_profile?.avatar_url ?? null,
      kind: p.creator_profile?.kind ?? "spotlight",
    },
  };
  if (!isFree) {
    // Locked teaser — reveal nothing about the file.
    return { ...base, locked: true, locked_type: p.media_type ?? null, media_url: null, media_urls: [] };
  }
  return {
    ...base,
    locked: false,
    media_url: p.media_url ? bunnySignUrl(p.media_url) : null,
    media_urls: Array.isArray(p.media_urls)
      ? p.media_urls.filter((m: any) => m?.url).map((m: any) => ({ ...m, url: bunnySignUrl(m.url) }))
      : [],
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor"); // created_at for pagination
  const PAGE = 20;

  // Creators to exclude: ones the fan already subscribes to, plus their own profile.
  const [{ data: subs }, { data: mine }, { data: ints }] = await Promise.all([
    (supabase as any).from("subscriptions").select("creator_id").eq("fan_user_id", user.id).eq("status", "active"),
    (supabase as any).from("creator_profiles").select("id").eq("user_id", user.id),
    (supabase as any).from("fan_interests").select("category").eq("fan_user_id", user.id),
  ]);
  const excludeIds = new Set<string>([
    ...((subs ?? []).map((s: any) => s.creator_id)),
    ...((mine ?? []).map((m: any) => m.id)),
  ]);
  const interestTags: string[] = (ints ?? []).map((i: any) => i.category).filter(Boolean);

  function baseQuery() {
    let q = (supabase as any)
      .from("posts")
      .select(SELECT)
      .eq("status", "live")
      .eq("creator_profile.kind", "spotlight")
      .eq("creator_profile.published", true);
    if (excludeIds.size) q = q.not("creator_profile_id", "in", `(${Array.from(excludeIds).join(",")})`);
    return q;
  }

  // Page 1 leads with interest-matched creators (if any), then fills with recent.
  // Later pages are pure recency via the created_at cursor — stable + simple.
  const collected: any[] = [];
  const seen = new Set<string>();

  if (!cursor && interestTags.length) {
    const { data: matched } = await baseQuery()
      .overlaps("creator_profile.tags", interestTags)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    for (const p of matched ?? []) {
      if (!seen.has(p.id)) { seen.add(p.id); collected.push(p); }
    }
  }

  // Fill (or full page for cursored requests) with recent posts.
  let recentQ = baseQuery().order("created_at", { ascending: false }).limit(PAGE * 2);
  if (cursor) recentQ = recentQ.lt("created_at", cursor);
  const { data: recent } = await recentQ;
  for (const p of recent ?? []) {
    if (collected.length >= PAGE) break;
    if (!seen.has(p.id)) { seen.add(p.id); collected.push(p); }
  }

  // Light ranking within the page: recency + medals + a nudge for interest match
  // and pins. Keeps discovery feeling curated without a heavy RPC.
  const now = Date.now();
  const tagSet = new Set(interestTags.map((t) => t.toLowerCase()));
  const scored = collected
    .map((p) => {
      const hoursAgo = (now - new Date(p.created_at).getTime()) / 3.6e6;
      const recency = Math.max(0, 72 - hoursAgo);
      const medals = (p.medal_count ?? 0) * 2;
      const likes = (p.likes_count ?? 0) * 0.25;
      const cTags: string[] = Array.isArray(p.creator_profile?.tags) ? p.creator_profile.tags : [];
      const interest = cTags.some((t) => tagSet.has(String(t).toLowerCase())) ? 15 : 0;
      const pinned = p.is_pinned ? 3 : 0;
      return { p, score: recency + medals + likes + interest + pinned };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => shape(s.p));

  // Cursor for the next page = oldest created_at we returned (recency-ordered tail).
  const oldest = collected.length
    ? collected.reduce((min, p) => (p.created_at < min ? p.created_at : min), collected[0].created_at)
    : null;
  const hasMore = (recent ?? []).length >= PAGE;

  return NextResponse.json({ posts: scored, hasMore, cursor: oldest });
}
