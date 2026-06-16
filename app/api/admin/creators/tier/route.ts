import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const creatorId = String(body?.creator_profile_id || "");
  const name = String(body?.name || "").trim();
  const monthly = Number(body?.price_monthly);
  if (!creatorId) return NextResponse.json({ error: "Missing creator" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Tier name required." }, { status: 400 });
  if (!monthly || Number.isNaN(monthly) || monthly <= 0) return NextResponse.json({ error: "Valid monthly price required." }, { status: 400 });

  const yearlyRaw = body?.price_yearly;
  const yearly = yearlyRaw === undefined || yearlyRaw === null || yearlyRaw === "" ? null : Number(yearlyRaw);
  const perks = Array.isArray(body?.perks)
    ? body.perks.filter((x: any) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
    : typeof body?.perks === "string"
      ? body.perks.split(",").map((x: string) => x.trim()).filter(Boolean)
      : [];
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;

  const admin = await createServiceClient();
  const { count } = await (admin as any)
    .from("subscription_tiers").select("id", { count: "exact", head: true }).eq("creator_profile_id", creatorId);

  const { data, error } = await (admin as any).from("subscription_tiers").insert({
    creator_profile_id: creatorId,
    name,
    description,
    price_monthly: monthly,
    price_yearly: yearly && !Number.isNaN(yearly) ? yearly : null,
    perks,
    sort_order: count ?? 0,
    is_active: true,
  }).select("id, name, description, price_monthly, price_yearly, perks").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tier: data });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const updates: any = {};
  if (typeof body?.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if ("description" in body) updates.description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  if (body?.price_monthly !== undefined && body?.price_monthly !== "") {
    const m = Number(body.price_monthly);
    if (!Number.isNaN(m) && m > 0) updates.price_monthly = m;
  }
  if ("price_yearly" in body) {
    const raw = body.price_yearly;
    const y = raw === "" || raw === null || raw === undefined ? null : Number(raw);
    updates.price_yearly = y && !Number.isNaN(y) ? y : null;
  }
  if ("perks" in body) {
    updates.perks = Array.isArray(body.perks)
      ? body.perks.filter((x: any) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
      : typeof body.perks === "string"
        ? body.perks.split("\n").map((x: string) => x.trim()).filter(Boolean)
        : [];
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const admin = await createServiceClient();
  const { data, error } = await (admin as any).from("subscription_tiers").update(updates).eq("id", id)
    .select("id, name, description, price_monthly, price_yearly, perks").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tier: data });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const admin = await createServiceClient();
  const { error } = await (admin as any).from("subscription_tiers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
