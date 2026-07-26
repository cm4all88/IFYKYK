import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { dedupeImportRows, parseProspectCsv } from "@/lib/prospect-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CSV prospect import.
 *
 * Rows that fail validation are reported with their line number rather than
 * silently dropped, and rows that collide with existing prospects are skipped
 * rather than overwriting them — an import must never clobber notes, stage,
 * or contact controls already recorded against a person.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const csv = typeof body?.csv === "string" ? body.csv : "";
  if (!csv.trim()) return NextResponse.json({ error: "Paste or upload a CSV first." }, { status: 400 });

  const defaultSource = typeof body?.source === "string" && body.source ? body.source : "csv";
  const parsed = parseProspectCsv(csv, defaultSource);

  // A file that produced nothing usable is an error, not a silent no-op.
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error: "No usable rows found.",
        errors: parsed.errors,
        unknownHeaders: parsed.unknownHeaders,
        totalDataLines: parsed.totalDataLines,
      },
      { status: 400 }
    );
  }

  const { kept, duplicates } = dedupeImportRows(parsed.rows);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = await createServiceClient();

  // Insert one at a time so a single bad row cannot abort the whole file,
  // and so an existing prospect is reported as skipped rather than replaced.
  let inserted = 0;
  let skippedExisting = 0;
  const failures: { line: number | null; errors: string[] }[] = [];

  for (const row of kept) {
    const { error } = await (admin as any)
      .from("creator_prospects")
      .insert({ ...row, discovered_by: user?.id ?? null });

    if (!error) { inserted++; continue; }

    const msg = String((error as any).message || "");
    if (msg.includes("creator_prospects_email_key") || msg.includes("creator_prospects_platform_key")) {
      skippedExisting++;
    } else {
      failures.push({ line: null, errors: [`${row.display_name}: could not be saved.`] });
    }
  }

  return NextResponse.json({
    ok: true,
    inserted,
    skippedExisting,
    duplicatesInFile: duplicates,
    invalidRows: parsed.errors,
    unknownHeaders: parsed.unknownHeaders,
    totalDataLines: parsed.totalDataLines,
    failures,
  });
}
