import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET — list addbacks for a creator profile
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ error: "Missing profileId" }, { status: 400 });

  const { data } = await (supabase as any)
    .from("social_addbacks")
    .select("*")
    .eq("creator_profile_id", profileId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return NextResponse.json({ addbacks: data ?? [] });
}

// POST — create an addback listing
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId, platform, priceUsd, description, deliveryDays } = await req.json();
  if (!profileId || !platform || !priceUsd) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles").select("id").eq("id", profileId).eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data, error } = await (supabase as any)
    .from("social_addbacks")
    .insert({ creator_profile_id: profileId, platform, price_usd: priceUsd, description: description?.trim() || null, delivery_days: deliveryDays ?? 3 })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ addback: data });
}

// DELETE — remove an addback
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await (supabase as any).from("social_addbacks").update({ is_active: false })
    .eq("id", id)
    .eq("creator_profile_id", (await (supabase as any).from("creator_profiles").select("id").eq("user_id", user.id).maybeSingle()).data?.id);

  return NextResponse.json({ ok: true });
}
