import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { writeOrLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { itemId, buyerMessage } = await req.json();
  if (!itemId) return NextResponse.json({ error: "Missing item ID" }, { status: 400 });

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Must be signed in to gift" }, { status: 401 });

  const { data: item } = await (supabase as any)
    .from("wishlist_items")
    .select("*, creator:creator_profile_id(id, handle)")
    .eq("id", itemId)
    .eq("is_purchased", false)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "Item not available or already gifted" }, { status: 404 });

  // Reserve for 15 minutes to prevent double-buying
  if (item.reserved_until && new Date(item.reserved_until) > new Date() && item.purchased_by_id !== user.id) {
    return NextResponse.json({ error: "Someone else is currently purchasing this. Try again in a few minutes." }, { status: 409 });
  }

  await writeOrLog("wishlist/purchase update wishlist_items", (supabase as any).from("wishlist_items").update({
    reserved_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    purchased_by_id: user.id,
  }).eq("id", itemId));

  const itemPrice = Number(item.price);
  // Service fee: 12% min $3 — this is what Spotlightly keeps
  const serviceFee = Math.max(3, Math.round(itemPrice * 0.12 * 100) / 100);
  const totalCharged = itemPrice + serviceFee;
  const origin = new URL(req.url).origin;

  // Money goes to PLATFORM Stripe account — Spotlightly holds it,
  // then transfers item cost to creator after they confirm purchase
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]":
      `Gift for @${item.creator.handle}: ${item.name}`,
    "line_items[0][price_data][product_data][description]":
      `Item $${itemPrice.toFixed(2)} + $${serviceFee.toFixed(2)} gifting service fee. ` +
      `Spotlightly privately funds this purchase for @${item.creator.handle}.`,
    "line_items[0][price_data][unit_amount]": String(Math.round(totalCharged * 100)),
    "line_items[0][quantity]": "1",
    // No transfer_data — stays in platform account until creator confirms purchase
    "success_url": `${origin}/${item.creator.handle}?gifted=1&item=${encodeURIComponent(item.name)}`,
    "cancel_url": `${origin}/${item.creator.handle}`,
    "client_reference_id": user.id,
    "metadata[wishlist_item_id]": itemId,
    "metadata[creator_profile_id]": item.creator.id,
    "metadata[buyer_user_id]": user.id,
    "metadata[item_price]": String(itemPrice),
    "metadata[service_fee]": String(serviceFee),
    "metadata[buyer_message]": buyerMessage ?? "",
    "metadata[type]": "wishlist_gift",
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    await writeOrLog("wishlist/purchase update wishlist_items", (supabase as any).from("wishlist_items")
      .update({ reserved_until: null, purchased_by_id: null }).eq("id", itemId));
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const session = await stripeRes.json();
  return NextResponse.json({ url: session.url });
}
