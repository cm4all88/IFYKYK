import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Public: a creator's active merch products, for their storefront rail.
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ products: [] });

  const supabase = await createClient();

  const { data } = await (supabase as any)
    .from("merch_products")
    .select("id, name, description, design_url, retail_price, category, mockup_urls, status")
    .eq("creator_profile_id", profileId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return NextResponse.json({ products: data ?? [] });
}
