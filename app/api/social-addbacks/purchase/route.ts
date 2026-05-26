import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

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
    .select("*, creator:creator_profile_id(handle, display_name, stripe_account_id, stripe_onboarded, user_id)")
    .eq("id", addbackId)
    .eq("is_active", true)
    .maybeSingle();

  if (!addback) return NextResponse.json({ error: "Add-back not found" }, { status: 404 });
  if (!addback.creator?.stripe_onboarded) return NextResponse.json({ error: "Creator hasn't connected payments" }, { status: 503 });

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
  const platformLabel = PLATFORM_LABELS[addback.platform] ?? addback.platform;
  const amountCents = Math.round(addback.price_usd * 100);

  // Creator keeps 100% — platform takes 0% on add-backs
  const params = new URLSearchParams({
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `${platformLabel} follow-back from @${addback.creator.display_name ?? addback.creator.handle}`,
    "line_items[0][price_data][product_data][description]": addback.description || `${platformLabel} follow-back. Delivered within ${addback.delivery_days} days.`,
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${appUrl}/${addback.creator.handle}?addback=success`,
    cancel_url: `${appUrl}/${addback.creator.handle}`,
    "payment_intent_data[transfer_data][destination]": addback.creator.stripe_account_id,
    "metadata[type]": "social_addback",
    "metadata[addback_id]": addbackId,
    "metadata[fan_handle]": fanHandle.trim(),
    "metadata[fan_user_id]": user.id,
    "metadata[message]": message?.trim() ?? "",
    "metadata[creator_user_id]": addback.creator.user_id,
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
