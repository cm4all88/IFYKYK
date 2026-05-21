import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const { campaignId, amountUsd, message } = await req.json();
  if (!campaignId || !amountUsd || amountUsd < 1) {
    return NextResponse.json({ error: "Invalid donation" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const supabase = await createClient();

  // Auth optional — guests can support campaigns without an account
  const { data: { user } } = await supabase.auth.getUser();

  const { data: campaign } = await (supabase as any)
    .from("campaigns")
    .select("*, creator:creator_profile_id(handle, stripe_account_id, stripe_onboarded)")
    .eq("id", campaignId)
    .eq("status", "active")
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found or no longer active" }, { status: 404 });
  if (!campaign.creator?.stripe_account_id) return NextResponse.json({ error: "Creator hasn't connected payments yet" }, { status: 503 });

  const origin = new URL(req.url).origin;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Support: ${campaign.title}`,
    "line_items[0][price_data][product_data][description]": campaign.reward_description ?? "Exclusive access for campaign supporters",
    "line_items[0][price_data][unit_amount]": String(Math.round(amountUsd * 100)),
    "line_items[0][quantity]": "1",
    "transfer_data[destination]": campaign.creator.stripe_account_id,
    "success_url": `${origin}/${campaign.creator.handle}?campaign_donated=1`,
    "cancel_url": `${origin}/${campaign.creator.handle}`,
    "metadata[campaign_id]": campaignId,
    "metadata[amount_usd]": String(amountUsd),
    "metadata[message]": message ?? "",
    "metadata[type]": "campaign_donation",
  });

  // Attach donor ID if logged in, skip if guest
  if (user) {
    params.set("client_reference_id", user.id);
    params.set("metadata[donor_user_id]", user.id);
  }

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    console.error("Campaign stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const session = await stripeRes.json();
  return NextResponse.json({ url: session.url });
}
