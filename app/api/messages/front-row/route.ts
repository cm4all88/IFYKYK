import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { writeOrLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { creatorProfileId, content, amountUsd, isFrontRow } = await req.json();
  if (!creatorProfileId || !content?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Must be signed in" }, { status: 401 });

  const { data: creator } = await (supabase as any)
    .from("creator_profiles")
    .select("id, handle, stripe_account_id, stripe_onboarded")
    .eq("id", creatorProfileId)
    .maybeSingle();

  if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  // Free message — just insert directly
  if (!isFrontRow || !amountUsd) {
    // Threads and messages are written with the service role. The fan owns the
    // message but not the thread, and an insert with .select() chained onto it
    // is rolled back whole when the select policy denies the RETURNING clause.
    // That is what silently dropped digital purchases, and it was dropping
    // messages here the same way.
    const db = await createServiceClient();

    // The unread counter needs its current value, and the old query only
    // selected id, so this was incrementing undefined into NaN and failing.
    let { data: thread } = await (db as any)
      .from("message_threads")
      .select("id, creator_unread")
      .eq("creator_profile_id", creatorProfileId)
      .eq("fan_user_id", user.id)
      .maybeSingle();

    if (!thread) {
      const { data: t, error: threadErr } = await (db as any).from("message_threads").insert({
        creator_profile_id: creatorProfileId,
        fan_user_id: user.id,
        creator_unread: 1,
        last_message_at: new Date().toISOString(),
      }).select().single();

      if (threadErr || !t) {
        console.error("DB WRITE FAILED [messages/front-row insert message_threads]:", threadErr);
        return NextResponse.json({ error: "Could not start the conversation. Try again." }, { status: 500 });
      }
      thread = t;
    } else {
      await writeOrLog("messages/front-row update message_threads", (db as any).from("message_threads")
        .update({
          creator_unread: Number(thread.creator_unread ?? 0) + 1,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", thread.id));
    }

    const { error: msgErr } = await (db as any).from("messages").insert({
      thread_id: thread.id,
      sender_user_id: user.id,
      creator_profile_id: creatorProfileId,
      content: content.trim(),
      is_front_row: false,
    });

    // Never tell a fan their message sent when it did not.
    if (msgErr) {
      console.error("DB WRITE FAILED [messages/front-row insert messages]:", msgErr);
      return NextResponse.json({ error: "Message could not be sent. Try again." }, { status: 500 });
    }

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
