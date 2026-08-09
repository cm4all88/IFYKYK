import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sanitizePrice, normalizeCategory, normalizeCondition } from "@/lib/import-core";
import { resolveSpotlightProfile } from "@/lib/import-draft";
import { writeOrLog } from "@/lib/db";

export const runtime = "nodejs";

// One endpoint for the approval screen's three actions:
//   import → publish the draft (status active). Nothing goes live before this.
//   edit   → save changes, stay a draft.
//   skip   → discard the draft.
// Photo reorder / remove / replace is just the edited `images` array the client
// sends (already Spotlightly URLs). Replacements are uploaded via /api/upload first.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user, profile } = await resolveSpotlightProfile(supabase);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "No creator profile" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const action = String(body.action || "");
  if (!id || !["import", "edit", "skip"].includes(action)) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  // Ownership: the draft must belong to this creator and still be a draft.
  const { data: draft } = await (supabase as any)
    .from("marketplace_listings")
    .select("id, creator_profile_id, status")
    .eq("id", id).eq("creator_profile_id", profile.id).maybeSingle();
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (draft.status !== "draft") return NextResponse.json({ error: "Already processed" }, { status: 409 });

  if (action === "skip") {
    await writeOrLog("marketplace/import/action delete marketplace_listings", (supabase as any).from("marketplace_listings").delete().eq("id", id).eq("creator_profile_id", profile.id));
    return NextResponse.json({ ok: true, action: "skip" });
  }

  // Build the update from edited fields (all optional except where publishing).
  const f = body.fields || {};
  const update: Record<string, any> = {};
  if (typeof f.title === "string") update.title = f.title.slice(0, 140);
  if (typeof f.description === "string") update.description = f.description.slice(0, 5000);
  if (f.price != null) update.price_usd = sanitizePrice(f.price);
  if (typeof f.category === "string") update.category = normalizeCategory(f.category);
  if (typeof f.condition === "string") update.condition = normalizeCondition(f.condition);
  if (typeof f.brand === "string") update.brand = f.brand || null;
  if (typeof f.size === "string") update.size = f.size || null;
  if (Array.isArray(body.images)) {
    const imgs = body.images.filter((u: any) => typeof u === "string");
    update.images = imgs;
    update.needs_photos = imgs.length === 0;
  }

  // Any save or publish means a human looked at it.
  update.needs_review = false;

  if (action === "import") {
    // Publishing rules: a real price and at least one photo.
    const finalPrice = update.price_usd ?? null;
    if (finalPrice != null && finalPrice < 1) {
      return NextResponse.json({ error: "Set a price of at least $1 before publishing." }, { status: 400 });
    }
    const finalImages = "images" in update ? update.images : null;
    if (finalImages != null && finalImages.length === 0) {
      return NextResponse.json({ error: "Add at least one photo before publishing." }, { status: 400 });
    }
    update.status = "active";
    update.updated_at = new Date().toISOString();
  }

  const { error } = await (supabase as any)
    .from("marketplace_listings").update(update).eq("id", id).eq("creator_profile_id", profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, action });
}
