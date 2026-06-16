import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Tiers are stored in public.subscription_tiers (migration 018).
// Real columns: name, description, price_monthly, price_yearly, perks[],
// color, sort_order, is_active. There are no stripe_* columns here:
// the tier checkout (app/api/subscribe/tier/route.ts) builds the Stripe
// price inline with grossUpForStripe, so nothing is stored here.
//
// Note: the creator dashboard writes tiers to Supabase directly under RLS.
// This route is a server-side mirror of that, kept schema-correct.

async function ownedProfileId(supabase: any, userId: string, creatorProfileId: string) {
  const { data } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("id", creatorProfileId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

// ── GET — list a creator's active tiers ───────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const creatorProfileId = new URL(req.url).searchParams.get("creatorProfileId");
  if (!creatorProfileId) {
    return NextResponse.json({ error: "creatorProfileId required" }, { status: 400 });
  }

  const { data: tiers } = await (supabase as any)
    .from("subscription_tiers")
    .select("*")
    .eq("creator_profile_id", creatorProfileId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("price_monthly", { ascending: true });

  return NextResponse.json({ tiers: tiers ?? [] });
}

// ── POST — create a tier ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const creatorProfileId = String(body?.creatorProfileId || "");
  const name = String(body?.name || "").trim();
  const priceMonthly = Number(body?.price_monthly ?? body?.monthlyPrice);

  if (!creatorProfileId || !name || !priceMonthly || Number.isNaN(priceMonthly) || priceMonthly <= 0) {
    return NextResponse.json({ error: "creatorProfileId, name, and a valid price_monthly are required" }, { status: 400 });
  }

  if (!(await ownedProfileId(supabase, user.id, creatorProfileId))) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const yearlyRaw = body?.price_yearly;
  const priceYearly = yearlyRaw === undefined || yearlyRaw === null || yearlyRaw === ""
    ? null
    : Number(yearlyRaw);

  const perks = Array.isArray(body?.perks)
    ? body.perks.filter((x: any) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
    : typeof body?.perks === "string"
      ? body.perks.split("\n").map((x: string) => x.trim()).filter(Boolean)
      : [];

  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const color = typeof body?.color === "string" && body.color.trim() ? body.color.trim() : null;

  const { count } = await (supabase as any)
    .from("subscription_tiers")
    .select("id", { count: "exact", head: true })
    .eq("creator_profile_id", creatorProfileId);

  const { data: tier, error } = await (supabase as any)
    .from("subscription_tiers")
    .insert({
      creator_profile_id: creatorProfileId,
      name,
      description,
      price_monthly: priceMonthly,
      price_yearly: priceYearly && !Number.isNaN(priceYearly) ? priceYearly : null,
      perks,
      color,
      sort_order: count ?? 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier });
}

// ── PATCH — update a tier ─────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tierId, ...updates } = await req.json().catch(() => ({}));
  if (!tierId) return NextResponse.json({ error: "tierId required" }, { status: 400 });

  const { data: tier } = await (supabase as any)
    .from("subscription_tiers")
    .select("id, creator:creator_profile_id(user_id)")
    .eq("id", tierId)
    .maybeSingle();

  if (!tier || (tier.creator as any)?.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = ["name", "description", "price_monthly", "price_yearly", "perks", "color", "is_active", "sort_order"];
  const clean = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));

  const { data: updated, error } = await (supabase as any)
    .from("subscription_tiers")
    .update(clean)
    .eq("id", tierId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier: updated });
}

// ── DELETE — soft delete (keeps active subscribers) ───────────────
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tierId } = await req.json().catch(() => ({}));
  if (!tierId) return NextResponse.json({ error: "tierId required" }, { status: 400 });

  const { data: tier } = await (supabase as any)
    .from("subscription_tiers")
    .select("id, creator:creator_profile_id(user_id)")
    .eq("id", tierId)
    .maybeSingle();

  if (!tier || (tier.creator as any)?.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await (supabase as any)
    .from("subscription_tiers")
    .update({ is_active: false })
    .eq("id", tierId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
