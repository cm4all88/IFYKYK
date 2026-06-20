import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { SUPER_TIP_MIN_CENTS, dollars, grossUpForStripe, superTipRecognitionCents } from "@/lib/fees";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { creatorProfileId, amountUsd, message, fanDisplayName } = await req.json();
  if (!creatorProfileId || !amountUsd || Math.round(amountUsd * 100) < SUPER_TIP_MIN_CENTS) {
    return NextResponse.json({ error: `Minimum super tip is ${dollars(SUPER_TIP_MIN_CENTS)}` }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("handle, stripe_account_id, stripe_onboarded")
    .eq("id", creatorProfileId)
    .maybeSingle();

  if (!profile?.stripe_account_id || !profile.stripe_onboarded) {
    return NextResponse.json({ error: "Creator hasn't connected payments" }, { status: 503 });
  }

  // Creator receives 100% of the tip. The platform's only revenue is a recognition
  // fee the fan pays ON TOP, for the badge / pin / highlight. Fan also covers Stripe.
  const tipCents = Math.round(amountUsd * 100);                      // creator nets this
  const recognitionCents = superTipRecognitionCents(tipCents);      // platform keeps this
  const totalCents = grossUpForStripe(tipCents + recognitionCents); // what the fan pays
  const origin = new URL(req.url).origin;

  const displayName = fanDisplayName?.trim() || (user ? "A fan" : "Anonymous");

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `⭐ Super Tip for @${profile.handle}`,
    "line_items[0][price_data][product_data][description]": `From ${displayName}${message ? `: ${message.slice(0, 80)}` : ""}`,
    "line_items[0][price_data][unit_amount]": String(totalCents),
    "line_items[0][quantity]": "1",
    // Creator gets the full tip; the platform keeps the recognition fee from the remainder.
    "payment_intent_data[transfer_data][destination]": profile.stripe_account_id,
    "payment_intent_data[transfer_data][amount]": String(tipCents),
    "success_url": `${origin}/${profile.handle}?super_tipped=1`,
    "cancel_url": `${origin}/${profile.handle}`,
    "metadata[type]": "super_tip",
    "metadata[creator_profile_id]": creatorProfileId,
    "metadata[fan_user_id]": user?.id ?? "",
    "metadata[fan_display_name]": displayName,
    "metadata[message]": message?.trim()?.slice(0, 500) ?? "",
    "metadata[amount_usd]": String(amountUsd),
    "metadata[recognition_usd]": (recognitionCents / 100).toFixed(2),
    "metadata[fan_paid_usd]": (totalCents / 100).toFixed(2),
  });

  if (user) params.set("client_reference_id", user.id);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Super tip Stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const session = await res.json();
  return NextResponse.json({ url: session.url });
}
