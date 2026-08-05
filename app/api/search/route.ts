import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const tags = searchParams.getAll("tag");
  const country = searchParams.get("country")?.trim();
  const city = searchParams.get("city")?.trim();
  const limit = Math.min(48, parseInt(searchParams.get("limit") ?? "24"));
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const supabase = await createClient();

  let query = (supabase as any)
    .from("creator_public")
    .select("id, handle, display_name, bio, avatar_url, subscription_price, tags, location_city, location_country")
    .eq("kind", "spotlight")
    .not("onboarding_completed_at", "is", null);

  // Full-text search
  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch" });
  }

  // Tag filter — must overlap with requested tags
  if (tags.length > 0) {
    query = query.overlaps("tags", tags);
  }

  // Location filters
  if (country) {
    query = query.ilike("location_country", country);
  }
  if (city) {
    query = query.ilike("location_city", `%${city}%`);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: creators, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ creators: creators ?? [], total: creators?.length ?? 0 });
}
