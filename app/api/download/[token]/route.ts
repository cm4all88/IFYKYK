import { NextRequest, NextResponse } from "next/server";

// ──────────────────────────────────────────────────────────────────────────────
// GONE. This route is permanently retired.
//
// It was an unauthenticated, service-role download endpoint whose three access
// guards were all silently inert, because each compared against a column that
// does not exist on `digital_purchases` (verified against production
// 2026-08-05):
//
//   new Date(purchase.token_expires_at) < new Date()
//        -> token_expires_at ABSENT. new Date(undefined) is Invalid Date, and
//           every comparison with NaN is false, so nothing ever expired.
//
//   purchase.download_count >= purchase.max_downloads
//        -> max_downloads ABSENT. `0 >= undefined` is false, so the download
//           limit never triggered.
//
//   purchase.product?.status === "deleted"
//        -> digital_products.status is CHECK-constrained to
//           ('active','draft','archived'); 'deleted' is unreachable.
//
// The result was unauthenticated, unlimited, never-expiring downloads of every
// purchased product, and — for Supabase-hosted products — a redirect to a raw
// object path rather than a signed URL.
//
// The supported path is GET /api/digital/download?token=…, which verifies the
// purchase server-side, enforces `digital_products.download_limit`, and mints a
// short-lived signed URL. There is deliberately NO fallback or redirect from
// here: a compatibility shim would reinstate the bypass this removes.
//
// 410 rather than 404 so any old link in a previously-sent email reports
// "permanently gone" instead of looking like a transient error.
// ──────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE =
  "This download link has been retired for security reasons. " +
  "Please use the download link from your purchase receipt email, " +
  "or contact support and we will re-send it.";

export async function GET(_req: NextRequest) {
  return NextResponse.json({ error: MESSAGE }, { status: 410 });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: MESSAGE }, { status: 410 });
}
