import { NextRequest, NextResponse } from "next/server";
import { getPayeeCreator, canReceivePayments } from "@/lib/payee";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { grossUpForStripe } from "@/lib/fees";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube",
  twitter: "X / Twitter", twitch: "Twitch", discord: "Discord", spotify: "Spotify",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Must be signed in" }, { status: 401 });

  const { addbackId, fanHandle, message } = await req.json();
  if (!addbackId || !fanHandle?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: addback } = await (supabase as any)
    .from("social_addbacks")
    .select("*")
    .eq("id", addbackId)
    .eq("is_active", true)
    .maybeSingle();

  if (!addback) return NextResponse.json({ error: "Add-back not found" }, { status: 404 });

  // The payee's Connect account, read with the service role (lib/payee.ts).
  // Migration 064 removes anon read on creator_profiles, so the embed that
  // used to supply this returns nothing. The parent row above is still read
  // through the RLS-enforcing client — that is what authorises the purchase;
  // this only answers where the money goes.
  const payee = await getPayeeCreator((addback as any).creator_profile_id);
  if (!canReceivePayments(payee)) {
    return NextResponse.json({ error: "Creator has not connected payments yet." }, { status: 503 });
  }
  if (!payee.stripe_onboarded) return NextResponse.json({ error: "Creator hasn't connected payments" }, { status: 503 });

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
  const platformLabel = PLATFORM_LABELS[addback.platform] ?? addback.platform;
  const amountCents = Math.round(addback.price_usd * 100);
  const fanCents = grossUpForStripe(amountCents); // fan covers the card fee

  // Creator keeps 100% — platform takes 0% on add-backs
  const params = new URLSearchParams({
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `${platformLabel} follow-back from @${payee.display_name ?? payee.handle}`,
    "line_items[0][price_data][product_data][description]": addback.description || `${platformLabel} follow-back. Delivered within ${addback.delivery_days} days.`,
    "line_items[0][price_data][unit_amount]": String(fanCents),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${appUrl}/${payee.handle}?addback=success`,
    cancel_url: `${appUrl}/${payee.handle}`,
    "payment_intent_data[transfer_data][destination]": payee.stripe_account_id,
    "payment_intent_data[transfer_data][amount]": String(amountCents),
    "metadata[type]": "social_addback",
    "metadata[addback_id]": addbackId,
    "metadata[fan_handle]": fanHandle.trim(),
    "metadata[fan_user_id]": user.id,
    "metadata[message]": message?.trim() ?? "",
    "metadata[creator_user_id]": payee.user_id,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const session = await res.json();
  if (!res.ok) return NextResponse.json({ error: session.error?.message ?? "Checkout failed" }, { status: 500 });

  // Record the order
  await (supabase as any).from("social_addback_orders").insert({
    addback_id: addbackId,
    fan_user_id: user.id,
    fan_handle: fanHandle.trim(),
    fan_email: user.email,
    amount_usd: addback.price_usd,
    stripe_session_id: session.id,
    message: message?.trim() || null,
  });

  return NextResponse.json({ url: session.url });
}
