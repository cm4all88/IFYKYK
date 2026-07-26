// Admin-triggered acquisition batch.
//
// Gated by isAdmin() on every call — middleware is routing, not authorization.
// Defaults to a DRY RUN: a caller must pass dryRun:false explicitly to send
// anything, so a mistyped request can never mail a stranger.

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { runAcquisitionBatch } from "@/lib/acquisition-service";
import { DEFAULT_BATCH_SIZE, MAX_NEW_PER_DAY } from "@/lib/acquisition-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Opt IN to sending. Anything other than an explicit false is a dry run.
  const dryRun = body.dryRun !== false;

  const rawLimit = Number(body.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_NEW_PER_DAY)
      : DEFAULT_BATCH_SIZE;

  try {
    const result = await runAcquisitionBatch({
      dryRun,
      limit,
      trigger: dryRun ? "dry_run" : "manual",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error("acquisition run failed:", e);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
