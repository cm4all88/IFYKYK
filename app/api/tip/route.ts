import { NextRequest, NextResponse } from "next/server";
import { getPayeeCreator } from "@/lib/payee";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { createNotification } from "@/lib/notify";
import { sendTipEmail } from "@/lib/email";
import { grossUpForStripe } from "@/lib/fees";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const creatorProfileId = formData.get("creator_profile_id");
  const amountUsd = Math.max(1, Math.min(1000, Number(formData.get("amount_usd")) || 5));

  if (typeof creatorProfileId !== "string") {
    return NextResponse.json({ error: "Missing creator_profile_id" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Tipping not yet available." }, { status: 503 });
  }

  const supabase = await createClient();

  // Auth is optional — guests can tip without an account
  const { data: { user } } = await supabase.auth.getUser();

  // Connect routing data. Read with the service role via lib/payee.ts:
  // migration 064 removes anon read on creator_profiles, and guests can pay,
  // so this cannot come from the cookie client any more.
  const profile = await getPayeeCreator(creatorProfileId);

  if (!profile) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  if (!profile.stripe_account_id || !profile.stripe_onboarded) {
    return NextResponse.json({ error: "Creator has not connected Stripe yet." }, { status: 503 });
  }

  const origin = new URL(req.url).origin;

  // Fan covers the card fee so the creator receives the FULL tip and
  // Spotlightly nets ~$0. Gross up the fan's charge by Stripe's standard
  // US card rate (2.9% + $0.30), then cap the creator transfer to the tip.
  const tipCents = Math.round(amountUsd * 100);
  const totalCents = grossUpForStripe(tipCents); // what the fan pays
  const feeCents = totalCents - tipCents;                       // covers Stripe

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Tip for @${profile.handle}`,
    "line_items[0][price_data][product_data][description]": `Includes a $${(feeCents / 100).toFixed(2)} card fee so your full $${amountUsd.toFixed(2)} reaches @${profile.handle}.`,
    "line_items[0][price_data][unit_amount]": String(totalCents),
    "line_items[0][quantity]": "1",
    // Creator receives the full tip; the grossed-up fee stays on the platform to cover Stripe.
    "payment_intent_data[transfer_data][destination]": profile.stripe_account_id,
    "payment_intent_data[transfer_data][amount]": String(tipCents),
    "success_url": `${origin}/${profile.handle}?tipped=1`,
    "cancel_url": `${origin}/${profile.handle}`,
    "metadata[creator_profile_id]": creatorProfileId,
    "metadata[type]": "tip",
    "metadata[amount_usd]": String(amountUsd),
    "metadata[fan_paid_usd]": (totalCents / 100).toFixed(2),
  });

  // Attach fan ID if logged in, skip if guest
  if (user) {
    params.set("client_reference_id", user.id);
    params.set("metadata[fan_user_id]", user.id);
  }

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    console.error("Stripe tip error:", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const session = await stripeRes.json();

  // NOTE (SL-022, not fixed in this batch): this notifies the creator at
  // checkout-session creation, BEFORE any payment. The webhook's tip branch
  // notifies again on the real event, so a genuine tip notifies twice and an
  // abandoned checkout notifies once for money that never arrived. Moving this
  // into the webhook is a behavioural change to a payment path and is out of
  // scope for the emergency batch. Recorded in BATCH_0_CHANGES.md.
  //
  // The owner comes from the payee lookup we already did — no second read of
  // creator_profiles, which anon can no longer perform after migration 064.
  if (profile.user_id) {
    await createNotification({ userId: profile.user_id, type: "tip", title: `New tip — $${amountUsd.toFixed(0)}`, link: "/dashboard" });
    // Creator email. `auth.admin` needs the service role — on the cookie client
    // this call always failed and the .catch swallowed it, so this email has
    // never been sent (SL-046).
    const { createServiceClient } = await import("@/lib/supabase-server");
    const admin = await createServiceClient();
    const { data: { user: creatorUser } } = await (admin as any).auth.admin.getUserById(profile.user_id).catch(() => ({ data: { user: null } }));
    if (creatorUser?.email) {
      await sendTipEmail(creatorUser.email, "A fan", `$${amountUsd.toFixed(2)}`).catch(() => {});
    }
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
