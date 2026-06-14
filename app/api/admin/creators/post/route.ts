import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const creatorProfileId = String(body?.creator_profile_id || "");
  if (!creatorProfileId) return NextResponse.json({ error: "Missing creator" }, { status: 400 });
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const mediaUrl = typeof body.media_url === "string" && body.media_url ? body.media_url : null;
  if (!caption && !mediaUrl) return NextResponse.json({ error: "Add a caption or an image." }, { status: 400 });
  const mediaType = mediaUrl ? (String(body.media_type || "image").startsWith("video") ? "video" : "image") : null;
  const locked = !!body.locked;

  const admin = await createServiceClient();
  const { data, error } = await (admin as any).from("posts").insert({
    creator_profile_id: creatorProfileId,
    caption: caption || null,
    media_url: mediaUrl,
    media_type: mediaType,
    tier: locked ? "premium" : "free",
    lock_type: locked ? "subscription" : "free",
    status: "live",
    moderation_status: "approved",
    tags: [],
    post_type: "post",
    is_pinned: false,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const admin = await createServiceClient();
  const { error } = await (admin as any).from("posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
