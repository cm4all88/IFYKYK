import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const supabase = await createClient();

  // Find purchase by token
  const { data: purchase } = await (supabase as any)
    .from("digital_purchases")
    .select("*, product:digital_product_id(title, file_url, file_name, download_limit)")
    .eq("download_token", token)
    .maybeSingle();

  if (!purchase) {
    return NextResponse.json({ error: "Invalid or expired download link" }, { status: 404 });
  }

  // Check download limit
  if (purchase.product.download_limit && purchase.download_count >= purchase.product.download_limit) {
    return NextResponse.json({ error: "Download limit reached. Contact support." }, { status: 403 });
  }

  if (!purchase.product.file_url) {
    return NextResponse.json({ error: "File not yet available" }, { status: 404 });
  }

  // Increment download count
  await (supabase as any)
    .from("digital_purchases")
    .update({ download_count: purchase.download_count + 1 })
    .eq("id", purchase.id);

  // Redirect to the file URL
  // If using BunnyCDN private storage, generate a signed URL here
  // For now, redirect directly — replace with signed URL logic when BunnyCDN is configured
  return NextResponse.redirect(purchase.product.file_url);
}
