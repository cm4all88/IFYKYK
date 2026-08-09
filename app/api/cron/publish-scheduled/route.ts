import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { writeOrLog } from "@/lib/db";

export async function GET(req: NextRequest) {
  // Verify it's from Vercel cron
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("posts")
    .select("id, creator_profile_id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due || due.length === 0) return NextResponse.json({ published: 0 });

  const ids = due.map((p: any) => p.id);

  await writeOrLog("cron/publish-scheduled update posts", supabase
    .from("posts")
    .update({ status: "live", scheduled_at: null })
    .in("id", ids));

  // Notify each creator's subscribers that a scheduled post is now live.
  try {
    const { notifySubscribers } = await import("@/lib/notify");
    const creatorIds = Array.from(new Set(due.map((p: any) => p.creator_profile_id).filter(Boolean)));
    const { data: cps } = await supabase
      .from("creator_profiles").select("id, handle, display_name").in("id", creatorIds as string[]);
    const byId = new Map((cps ?? []).map((c: any) => [c.id, c]));
    for (const p of due) {
      const c = byId.get(p.creator_profile_id);
      const who = c?.display_name || (c?.handle ? `@${c.handle}` : "A creator");
      await notifySubscribers({
        creatorProfileId: p.creator_profile_id,
        type: "new_post",
        title: `${who} posted`,
        body: "New post is live",
        link: c?.handle ? `/${c.handle}` : "/feed",
      });
    }
  } catch { /* non-fatal */ }

  console.log(`Published ${ids.length} scheduled posts`);
  return NextResponse.json({ published: ids.length });
}
