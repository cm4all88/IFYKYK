import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sanitizePrice, type ImportSourceId } from "@/lib/import-core";
import { storeImages } from "@/lib/import-photos";
import { resolveSpotlightProfile, insertDraft } from "@/lib/import-draft";

export const runtime = "nodejs";
export const maxDuration = 300;

// Receiver for the creator-side capture / bookmarklet. The creator's own browser
// (logged into their own Poshmark / Mercari / Depop / Facebook closet) sends the
// listings it read. Image refs may be remote URLs or base64 blobs; either way we
// copy them INTO Spotlightly storage and never hotlink.
type IncomingListing = {
  title?: string; description?: string; price?: string | number;
  brand?: string; category?: string; size?: string; condition?: string;
  sourceUrl?: string; imageUrls?: string[]; // remote URLs and/or data: URLs
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user, profile } = await resolveSpotlightProfile(supabase);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "No creator profile" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const source = (body.source as ImportSourceId) || "capture";
  const sourceUsername: string | null = body.username || null;
  const incoming: IncomingListing[] = Array.isArray(body.listings) ? body.listings : [];
  const usable = incoming.filter((l) => (l.title || "").trim());
  if (usable.length === 0) return NextResponse.json({ error: "No listings received" }, { status: 400 });

  const { data: run } = await (supabase as any)
    .from("import_runs")
    .insert({ creator_profile_id: profile.id, source, source_username: sourceUsername, status: "running", listings_found: usable.length })
    .select("id").single();
  const runId = run?.id as string;

  let imported = 0, skipped = 0, photosSaved = 0, photosFailed = 0;
  const errors: string[] = [];

  for (const l of usable) {
    const refs = Array.isArray(l.imageUrls) ? l.imageUrls.filter((u) => typeof u === "string") : [];
    const photos = refs.length ? await storeImages(user.id, refs) : { stored: [] as string[], saved: 0, failed: 0, errors: [] as string[] };
    photosSaved += photos.saved; photosFailed += photos.failed;
    if (photos.errors.length) errors.push(...photos.errors.slice(0, 2).map((e) => `${l.title}: ${e}`));

    const res = await insertDraft(supabase, {
      creatorProfileId: profile.id, importRunId: runId, source, sourceUsername,
      listing: {
        title: String(l.title || "Untitled item"),
        description: l.description ?? null,
        price: sanitizePrice(l.price),
        brand: l.brand ?? null, category: l.category ?? null, size: l.size ?? null,
        condition: l.condition ?? null, sourceUrl: l.sourceUrl ?? null,
      },
      images: photos.stored,
    });
    if (res.ok) imported += 1; else { skipped += 1; errors.push(`${l.title}: ${res.error}`); }
  }

  await (supabase as any).from("import_runs").update({
    status: "complete", listings_imported: imported, listings_skipped: skipped,
    photos_saved: photosSaved, photos_failed: photosFailed,
    errors: errors.slice(0, 50), completed_at: new Date().toISOString(),
  }).eq("id", runId);

  return NextResponse.json({ runId, found: usable.length, imported, skipped, photosSaved, photosFailed });
}
