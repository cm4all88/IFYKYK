import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeOrLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { streamId } = await req.json();
  if (!streamId) return NextResponse.json({ error: "Missing streamId" }, { status: 400 });

  // Verify this stream belongs to the user
  const { data: stream } = await (supabase as any)
    .from("live_streams")
    .select("*, creator:creator_profile_id(user_id)")
    .eq("bunny_stream_id", streamId)
    .maybeSingle();

  if (!stream || stream.creator?.user_id !== user.id) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  // Mark stream as ended in DB
  await writeOrLog("live/end update live_streams", (supabase as any)
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("bunny_stream_id", streamId));

  return NextResponse.json({ ok: true });
}
