import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes: long enough to start a download, short enough not to be shareable

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const supabase = await createClient();

  const { data: purchase } = await (supabase as any)
    .from("digital_purchases")
    .select("*, product:digital_product_id(title, file_url, file_name, download_limit, storage_provider)")
    .eq("download_token", token)
    .maybeSingle();

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
    const admin = await createServiceClient();
    const { data, error } = await (admin as any).storage
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

  await (supabase as any)
    .from("digital_purchases")
    .update({ download_count: purchase.download_count + 1 })
    .eq("id", purchase.id);

  return NextResponse.redirect(target);
}
