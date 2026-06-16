import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { tiktokDateMs, instagramDateMs } from "@/lib/socialDates";

function detectPlatform(url: string): string | null {
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/twitter\.com|x\.com/i.test(url)) return "x";
  if (/facebook\.com/i.test(url)) return "facebook";
  return null;
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const creatorId = String(body?.creator_profile_id || "");
  const url = String(body?.url || "").trim();
  if (!creatorId) return NextResponse.json({ error: "Missing creator" }, { status: 400 });
  if (!url) return NextResponse.json({ error: "Add a post link." }, { status: 400 });
  const platform = detectPlatform(url);
  if (!platform) return NextResponse.json({ error: "Use an Instagram, TikTok, YouTube, X, or Facebook link." }, { status: 400 });

  let postedAt: string | null = null;
  const ms = platform === "tiktok" ? tiktokDateMs(url) : platform === "instagram" ? instagramDateMs(url) : null;
  if (ms) postedAt = new Date(ms).toISOString();

  const admin = await createServiceClient();
  const { data, error } = await (admin as any).from("social_posts").insert({
    creator_id: creatorId,
    url,
    platform,
    original_posted_at: postedAt,
    caption: typeof body.caption === "string" && body.caption.trim() ? body.caption.trim() : null,
  }).select("id, url, platform").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, post: data });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const admin = await createServiceClient();
  const { error } = await (admin as any).from("social_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
