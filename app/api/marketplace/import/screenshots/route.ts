import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { sanitizePrice, normalizeCategory, normalizeCondition } from "@/lib/import-core";
import { resolveSpotlightProfile, insertDraft } from "@/lib/import-draft";

export const runtime = "nodejs";
export const maxDuration = 180;

// Import from screenshots. The creator screenshots their own listings (a Poshmark
// or Mercari detail page, etc.) and uploads them. Each screenshot is read by
// Claude vision for the visible title, price, description, brand, size, condition,
// then becomes ONE draft, always flagged needs_review because a screenshot is a
// reference, not a clean product photo. The creator confirms and swaps in real
// photos on the approval screen. Screenshots are already stored in Spotlightly
// (uploaded via /api/upload), so imageUrls are Spotlightly CDN URLs.
async function readScreenshot(apiKey: string, url: string): Promise<any | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url } },
            {
              type: "text",
              text:
                "This is a screenshot of one resale listing. Read ONLY the text you can actually see and return ONLY JSON, no prose, no markdown fences: " +
                '{"title":"","description":"","price":0,"brand":"","category":"clothing|accessories|prints|gear|signed|personal|other","condition":"new|like_new|good|fair","size":"","uncertain":[]}. ' +
                "Leave any field empty if it is not clearly visible. Put the NAME of every field you had to guess or could not read into the uncertain array (e.g. [\"price\",\"brand\"]).",
            },
          ],
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user, profile } = await resolveSpotlightProfile(supabase);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "No creator profile" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const imageUrls: string[] = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u: any) => typeof u === "string") : [];
  if (imageUrls.length === 0) return NextResponse.json({ error: "Upload at least one screenshot" }, { status: 400 });

  const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);

  const { data: run } = await (supabase as any)
    .from("import_runs")
    .insert({ creator_profile_id: profile.id, source: "screenshots", status: "running", listings_found: imageUrls.length })
    .select("id").single();
  const runId = run?.id as string;

  let imported = 0, skipped = 0;
  for (const url of imageUrls.slice(0, 20)) {
    const ai = ANTHROPIC_API_KEY ? await readScreenshot(ANTHROPIC_API_KEY, url) : null;
    const listing = {
      title: (ai?.title ? String(ai.title) : "Untitled item").slice(0, 140),
      description: ai?.description ? String(ai.description) : null,
      price: sanitizePrice(ai?.price),
      brand: ai?.brand ? String(ai.brand) : null,
      category: normalizeCategory(ai?.category),
      size: ai?.size ? String(ai.size) : null,
      condition: normalizeCondition(ai?.condition),
      sourceUrl: null,
    };
    const res = await insertDraft(supabase, {
      creatorProfileId: profile.id, importRunId: runId, source: "screenshots",
      listing, images: [url], needsReview: true,
    });
    if (res.ok) imported += 1; else skipped += 1;
  }

  await (supabase as any).from("import_runs").update({
    status: "complete", listings_imported: imported, listings_skipped: skipped,
    photos_saved: imageUrls.length, completed_at: new Date().toISOString(),
  }).eq("id", runId);

  return NextResponse.json({ runId, found: imageUrls.length, imported, skipped, photosSaved: imageUrls.length, aiUsed: !!ANTHROPIC_API_KEY });
}
