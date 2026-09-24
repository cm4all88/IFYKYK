import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { loadTransactions, transactionsToCsv } from "@/lib/admin/transactions";
import { handleMap, isUuid, parseDays, parseTxnTypes, resolveCreator } from "@/lib/admin/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const admin = await createServiceClient();
  const days = parseDays(p.get("days") ?? undefined);
  const creator = await resolveCreator(admin, p.get("creator") ?? undefined);
  const fan = p.get("fan");
  const settled = p.get("settled");

  const { rows: all, failures } = await loadTransactions(admin, {
    sinceIso: new Date(Date.now() - days * 86_400_000).toISOString(),
    types: parseTxnTypes(p.get("type") ?? undefined),
    creatorProfileId: creator?.id ?? null,
    fanUserId: isUuid(fan) ? fan : null,
    perSourceLimit: 5000,
  });
  const rows = all.filter((r) => settled === "yes" ? r.settled : settled === "no" ? !r.settled : true);
  const csv = transactionsToCsv(rows, await handleMap(admin, rows.map((r) => r.creator_profile_id)));
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="spotlightly-transactions-${stamp}-${days}d.csv"`,
      "Cache-Control": "no-store",
      ...(failures.length ? { "X-Incomplete-Sources": failures.map((f) => f.type).join(",") } : {}),
    },
  });
}
