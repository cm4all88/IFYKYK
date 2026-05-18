import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createLiveStream } from "@/lib/bunny";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title } = await req.json().catch(() => ({ title: "Live Stream" }));

  try {
    const stream = await createLiveStream(title || "Live Stream");
    return NextResponse.json({
      streamId: stream.guid,
      rtmpUrl: `rtmp://live.bunnycdn.com/live/${stream.guid}`,
      streamKey: stream.guid,
      playbackUrl: `https://iframe.mediadelivery.net/embed/${process.env.BUNNY_STREAM_LIBRARY_ID}/${stream.guid}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
