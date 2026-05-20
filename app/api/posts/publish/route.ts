import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { moderateChatMessage } from "@/lib/advisor";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caption, mediaUrl, mediaType, tier, creatorProfileId } = await req.json();

  const { data: profile } = await (supabase as any)
    .from("creator_profiles").select("id, kind").eq("id", creatorProfileId).eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // AI moderation gate
  if (caption?.trim()) {
    const mod = await moderateChatMessage(caption.trim(), { creatorType: profile.kind === "backstage" ? "backstage" : "spotlight" });
    if (!(mod as any).allowed) {
      await (supabase as any).from("moderation_events").insert({
        creator_id: creatorProfileId,
        content_type: "post",
        flag_reason: (mod as any).reason ?? "Content policy violation",
        severity: mod.severity ?? "medium",
        action_taken: "blocked_at_publish",
      });
      return NextResponse.json({ error: `Post blocked: ${mod.reason}`, blocked: true }, { status: 422 });
    }
  }

  const { data: post, error } = await (supabase as any).from("posts").insert({
    creator_profile_id: creatorProfileId,
    caption: caption?.trim() || null,
    media_url: mediaUrl || null,
    media_type: mediaType || null,
    tier: tier || "free",
    status: "live",
    moderation_status: "approved",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post });
}
