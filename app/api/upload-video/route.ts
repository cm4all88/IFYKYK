import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { BUNNY } from "@/lib/bunny";

/**
 * POST /api/upload-video
 * Creates a BunnyCDN video object and returns upload credentials.
 * Client uploads the file directly to BunnyCDN — bypasses Vercel 4.5MB limit.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!BUNNY.STREAM_LIBRARY_ID || !BUNNY.STREAM_KEY) {
    return NextResponse.json({ error: "Video upload not configured" }, { status: 503 });
  }

  const { title } = await req.json().catch(() => ({ title: "Creator upload" }));

  const res = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY.STREAM_LIBRARY_ID}/videos`,
    {
      method: "POST",
      headers: {
        "AccessKey": BUNNY.STREAM_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: title || "Creator upload" }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `BunnyCDN error: ${err}` }, { status: 500 });
  }

  const video = await res.json();

  return NextResponse.json({
    videoId: video.guid,
    uploadUrl: `https://video.bunnycdn.com/library/${BUNNY.STREAM_LIBRARY_ID}/videos/${video.guid}`,
    accessKey: BUNNY.STREAM_KEY,
    playbackUrl: `https://iframe.mediadelivery.net/embed/${BUNNY.STREAM_LIBRARY_ID}/${video.guid}`,
    cdnUrl: `https://vz-${BUNNY.STREAM_LIBRARY_ID}.b-cdn.net/${video.guid}/play_720p.mp4`,
  });
}
