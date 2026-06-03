import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { getPack } from "@/lib/medals";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to buy medals" }, { status: 401 });

  const { packId, returnTo } = await req.json();
  const pack = getPack(packId);
  if (!pack) return NextResponse.json({ error: "Invalid pack" }, { status: 400 });

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const origin = new URL(req.url).origin;
  const back = typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "/feed";

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `${pack.medals} Medals`,
    "line_items[0][price_data][product_data][description]": "Medals to award standout posts. No cash value; non-refundable.",
    "line_items[0][price_data][unit_amount]": String(Math.round(pack.price * 100)),
    "line_items[0][quantity]": "1",
    "success_url": `${origin}${back}?medals=purchased`,
    "cancel_url": `${origin}${back}`,
    "client_reference_id": user.id,
    "metadata[type]": "medal_pack",
    "metadata[pack_id]": pack.id,
    "metadata[medals]": String(pack.medals),
    "metadata[fan_user_id]": user.id,
    "metadata[amount_usd]": String(pack.price),
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  const session = await res.json();
  return NextResponse.json({ url: session.url });
}
