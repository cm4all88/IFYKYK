import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { sanitizePrice, normalizeCategory, normalizeCondition } from "@/lib/import-core";
import { resolveSpotlightProfile, insertDraft } from "@/lib/import-draft";
import { writeOrLog } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

// Photo-first import. The creator uploads photos for ONE item (already stored in
// Spotlightly via /api/upload, so imageUrls are Spotlightly CDN URLs). If an
// Anthropic key is configured, Claude drafts the title, description, category,
// price, brand, and condition from the photos. Photos are the non-negotiable
// part; the AI fields are an assist, and the draft is created either way.
async function aiDraftFromPhotos(imageUrls: string[]): Promise<any | null> {
  const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const content: any[] = imageUrls.slice(0, 4).map((url) => ({ type: "image", source: { type: "url", url } }));
    content.push({
      type: "text",
      text:
        "These photos are one resale item. Return ONLY JSON, no prose, no markdown fences: " +
        '{"title":"","description":"","category":"clothing|accessories|prints|gear|signed|personal|other","price":0,"brand":"","condition":"new|like_new|good|fair","size":""}. ' +
        "Title under 80 chars. Description 1-3 honest sentences a buyer would want. Price is your best USD estimate as a number. Leave brand or size empty if unsure.",
    });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 700, messages: [{ role: "user", content }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return parsed;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user, profile } = await resolveSpotlightProfile(supabase);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "No creator profile" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const imageUrls: string[] = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u: any) => typeof u === "string") : [];
  if (imageUrls.length === 0) return NextResponse.json({ error: "Upload at least one photo" }, { status: 400 });

  const ai = await aiDraftFromPhotos(imageUrls);

  const { data: run } = await (supabase as any)
    .from("import_runs")
    .insert({ creator_profile_id: profile.id, source: "photos", status: "running", listings_found: 1 })
    .select("id").single();
  const runId = run?.id as string;

  const listing = {
    title: (ai?.title ? String(ai.title) : (body.title ? String(body.title) : "Untitled item")).slice(0, 140),
    description: ai?.description ? String(ai.description) : (body.description ?? null),
    price: sanitizePrice(ai?.price ?? body.price),
    brand: ai?.brand ? String(ai.brand) : null,
    category: normalizeCategory(ai?.category ?? body.category),
    size: ai?.size ? String(ai.size) : null,
    condition: normalizeCondition(ai?.condition ?? body.condition),
    sourceUrl: null,
  };

  const res = await insertDraft(supabase, { creatorProfileId: profile.id, importRunId: runId, source: "photos", listing, images: imageUrls });

  await writeOrLog("marketplace/import/photos update import_runs", (supabase as any).from("import_runs").update({
    status: res.ok ? "complete" : "failed",
    listings_imported: res.ok ? 1 : 0, listings_skipped: res.ok ? 0 : 1,
    photos_saved: imageUrls.length,
    errors: res.ok ? [] : [res.error], completed_at: new Date().toISOString(),
  }).eq("id", runId));

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ runId, imported: 1, aiDrafted: !!ai, photosSaved: imageUrls.length });
}
