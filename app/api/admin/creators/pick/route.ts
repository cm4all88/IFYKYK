import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { affiliateUrl, extractAsin } from "@/lib/amazon";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const creatorProfileId = String(body?.creator_profile_id || "");
  const rawUrl = String(body?.url || "").trim();
  const label = String(body?.label || "").trim();
  if (!creatorProfileId) return NextResponse.json({ error: "Missing creator" }, { status: 400 });
  if (!rawUrl) return NextResponse.json({ error: "Add a product link." }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Add a label." }, { status: 400 });

  const url = affiliateUrl(rawUrl);
  const asin = extractAsin(rawUrl);
  const imageUrl = typeof body.image_url === "string" && body.image_url ? body.image_url : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  const admin = await createServiceClient();
  const { data, error } = await (admin as any).from("affiliate_picks").insert({
    creator_profile_id: creatorProfileId, asin, url, label, image_url: imageUrl, note,
  }).select("id, label, url, image_url, note").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pick: data });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const admin = await createServiceClient();
  const { error } = await (admin as any).from("affiliate_picks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
