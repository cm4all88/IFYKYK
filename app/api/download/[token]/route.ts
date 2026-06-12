import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = await createClient();
  const { token } = params;

  if (!token) return NextResponse.redirect(new URL("/", req.url));

  // Look up the purchase by token
  const { data: purchase } = await (supabase as any)
    .from("digital_purchases")
    .select("*, product:digital_product_id(file_url, file_name, title, status)")
    .eq("download_token", token)
    .maybeSingle();

  if (!purchase) {
    return new NextResponse("Download link not found or expired.", { status: 404 });
  }

  if (purchase.product?.status === "deleted") {
    return new NextResponse("This product is no longer available.", { status: 410 });
  }

  if (new Date(purchase.token_expires_at) < new Date()) {
    return new NextResponse("This download link has expired. Contact the creator for a new one.", { status: 410 });
  }

  if (purchase.download_count >= purchase.max_downloads) {
    return new NextResponse(
      `Download limit reached (${purchase.max_downloads} downloads). Contact the creator if you need more downloads.`,
      { status: 429 }
    );
  }

  // Increment download count
  await (supabase as any)
    .from("digital_purchases")
    .update({ download_count: purchase.download_count + 1 })
    .eq("id", purchase.id);

  // Redirect to the actual file
  // In production this would use a signed CDN URL for extra security
  return NextResponse.redirect(purchase.product.file_url);
}
