import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { writeOrLog } from "@/lib/db";

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
    .select("*, product:digital_product_id(id, title, file_url, file_name, download_limit, storage_provider, bundled_product_ids)")
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

  const bundleIds: string[] = purchase.product.bundled_product_ids ?? [];
  const isBundle = bundleIds.length > 0;
  const requestedItem = new URL(req.url).searchParams.get("item");

  // A bundle has no file of its own. Without a specific item, hand back a page
  // listing everything the buyer owns, each linking back here with ?item=.
  if (isBundle && !requestedItem) {
    const { data: items } = await (supabase as any)
      .from("digital_products")
      .select("id, title, file_name")
      .in("id", bundleIds);

    const rows = (items ?? [])
      .map(
        (it: any) =>
          `<li><a href="/api/digital/download?token=${encodeURIComponent(token)}&item=${encodeURIComponent(it.id)}">${escapeHtml(it.title)}</a>${
            it.file_name ? ` <span class="f">${escapeHtml(it.file_name)}</span>` : ""
          }</li>`
      )
      .join("");

    return new NextResponse(bundlePage(purchase.product.title, rows), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  // Resolve which product's bytes we are actually serving.
  let deliver = purchase.product;
  if (isBundle && requestedItem) {
    if (!bundleIds.includes(requestedItem)) {
      return NextResponse.json({ error: "That item is not part of this purchase" }, { status: 403 });
    }
    const { data: item } = await (supabase as any)
      .from("digital_products")
      .select("id, title, file_url, file_name, storage_provider")
      .eq("id", requestedItem)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    deliver = item;
  }

  if (!deliver.file_url) {
    return NextResponse.json({ error: "File not yet available" }, { status: 404 });
  }

  // Mint the link BEFORE counting the download, so a signing failure does not
  // silently burn one of the buyer's downloads.
  let target: string;

  if (deliver.storage_provider === "supabase") {
    // file_url is an object path inside the private bucket. Signing needs the
    // service role: the buyer has no read policy on someone else's folder.
    const { data, error } = await (supabase as any).storage
      .from("digital-products")
      .createSignedUrl(deliver.file_url, SIGNED_URL_TTL_SECONDS, {
        download: deliver.file_name || true,
      });

    if (error || !data?.signedUrl) {
      console.error("Signed URL failed:", error);
      return NextResponse.json({ error: "Could not prepare the download. Try again." }, { status: 500 });
    }
    target = data.signedUrl;
  } else {
    // Legacy products still on BunnyCDN.
    target = deliver.file_url;
  }

  // Link previews and prefetchers send HEAD or a purpose hint. Those are not
  // downloads and must not count against a buyer's limit.
  const purpose = req.headers.get("purpose") || req.headers.get("sec-purpose") || "";
  const isPrefetch = /prefetch|preview/i.test(purpose);

  if (!isPrefetch) {
    await writeOrLog("digital/download update digital_purchases", (supabase as any)
      .from("digital_purchases")
      .update({ download_count: purchase.download_count + 1 })
      .eq("id", purchase.id));
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


function escapeHtml(v: string): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

/** Deliberately plain and self-contained: this page is opened from an email. */
function bundlePage(title: string, rows: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body{background:#0a0a0f;color:#f2f2f0;font-family:system-ui,-apple-system,sans-serif;margin:0;padding:48px 20px;line-height:1.6}
  .w{max-width:520px;margin:0 auto}
  h1{font-size:24px;font-weight:500;margin:0 0 6px}
  p{color:#71717a;font-size:14px;margin:0 0 28px}
  ul{list-style:none;padding:0;margin:0}
  li{border:1px solid rgba(255,255,255,.08);border-radius:8px;margin-bottom:8px}
  li a{display:block;padding:16px 18px;color:#F0B429;text-decoration:none;font-weight:600;font-size:15px}
  li a:hover{background:rgba(240,180,41,.06)}
  .f{display:block;color:#71717a;font-weight:400;font-size:12px;margin-top:3px}
  .n{color:#71717a;font-size:12px;margin-top:28px}
</style></head><body><div class="w">
<h1>${escapeHtml(title)}</h1>
<p>Everything in your bundle. Click each one to download.</p>
<ul>${rows}</ul>
<p class="n">Keep this page bookmarked. The links stay valid.</p>
</div></body></html>`;
}
