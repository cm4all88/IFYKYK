import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { createNotification } from "@/lib/notify";
import { sendTipEmail } from "@/lib/email";

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

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("handle, stripe_account_id, stripe_onboarded")
    .eq("id", creatorProfileId)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  if (!profile.stripe_account_id || !profile.stripe_onboarded) {
    return NextResponse.json({ error: "Creator has not connected Stripe yet." }, { status: 503 });
  }

  const origin = new URL(req.url).origin;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Tip for @${profile.handle}`,
    "line_items[0][price_data][unit_amount]": String(Math.round(amountUsd * 100)),
    "line_items[0][quantity]": "1",
    // 100% to creator — Spotlightly takes nothing from tips
    "transfer_data[destination]": profile.stripe_account_id,
    "success_url": `${origin}/${profile.handle}?tipped=1`,
    "cancel_url": `${origin}/${profile.handle}`,
    "metadata[creator_profile_id]": creatorProfileId,
    "metadata[type]": "tip",
    "metadata[amount_usd]": String(amountUsd),
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
  // Notify creator
  const { data: cp } = await (supabase as any)
    .from("creator_profiles").select("user_id").eq("id", creatorProfileId).maybeSingle();
  if (cp?.user_id) {
    await createNotification({ userId: cp.user_id, type: "tip", title: `New tip — $${amountUsd.toFixed(0)}`, link: "/dashboard" });
    // Get creator email and send notification
    const { data: { user: creatorUser } } = await (supabase as any).auth.admin.getUserById(cp.user_id).catch(() => ({ data: { user: null } }));
    if (creatorUser?.email) {
      await sendTipEmail(creatorUser.email, "A fan", `$${amountUsd.toFixed(2)}`).catch(() => {});
    }
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
