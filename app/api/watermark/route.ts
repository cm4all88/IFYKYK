import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * POST /api/watermark
 * Returns a watermarked image URL using BunnyCDN's URL signing + text overlay.
 * For Backstage content only — adds fan's username as a subtle watermark.
 * 
 * BunnyCDN doesn't natively watermark, so we use CSS overlay on the client.
 * This returns the fan's display info to render as an overlay.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mediaUrl, postId } = await req.json();
  if (!mediaUrl) return NextResponse.json({ error: "Missing mediaUrl" }, { status: 400 });

  // Get fan's display name for the watermark
  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("display_name, handle")
    .eq("user_id", user.id)
    .maybeSingle();

  const watermarkText = profile?.handle
    ? `@${profile.handle} · spotlightly.app`
    : `spotlightly.app · ${user.id.slice(0, 8)}`;

  return NextResponse.json({
    mediaUrl,
    watermark: {
      text: watermarkText,
      opacity: 0.18,
      position: "bottom-right",
    },
  });
}
