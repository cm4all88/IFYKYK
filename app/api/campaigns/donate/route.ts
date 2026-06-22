import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { grossUpForStripe } from "@/lib/fees";
import { tierNeedsCode, generateBackerCode } from "@/lib/campaign-rewards";

export async function POST(req: NextRequest) {
  const { campaignId, amountUsd, message, tierId } = await req.json();
  if (!campaignId) {
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

  // ── Resolve the charge amount ────────────────────────────────────
  // If a tier is chosen, the price is the tier's amount (server-trusted —
  // never the client value). Otherwise it's a name-your-own-amount backing.
  let amount: number;
  let tier: any = null;
  let backerCode: string | null = null;

  if (tierId) {
    const { data: t } = await (supabase as any)
      .from("campaign_tiers")
      .select("*")
      .eq("id", tierId)
      .eq("campaign_id", campaignId)
      .maybeSingle();
    if (!t) return NextResponse.json({ error: "That tier is no longer available" }, { status: 404 });
    tier = t;
    amount = Number(t.amount);

    // Enforce a backer cap if the creator set one
    if (t.backer_limit != null) {
      const { count } = await (supabase as any)
        .from("campaign_donations")
        .select("id", { count: "exact", head: true })
        .eq("tier_id", tierId);
      if ((count ?? 0) >= t.backer_limit) {
        return NextResponse.json({ error: "This tier is fully claimed" }, { status: 409 });
      }
    }

    if (tierNeedsCode(t.rewards)) backerCode = generateBackerCode();
  } else {
    amount = Number(amountUsd);
    if (!amount || amount < 1) {
      return NextResponse.json({ error: "Invalid donation" }, { status: 400 });
    }
  }

  const origin = new URL(req.url).origin;
  const donationCents = Math.round(amount * 100);
  const fanCents = grossUpForStripe(donationCents); // fan covers the card fee

  const productName = tier ? `${campaign.title} · ${tier.title}` : `Support: ${campaign.title}`;
  const productDesc = tier
    ? (tier.description || "Campaign backing tier")
    : (campaign.reward_description ?? "Exclusive access for campaign supporters");

  const successUrl = `${origin}/${campaign.creator.handle}?campaign_donated=1${backerCode ? `&backer_code=${backerCode}` : ""}`;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": productName,
    "line_items[0][price_data][product_data][description]": productDesc,
    "line_items[0][price_data][unit_amount]": String(fanCents),
    "line_items[0][quantity]": "1",
    "payment_intent_data[transfer_data][destination]": campaign.creator.stripe_account_id,
    "payment_intent_data[transfer_data][amount]": String(donationCents),
    "success_url": successUrl,
    "cancel_url": `${origin}/${campaign.creator.handle}`,
    "metadata[campaign_id]": campaignId,
    "metadata[amount_usd]": String(amount),
    "metadata[message]": message ?? "",
    "metadata[type]": "campaign_donation",
  });

  if (tier) {
    params.set("metadata[tier_id]", tierId);
    params.set("metadata[tier_title]", tier.title);
  }
  if (backerCode) params.set("metadata[backer_code]", backerCode);

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
