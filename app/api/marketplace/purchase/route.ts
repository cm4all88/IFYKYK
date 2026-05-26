import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

const PLATFORM_FEE = 0.05; // 5%

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Must be signed in to purchase" }, { status: 401 });

  const { listingId, shippingAddress } = await req.json();
  if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });

  const { data: listing } = await (supabase as any)
    .from("marketplace_listings")
    .select("*, creator:creator_profile_id(handle, display_name, stripe_account_id, stripe_onboarded, user_id)")
    .eq("id", listingId)
    .eq("status", "active")
    .maybeSingle();

  if (!listing) return NextResponse.json({ error: "Listing not found or sold" }, { status: 404 });
  if (listing.quantity < 1) return NextResponse.json({ error: "Item is sold out" }, { status: 400 });
  if (!listing.creator?.stripe_onboarded) return NextResponse.json({ error: "Creator hasn't connected payments" }, { status: 503 });

  // Check subscriber only
  if (listing.subscriber_only) {
    const { count } = await (supabase as any)
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("creator_profile_id", listing.creator_profile_id)
      .eq("fan_user_id", user.id)
      .eq("status", "active");
    if (!count) return NextResponse.json({ error: "This item is for subscribers only" }, { status: 403 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
  const amountCents = Math.round(listing.price_usd * 100);
  const feeCents = Math.round(amountCents * PLATFORM_FEE);

  const params = new URLSearchParams({
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": listing.title,
    "line_items[0][price_data][product_data][description]": listing.description || `From @${listing.creator.handle}`,
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${appUrl}/${listing.creator.handle}?purchase=success`,
    cancel_url: `${appUrl}/${listing.creator.handle}`,
    "payment_intent_data[application_fee_amount]": String(feeCents),
    "payment_intent_data[transfer_data][destination]": listing.creator.stripe_account_id,
    "shipping_address_collection[allowed_countries][0]": "US",
    "shipping_address_collection[allowed_countries][1]": "CA",
    "shipping_address_collection[allowed_countries][2]": "GB",
    "shipping_address_collection[allowed_countries][3]": "AU",
    "metadata[type]": "marketplace",
    "metadata[listing_id]": listingId,
    "metadata[buyer_user_id]": user.id,
    "metadata[creator_user_id]": listing.creator.user_id,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const session = await res.json();
  if (!res.ok) return NextResponse.json({ error: session.error?.message ?? "Checkout failed" }, { status: 500 });

  // Record order
  await (supabase as any).from("marketplace_orders").insert({
    listing_id: listingId,
    buyer_user_id: user.id,
    buyer_email: user.email,
    amount_usd: listing.price_usd,
    platform_fee_usd: listing.price_usd * PLATFORM_FEE,
    stripe_session_id: session.id,
  });

  return NextResponse.json({ url: session.url });
}
