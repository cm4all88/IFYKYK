import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor"); // created_at for pagination
  const filter = searchParams.get("filter") ?? "all"; // all | video | image | text | locked

  // Step 1: Get all creator_profile_ids the fan subscribes to
  const { data: subs } = await (supabase as any)
    .from("subscriptions")
    .select("creator_id, tier, creator_profile:creator_profiles!creator_id(id, handle, display_name, avatar_url, kind)")
    .eq("fan_user_id", user.id)
    .eq("status", "active");

  if (!subs || subs.length === 0) {
    return NextResponse.json({ posts: [], creators: [], hasMore: false });
  }

  const creatorIds = subs.map((s: any) => s.creator_id);

  // Step 2: Get creator profiles for the avatar strip
  const creators = subs
    .map((s: any) => s.creator_profile)
    .filter(Boolean)
    .filter((c: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === c.id) === i);

  // Step 3: Get unlocked post IDs for this fan
  const { data: unlocks } = await (supabase as any)
    .from("post_unlocks")
    .select("post_id")
    .eq("fan_user_id", user.id);
  const unlockedIds = new Set((unlocks ?? []).map((u: any) => u.post_id));

  // Step 4: Build posts query
  let query = (supabase as any)
    .from("posts")
    .select("*, creator_profile:creator_profiles!creator_profile_id(id, handle, display_name, avatar_url)")
    .in("creator_profile_id", creatorIds)
    .eq("status", "live");

  if (cursor) query = query.lt("created_at", cursor);
  if (filter === "video") query = query.eq("media_type", "video");
  if (filter === "image") query = query.in("media_type", ["image", "gallery"]);
  if (filter === "text") query = query.is("media_url", null);

  query = query
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: posts } = await query;

  // Step 5: Attach unlock status
  const enriched = (posts ?? []).map((p: any) => ({
    ...p,
    isUnlocked: p.tier === "free" || unlockedIds.has(p.id),
    // Subscriber fans can see premium posts from creators they sub to
    isSubscribed: creatorIds.includes(p.creator_profile_id),
  }));

  // Filter locked if requested
  const filtered = filter === "locked"
    ? enriched.filter((p: any) => !p.isUnlocked)
    : enriched;

  const hasMore = filtered.length === 20;

  // Step 5b: Mark which of these posts the viewer has liked
  const pageIds = filtered.map((p: any) => p.id);
  if (pageIds.length) {
    const { data: myLikes } = await (supabase as any)
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .in("post_id", pageIds);
    const likedSet = new Set((myLikes ?? []).map((l: any) => l.post_id));
    for (const p of filtered) p.liked = likedSet.has(p.id);
  }

  // Step 6: Get active live streams from subscribed creators
  const { data: liveStreams } = await (supabase as any)
    .from("live_streams")
    .select("id, title, playback_url, started_at, creator_profile_id, creator_profile:creator_profiles!creator_profile_id(id, handle, display_name, avatar_url)")
    .in("creator_profile_id", creatorIds)
    .eq("status", "live")
    .order("started_at", { ascending: false });

  return NextResponse.json({ posts: filtered, creators, hasMore, liveStreams: liveStreams ?? [] });
}
