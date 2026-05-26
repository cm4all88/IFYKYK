import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  await supabase
    .from("posts")
    .update({ status: "live", scheduled_at: null })
    .in("id", ids);

  console.log(`Published ${ids.length} scheduled posts`);
  return NextResponse.json({ published: ids.length });
}
