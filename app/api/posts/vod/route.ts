import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { streamId, caption, lockType, unlockPrice, expiresAt } = await req.json();
  if (!streamId) return NextResponse.json({ error: "Missing streamId" }, { status: 400 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles").select("id").eq("user_id", user.id)
    .eq("kind", "spotlight").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Get the stream
  const { data: stream } = await (supabase as any)
    .from("live_streams").select("*")
    .eq("id", streamId)
    .eq("creator_profile_id", profile.id)
    .maybeSingle();
  if (!stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 });

  const resolvedLockType = lockType ?? "free";
  const resolvedTier = resolvedLockType === "subscription" ? "premium" : "free";

  const { data: post, error } = await (supabase as any)
    .from("posts")
    .insert({
      creator_profile_id: profile.id,
      caption: caption?.trim() || stream.title || "Live replay",
      media_url: stream.playback_url,
      media_type: "video",
      post_type: "vod",
      tier: resolvedTier,
      lock_type: resolvedLockType,
      unlock_price: resolvedLockType === "purchase" ? (unlockPrice ?? null) : null,
      expires_at: expiresAt ?? null,
      vod_stream_id: streamId,
      status: "live",
      moderation_status: "approved",
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post });
}
