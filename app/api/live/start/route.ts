import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createLiveStream } from "@/lib/bunny";

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
    const stream = await createLiveStream(title || "Live Stream");
    const rtmpUrl = `rtmp://live.bunnycdn.com/live/${stream.guid}`;
    const playbackUrl = `https://iframe.mediadelivery.net/embed/${process.env.BUNNY_STREAM_LIBRARY_ID}/${stream.guid}`;

    // Save to DB so fans can see the live stream
    await (supabase as any).from("live_streams").insert({
      creator_profile_id: creatorProfileId,
      bunny_stream_id: stream.guid,
      title: title || "Live Stream",
      status: "live",
      playback_url: playbackUrl,
      rtmp_url: rtmpUrl,
      stream_key: stream.guid,
    });

    return NextResponse.json({
      streamId: stream.guid,
      rtmpUrl,
      streamKey: stream.guid,
      playbackUrl,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
