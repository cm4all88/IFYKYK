import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { parseCsv, mapCsvRow, type ImportSourceId } from "@/lib/import-core";
import { storeImages } from "@/lib/import-photos";
import { resolveSpotlightProfile, insertDraft } from "@/lib/import-draft";

export const runtime = "nodejs";
export const maxDuration = 300;

// CSV import. Accepts a file upload or raw text. If a row carries image URLs we
// download and store them in Spotlightly storage; if it has none, the draft is
// still created and flagged needs_photos so the creator can add them on review.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user, profile } = await resolveSpotlightProfile(supabase);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "No creator profile" }, { status: 404 });

  let csvText = "";
  let source: ImportSourceId = "csv";
  let sourceUsername: string | null = null;

  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file instanceof File) csvText = await file.text();
    source = (String(form.get("source") || "csv") as ImportSourceId);
    sourceUsername = (form.get("username") as string) || null;
  } else {
    const body = await req.json().catch(() => ({}));
    csvText = String(body.csv || "");
    source = (body.source as ImportSourceId) || "csv";
    sourceUsername = body.username || null;
  }

  if (!csvText.trim()) return NextResponse.json({ error: "No CSV provided" }, { status: 400 });

  const rows = parseCsv(csvText);
  const listings = rows.map(mapCsvRow).filter((l): l is NonNullable<typeof l> => !!l);
  if (listings.length === 0) {
    return NextResponse.json({ error: "No listings found. The CSV needs at least a 'title' column." }, { status: 400 });
  }

  const { data: run } = await (supabase as any)
    .from("import_runs")
    .insert({ creator_profile_id: profile.id, source, source_username: sourceUsername, status: "running", listings_found: listings.length })
    .select("id").single();
  const runId = run?.id as string;

  let imported = 0, skipped = 0, photosSaved = 0, photosFailed = 0;
  const errors: string[] = [];

  for (const listing of listings) {
    const photos = listing.imageUrls.length
      ? await storeImages(user.id, listing.imageUrls)
      : { stored: [] as string[], saved: 0, failed: 0, errors: [] as string[] };
    photosSaved += photos.saved;
    photosFailed += photos.failed;
    if (photos.errors.length) errors.push(...photos.errors.slice(0, 2).map((e) => `${listing.title}: ${e}`));

    const res = await insertDraft(supabase, {
      creatorProfileId: profile.id, importRunId: runId, source, sourceUsername, listing, images: photos.stored,
    });
    if (res.ok) imported += 1;
    else { skipped += 1; errors.push(`${listing.title}: ${res.error}`); }
  }

  await (supabase as any).from("import_runs").update({
    status: "complete", listings_imported: imported, listings_skipped: skipped,
    photos_saved: photosSaved, photos_failed: photosFailed,
    errors: errors.slice(0, 50), completed_at: new Date().toISOString(),
  }).eq("id", runId);

  return NextResponse.json({
    runId, found: listings.length, imported, skipped,
    photosSaved, photosFailed, needsPhotos: listings.length - listings.filter((l) => l.imageUrls.length).length,
  });
}
