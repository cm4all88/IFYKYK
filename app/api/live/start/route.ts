import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createCloudflareLiveInput } from "@/lib/cloudflare-stream";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, creatorProfileId } = await req.json().catch(() => ({}));

  // Verify profile ownership
  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id")
    .eq("id", creatorProfileId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // End any existing live streams for this profile
  await (supabase as any)
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("creator_profile_id", creatorProfileId)
    .eq("status", "live");

  try {
    const live = await createCloudflareLiveInput(title || "Live Stream");

    // Save to DB so fans can see the live stream (bunny_stream_id now holds the Cloudflare input uid)
    await (supabase as any).from("live_streams").insert({
      creator_profile_id: creatorProfileId,
      bunny_stream_id: live.uid,
      title: title || "Live Stream",
      status: "live",
      playback_url: live.playbackUrl,
      rtmp_url: null,
      stream_key: live.uid,
    });

    // whipUrl is the per-input ingest credential — only returned to the broadcasting creator here.
    return NextResponse.json({
      streamId: live.uid,
      whipUrl: live.whipUrl,
      playbackUrl: live.playbackUrl,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
