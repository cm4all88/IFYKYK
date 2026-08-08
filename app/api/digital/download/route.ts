import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// An hour. The signed URL is minted per request, so this only needs to outlast a
// single download, but a large file on a slow connection can take a while and an
// expiry mid-transfer looks identical to a broken link.
const SIGNED_URL_TTL_SECONDS = 3600;

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  // Service role. The download token is itself the credential: 24 random bytes,
  // unique on the table, handed to exactly one buyer by email. Running this
  // lookup as anon meant RLS on digital_purchases (fan_user_id = auth.uid())
  // denied it for every logged-out buyer, and the route reported a perfectly
  // valid token as invalid.
  const supabase = await createServiceClient();

  const { data: purchase, error: lookupErr } = await (supabase as any)
    .from("digital_purchases")
    .select("*, product:digital_product_id(title, file_url, file_name, download_limit, storage_provider)")
    .eq("download_token", token)
    .maybeSingle();

  if (lookupErr) {
    console.error("Download lookup failed:", lookupErr);
    return NextResponse.json({ error: "Could not look up this download. Try again." }, { status: 500 });
  }
  if (!purchase) {
    return NextResponse.json({ error: "Invalid or expired download link" }, { status: 404 });
  }

  if (purchase.product.download_limit && purchase.download_count >= purchase.product.download_limit) {
    return NextResponse.json({ error: "Download limit reached. Contact support." }, { status: 403 });
  }

  if (!purchase.product.file_url) {
    return NextResponse.json({ error: "File not yet available" }, { status: 404 });
  }

  // Mint the link BEFORE counting the download, so a signing failure does not
  // silently burn one of the buyer's downloads.
  let target: string;

  if (purchase.product.storage_provider === "supabase") {
    // file_url is an object path inside the private bucket. Signing needs the
    // service role: the buyer has no read policy on someone else's folder.
    const { data, error } = await (supabase as any).storage
      .from("digital-products")
      .createSignedUrl(purchase.product.file_url, SIGNED_URL_TTL_SECONDS, {
        download: purchase.product.file_name || true,
      });

    if (error || !data?.signedUrl) {
      console.error("Signed URL failed:", error);
      return NextResponse.json({ error: "Could not prepare the download. Try again." }, { status: 500 });
    }
    target = data.signedUrl;
  } else {
    // Legacy products still on BunnyCDN.
    target = purchase.product.file_url;
  }

  // Link previews and prefetchers send HEAD or a purpose hint. Those are not
  // downloads and must not count against a buyer's limit.
  const purpose = req.headers.get("purpose") || req.headers.get("sec-purpose") || "";
  const isPrefetch = /prefetch|preview/i.test(purpose);

  if (!isPrefetch) {
    await (supabase as any)
      .from("digital_purchases")
      .update({ download_count: purchase.download_count + 1 })
      .eq("id", purchase.id);
  }

  // Never let this redirect be cached. A cached 307 replays a signed URL that has
  // already expired, so the first click works and every later one dies with an
  // InvalidJWT from storage. It is also why download_count was incrementing
  // twice: prefetchers hit the route, cached the redirect, and burned a count
  // before the buyer clicked anything.
  const res = NextResponse.redirect(target, { status: 302 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Vercel-CDN-Cache-Control", "no-store");
  res.headers.set("Pragma", "no-cache");
  return res;
}
