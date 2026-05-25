import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Must be logged in to tip" }, { status: 401 });

  const { streamId, amountUsd, message, displayName } = await req.json();
  if (!streamId || !amountUsd || amountUsd < 1) {
    return NextResponse.json({ error: "Missing fields or invalid amount" }, { status: 400 });
  }

  const { data: stream } = await (supabase as any)
    .from("live_streams")
    .select("id, creator_profile_id, creator_profiles(kind, stripe_account_id)")
    .eq("id", streamId)
    .eq("status", "live")
    .maybeSingle();

  if (!stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 });

  const isBackstage = stream.creator_profiles?.kind === "backstage";

  if (isBackstage) {
    // CCBill tips handled separately — return a CCBill redirect URL
    return NextResponse.json({ error: "CCBill tips coming soon" }, { status: 501 });
  }

  const stripeAccount = stream.creator_profiles?.stripe_account_id;
  if (!stripeAccount) {
    return NextResponse.json({ error: "Creator hasn't connected Stripe yet" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: Math.round(amountUsd * 100),
        product_data: {
          name: `Live tip${message ? ` — "${message.slice(0, 40)}"` : ""}`,
          description: `Tip during live stream`,
        },
      },
      quantity: 1,
    }],
    payment_intent_data: {
      transfer_data: { destination: stripeAccount },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/live?tip=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/live?tip=cancelled`,
    metadata: {
      stream_id: streamId,
      display_name: displayName || "Anonymous",
      message: message || "",
    },
  });

  // Record in DB (pre-payment — confirmed via webhook)
  await (supabase as any).from("live_stream_tips").insert({
    stream_id: streamId,
    user_id: user.id,
    display_name: displayName?.trim() || "Anonymous",
    amount_usd: amountUsd,
    message: message?.trim() || null,
    payment_method: "stripe",
  });

  return NextResponse.json({ url: session.url });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const streamId = req.nextUrl.searchParams.get("streamId");
  if (!streamId) return NextResponse.json({ error: "Missing streamId" }, { status: 400 });

  const { data } = await (supabase as any)
    .from("live_stream_tips")
    .select("*")
    .eq("stream_id", streamId)
    .order("amount_usd", { ascending: false })
    .limit(20);

  return NextResponse.json({ tips: data ?? [] });
}
