import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// Creator-facing fulfillment for sold follow-backs.
//   GET  → this creator's paid + delivered orders (who to follow, their note)
//   POST → mark an order delivered, after the creator has followed them back
//
// Both verify ownership explicitly via the creator's own profile ids, so a fan
// who can see their own order (RLS) can never read the fulfillment queue or
// flip a status.

async function creatorProfileIds(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("creator_profiles").select("id").eq("user_id", userId);
  return (data ?? []).map((p: any) => p.id);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Must be signed in" }, { status: 401 });

  const profileIds = await creatorProfileIds(supabase, user.id);
  if (profileIds.length === 0) return NextResponse.json({ orders: [] });

  // Resolve this creator's listings, then their orders. Keeps the query scoped
  // to the creator (no reliance on joined-column filtering) and carries the
  // platform through for display.
  const { data: addbacks } = await (supabase as any)
    .from("social_addbacks").select("id, platform").in("creator_profile_id", profileIds);
  const ids = (addbacks ?? []).map((a: any) => a.id);
  if (ids.length === 0) return NextResponse.json({ orders: [] });
  const platformById: Record<string, string> = Object.fromEntries((addbacks ?? []).map((a: any) => [a.id, a.platform]));

  const { data: orders } = await (supabase as any)
    .from("social_addback_orders")
    .select("id, addback_id, fan_handle, message, amount_usd, status, created_at")
    .in("addback_id", ids)
    .in("status", ["paid", "delivered"])
    .order("created_at", { ascending: false });

  const out = (orders ?? []).map((o: any) => ({
    id: o.id,
    platform: platformById[o.addback_id] ?? null,
    fan_handle: o.fan_handle,
    message: o.message,
    amount_usd: o.amount_usd,
    status: o.status,
    created_at: o.created_at,
  }));

  return NextResponse.json({ orders: out });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Must be signed in" }, { status: 401 });

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  const profileIds = await creatorProfileIds(supabase, user.id);
  if (profileIds.length === 0) return NextResponse.json({ error: "Not a creator" }, { status: 403 });

  // Confirm the order's listing belongs to this creator before touching status.
  const { data: order } = await (supabase as any)
    .from("social_addback_orders")
    .select("id, status, addback:addback_id(creator_profile_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !profileIds.includes(order.addback?.creator_profile_id)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "paid") {
    return NextResponse.json({ error: "Order is not awaiting delivery" }, { status: 409 });
  }

  // social_addback_orders has no creator UPDATE policy, so flip with the
  // service role now that ownership is verified.
  const admin = await createServiceClient();
  await (admin as any).from("social_addback_orders").update({ status: "delivered" }).eq("id", orderId);

  return NextResponse.json({ ok: true });
}
