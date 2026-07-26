// Daily acquisition cron: new outreach plus any follow-ups that fell due.
//
// Schedule this in the Vercel dashboard alongside the existing crons (this
// repo has no vercel.json; adding one would override dashboard config for
// billing-dunning, live-billing and publish-scheduled):
//
//   Path: /api/cron/acquisition   Schedule: 0 16 * * *   (16:00 UTC daily)
//
// Authorization is CRON_SECRET, matching every other cron route here. The
// runner additionally refuses to send unless platform_settings
// .acquisition_runner_enabled is 'on', so a leaked schedule alone cannot mail
// anyone.

import { NextRequest, NextResponse } from "next/server";
import { runAcquisitionBatch } from "@/lib/acquisition-service";
import { MAX_NEW_PER_DAY } from "@/lib/acquisition-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAcquisitionBatch({
      dryRun: false,
      limit: MAX_NEW_PER_DAY,
      trigger: "cron",
    });

    return NextResponse.json({
      ok: true,
      emailsSent: result.emailsSent,
      followUps: result.followUps,
      pagesCreated: result.pagesCreated,
      skipped: result.skipped.length,
      failed: result.failed.length,
      paused: result.paused,
      pauseReason: result.pauseReason,
      blocked: result.blocked,
    });
  } catch (e: unknown) {
    // Never 500 a cron into a retry storm; log and report.
    console.error("acquisition cron failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 200 }
    );
  }
}
