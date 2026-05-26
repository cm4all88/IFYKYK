import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const profileId = req.nextUrl.searchParams.get("profileId");
  const mine = req.nextUrl.searchParams.get("mine");

  if (mine) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await (supabase as any)
      .from("creator_profiles").select("id").eq("user_id", user.id).maybeSingle();
    const { data } = await (supabase as any)
      .from("marketplace_listings").select("*")
      .eq("creator_profile_id", profile?.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    return NextResponse.json({ listings: data ?? [] });
  }

  if (!profileId) return NextResponse.json({ error: "Missing profileId" }, { status: 400 });

  const { data } = await (supabase as any)
    .from("marketplace_listings").select("*")
    .eq("creator_profile_id", profileId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return NextResponse.json({ listings: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, priceUsd, condition, category, images, quantity, subscriberOnly, personalNote, autograph } = body;

  if (!title?.trim() || !priceUsd) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const { data, error } = await (supabase as any)
    .from("marketplace_listings")
    .insert({
      creator_profile_id: profile.id,
      title: title.trim(),
      description: description?.trim() || null,
      price_usd: parseFloat(priceUsd),
      condition: condition ?? "good",
      category: category ?? "other",
      images: Array.isArray(images) ? images : [],
      quantity: parseInt(quantity ?? "1"),
      subscriber_only: subscriberOnly ?? false,
      personal_note: personalNote?.trim() || null,
      autograph: autograph ?? false,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles").select("id").eq("user_id", user.id).maybeSingle();

  const { error } = await (supabase as any)
    .from("marketplace_listings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("creator_profile_id", profile?.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
