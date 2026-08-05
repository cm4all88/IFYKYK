import { NextRequest, NextResponse } from "next/server";
import { getPayeeCreator, canReceivePayments } from "@/lib/payee";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to unlock this post." }, { status: 401 });
  }

  const { postId } = await req.json();
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  // Get post and creator details
  const { data: post } = await (supabase as any)
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("lock_type", "purchase")
    .eq("status", "live")
    .maybeSingle();

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // The payee's Connect account, read with the service role (lib/payee.ts).
  // Migration 064 removes anon read on creator_profiles, so the embed that
  // used to supply this returns nothing. The parent row above is still read
  // through the RLS-enforcing client — that is what authorises the purchase;
  // this only answers where the money goes.
  const payee = await getPayeeCreator((post as any).creator_profile_id);
  if (!canReceivePayments(payee)) {
    return NextResponse.json({ error: "Creator has not connected payments yet." }, { status: 503 });
  }
  if (!payee.stripe_account_id) return NextResponse.json({ error: "Creator not connected to Stripe" }, { status: 503 });

  // Already unlocked?
  const { data: existing } = await (supabase as any)
    .from("post_unlocks")
    .select("id")
    .eq("post_id", postId)
    .eq("fan_user_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Already unlocked" }, { status: 409 });

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const origin = new URL(req.url).origin;
  const price = Math.round(Number(post.unlock_price) * 100);
  const description = post.caption
    ? post.caption.slice(0, 100) + (post.caption.length > 100 ? "…" : "")
    : "Exclusive post";

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Unlock post · @${payee.handle}`,
    "line_items[0][price_data][product_data][description]": description,
    "line_items[0][price_data][unit_amount]": String(price),
    "line_items[0][quantity]": "1",
    "payment_intent_data[transfer_data][destination]": payee.stripe_account_id,
    "success_url": `${origin}/${payee.handle}?unlocked=${postId}`,
    "cancel_url": `${origin}/${payee.handle}`,
    "client_reference_id": user.id,
    "metadata[type]": "post_unlock",
    "metadata[post_id]": postId,
    "metadata[fan_user_id]": user.id,
    "metadata[amount_usd]": String(post.unlock_price),
  });

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
    console.error("Stripe unlock error:", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  const session = await stripeRes.json();
  return NextResponse.json({ url: session.url });
}
