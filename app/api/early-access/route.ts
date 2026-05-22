import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

const EARLY_ACCESS_PRICE_CENTS = 299; // $2.99/mo — 100% to platform

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to purchase Early Access" }, { status: 401 });

  const { creatorProfileId } = await req.json();
  if (!creatorProfileId) return NextResponse.json({ error: "Missing creator" }, { status: 400 });

  // Already have early access?
  const { data: existing } = await (supabase as any)
    .from("early_access_passes")
    .select("id, status")
    .eq("fan_user_id", user.id)
    .eq("creator_profile_id", creatorProfileId)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "You already have Early Access for this creator" }, { status: 409 });
  }

  const { STRIPE_SECRET_KEY, EARLY_ACCESS_PRICE_ID } = await getSecrets([
    "STRIPE_SECRET_KEY",
    "EARLY_ACCESS_PRICE_ID",
  ]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("handle")
    .eq("id", creatorProfileId)
    .maybeSingle();

  const origin = new URL(req.url).origin;

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", `${origin}/${profile?.handle ?? ""}?early_access=1`);
  params.set("cancel_url", `${origin}/${profile?.handle ?? ""}`);
  params.set("client_reference_id", user.id);
  params.set("metadata[type]", "early_access");
  params.set("metadata[creator_profile_id]", creatorProfileId);
  params.set("metadata[fan_user_id]", user.id);

  if (EARLY_ACCESS_PRICE_ID) {
    params.set("line_items[0][price]", EARLY_ACCESS_PRICE_ID);
    params.set("line_items[0][quantity]", "1");
  } else {
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][product_data][name]", `Early Access Pass · @${profile?.handle ?? "creator"}`);
    params.set("line_items[0][price_data][product_data][description]", "See posts 30 minutes before everyone else");
    params.set("line_items[0][price_data][unit_amount]", String(EARLY_ACCESS_PRICE_CENTS));
    params.set("line_items[0][price_data][recurring][interval]", "month");
    params.set("line_items[0][quantity]", "1");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  const session = await res.json();
  return NextResponse.json({ url: session.url });
}
