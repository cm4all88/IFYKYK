import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { BUNNY } from "@/lib/bunny";

/**
 * POST /api/live/whip?videoId=xxx
 * Proxies WHIP SDP offer to BunnyCDN — browsers can't send auth headers cross-origin.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videoId = req.nextUrl.searchParams.get("videoId");
  if (!videoId) return NextResponse.json({ error: "Missing videoId" }, { status: 400 });

  if (!BUNNY.STREAM_LIBRARY_ID || !BUNNY.STREAM_KEY) {
    return NextResponse.json({ error: "Stream not configured" }, { status: 503 });
  }

  const sdpOffer = await req.text();
  const whipUrl = `https://video.bunnycdn.com/library/${BUNNY.STREAM_LIBRARY_ID}/videos/${videoId}/whip`;

  const res = await fetch(whipUrl, {
    method: "POST",
    headers: {
      "AccessKey": BUNNY.STREAM_KEY,
      "Content-Type": "application/sdp",
    },
    body: sdpOffer,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("WHIP error:", res.status, err);
    return NextResponse.json({ error: `WHIP failed (${res.status})` }, { status: 500 });
  }

  const sdpAnswer = await res.text();
  return new NextResponse(sdpAnswer, {
    status: 201,
    headers: { "Content-Type": "application/sdp" },
  });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videoId = req.nextUrl.searchParams.get("videoId");
  if (!videoId) return NextResponse.json({ error: "Missing videoId" }, { status: 400 });

  await fetch(`https://video.bunnycdn.com/library/${BUNNY.STREAM_LIBRARY_ID}/videos/${videoId}/whip`, {
    method: "DELETE",
    headers: { "AccessKey": BUNNY.STREAM_KEY },
  });

  return NextResponse.json({ ok: true });
}
