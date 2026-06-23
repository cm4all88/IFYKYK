import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolveSpotlightProfile } from "@/lib/import-draft";

export const runtime = "nodejs";

// Powers the approval screen (drafts to review) and the Import Dashboard
// (per-run counters: imported, photos saved, missing photos, errors).
export async function GET() {
  const supabase = await createClient();
  const { user, profile } = await resolveSpotlightProfile(supabase);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "No creator profile" }, { status: 404 });

  const [{ data: drafts }, { data: runs }] = await Promise.all([
    (supabase as any)
      .from("marketplace_listings")
      .select("id, title, description, price_usd, condition, category, images, brand, size, source_platform, source_url, needs_photos, imported_at")
      .eq("creator_profile_id", profile.id)
      .eq("status", "draft")
      .order("imported_at", { ascending: false, nullsFirst: false })
      .limit(500),
    (supabase as any)
      .from("import_runs")
      .select("*")
      .eq("creator_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const list = (drafts ?? []) as any[];
  const missingPhotos = list.filter((d) => d.needs_photos || !(d.images?.length)).length;
  const inventoryValue = list.reduce((s, d) => s + (Number(d.price_usd) || 0), 0);

  // Group runs by source for the "Imported From" section.
  const bySource: Record<string, { source: string; runs: number; imported: number; photosSaved: number; photosFailed: number; lastAt: string | null }> = {};
  for (const r of (runs ?? []) as any[]) {
    const k = r.source || "other";
    bySource[k] = bySource[k] || { source: k, runs: 0, imported: 0, photosSaved: 0, photosFailed: 0, lastAt: null };
    bySource[k].runs += 1;
    bySource[k].imported += Number(r.listings_imported) || 0;
    bySource[k].photosSaved += Number(r.photos_saved) || 0;
    bySource[k].photosFailed += Number(r.photos_failed) || 0;
    if (!bySource[k].lastAt || (r.created_at > bySource[k].lastAt!)) bySource[k].lastAt = r.created_at;
  }

  return NextResponse.json({
    drafts: list,
    runs: runs ?? [],
    sources: Object.values(bySource),
    summary: {
      draftCount: list.length,
      missingPhotos,
      inventoryValue: Math.round(inventoryValue),
      photosSaved: ((runs ?? []) as any[]).reduce((s, r) => s + (Number(r.photos_saved) || 0), 0),
      photosFailed: ((runs ?? []) as any[]).reduce((s, r) => s + (Number(r.photos_failed) || 0), 0),
    },
  });
}
