import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeOrLog } from "@/lib/db";

// Records a live viewer's presence so the billing cron can count concurrent
// viewers. Called by the viewer player every ~30s. Broadcaster is excluded.
export async function POST(req: NextRequest) {
  const { streamId, viewerKey } = await req.json().catch(() => ({} as any));
  if (!streamId) return NextResponse.json({ error: "Missing streamId" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const key = user?.id ?? (typeof viewerKey === "string" && viewerKey ? `anon:${viewerKey.slice(0, 48)}` : null);
  if (!key) return NextResponse.json({ ok: false });

  await writeOrLog("live/heartbeat upsert live_viewer_pings", (supabase as any).from("live_viewer_pings").upsert(
    { stream_id: streamId, viewer_key: key, last_seen: new Date().toISOString() },
    { onConflict: "stream_id,viewer_key" }
  ));
  return NextResponse.json({ ok: true });
}
