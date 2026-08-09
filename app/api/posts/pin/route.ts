import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeOrLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, pinned } = await req.json();
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Unpin all first if pinning
  if (pinned) {
    await writeOrLog("posts/pin update posts", (supabase as any).from("posts")
      .update({ is_pinned: false })
      .eq("creator_profile_id", profile.id));
  }

  const { error } = await (supabase as any)
    .from("posts")
    .update({ is_pinned: pinned })
    .eq("id", postId)
    .eq("creator_profile_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
