import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const fields: any = {};
  if (typeof body.display_name === "string") fields.display_name = body.display_name.trim();
  if (typeof body.bio === "string") fields.bio = body.bio;
  if (typeof body.avatar_url === "string") fields.avatar_url = body.avatar_url || null;
  if (typeof body.cover_url === "string") fields.cover_url = body.cover_url || null;
  if (body.subscription_price !== undefined && body.subscription_price !== null && body.subscription_price !== "") {
    const p = Number(body.subscription_price);
    if (!Number.isNaN(p)) fields.subscription_price = p;
  }
  if (body.social_links && typeof body.social_links === "object") {
    fields.social_links = body.social_links;
  }
  if (typeof body.wishlist_url === "string") {
    fields.wishlist_url = body.wishlist_url.trim() || null;
  }

  const admin = await createServiceClient();
  const { error } = await (admin as any).from("creator_profiles").update(fields).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
