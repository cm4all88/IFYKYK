import { NextRequest, NextResponse } from "next/server";
import { getPayeeCreator } from "@/lib/payee";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const { creatorProfileId, content, amountUsd, isFrontRow } = await req.json();
  if (!creatorProfileId || !content?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Must be signed in" }, { status: 401 });

  // Connect routing data. Read with the service role via lib/payee.ts:
  // migration 064 removes anon read on creator_profiles, and guests can pay,
  // so this cannot come from the cookie client any more.
  const creator = await getPayeeCreator(creatorProfileId);

  if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  // Free message — just insert directly
  if (!isFrontRow || !amountUsd) {
    // Get or create thread
    let { data: thread } = await (supabase as any)
      .from("message_threads")
      .select("id").eq("creator_profile_id", creatorProfileId)
      .eq("fan_user_id", user.id).maybeSingle();

    if (!thread) {
      const { data: t } = await (supabase as any).from("message_threads").insert({
        creator_profile_id: creatorProfileId,
        fan_user_id: user.id,
        creator_unread: 1,
      }).select().single();
      thread = t;
    } else {
      await (supabase as any).from("message_threads")
        .update({ creator_unread: (thread as any).creator_unread + 1, last_message_at: new Date().toISOString() })
        .eq("id", thread.id);
    }

    await (supabase as any).from("messages").insert({
      thread_id: thread.id,
      sender_user_id: user.id,
      creator_profile_id: creatorProfileId,
      content: content.trim(),
      is_front_row: false,
    });

    return NextResponse.json({ ok: true, type: "free" });
  }

  // Front Row — paid, goes through Stripe
  if (!creator.stripe_account_id || !creator.stripe_onboarded) {
    return NextResponse.json({ error: "Creator hasn't connected payments" }, { status: 503 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const origin = new URL(req.url).origin;
  // 50% to creator via transfer after webhook — full amount collected by platform first
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Front Row Message to @${creator.handle}`,
    "line_items[0][price_data][product_data][description]": "Priority message — appears at the top of their inbox",
    "line_items[0][price_data][unit_amount]": String(Math.round(amountUsd * 100)),
    "line_items[0][quantity]": "1",
    "success_url": `${origin}/${creator.handle}?msg_sent=1`,
    "cancel_url": `${origin}/${creator.handle}`,
    "client_reference_id": user.id,
    "metadata[type]": "front_row_message",
    "metadata[creator_profile_id]": creatorProfileId,
    "metadata[buyer_user_id]": user.id,
    "metadata[content]": content.trim().slice(0, 500),
    "metadata[amount_usd]": String(amountUsd),
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  const session = await res.json();
  return NextResponse.json({ url: session.url, type: "front_row" });
}
