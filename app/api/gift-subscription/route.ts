import { NextRequest, NextResponse } from "next/server";
import { getPayeeCreator } from "@/lib/payee";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { grossUpForStripe } from "@/lib/fees";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to gift a subscription" }, { status: 401 });

  const { creatorProfileId, recipientEmail, months } = await req.json();
  if (!creatorProfileId || !recipientEmail || !months) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (months < 1 || months > 12) {
    return NextResponse.json({ error: "Months must be between 1 and 12" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  // Connect routing data. Read with the service role via lib/payee.ts:
  // migration 064 removes anon read on creator_profiles, and guests can pay,
  // so this cannot come from the cookie client any more.
  const profile = await getPayeeCreator(creatorProfileId);

  if (!profile?.stripe_account_id || !profile.stripe_onboarded) {
    return NextResponse.json({ error: "Creator hasn't connected payments" }, { status: 503 });
  }

  const pricePerMonth = Number(profile.subscription_price ?? 9.99);
  const totalUsd = pricePerMonth * months;
  const totalCents = Math.round(totalUsd * 100);
  const fanCents = grossUpForStripe(totalCents); // fan covers the card fee
  const origin = new URL(req.url).origin;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Gift: ${months} month${months > 1 ? "s" : ""} of @${profile.handle}`,
    "line_items[0][price_data][product_data][description]": `A subscription gift for ${recipientEmail}`,
    "line_items[0][price_data][unit_amount]": String(fanCents),
    "line_items[0][quantity]": "1",
    "payment_intent_data[transfer_data][destination]": profile.stripe_account_id,
    "payment_intent_data[transfer_data][amount]": String(totalCents),
    "success_url": `${origin}/${profile.handle}?gift_sent=1`,
    "cancel_url": `${origin}/${profile.handle}`,
    "client_reference_id": user.id,
    "metadata[type]": "gift_subscription",
    "metadata[creator_profile_id]": creatorProfileId,
    "metadata[gifter_user_id]": user.id,
    "metadata[recipient_email]": recipientEmail.toLowerCase().trim(),
    "metadata[months]": String(months),
    "metadata[amount_usd]": String(totalUsd),
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
