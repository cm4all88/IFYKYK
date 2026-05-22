import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

const BOOST_PRICES = [1.99, 4.99, 9.99] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to boost" }, { status: 401 });

  const { commentId, amountUsd } = await req.json();
  if (!commentId || !amountUsd) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (!BOOST_PRICES.includes(amountUsd)) {
    return NextResponse.json({ error: "Invalid boost amount" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  // Get comment + post info
  const { data: comment } = await (supabase as any)
    .from("comments")
    .select("*, post:post_id(creator_profile_id, creator:creator_profile_id(handle))")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  if (comment.is_boosted) return NextResponse.json({ error: "Already boosted" }, { status: 409 });

  const origin = new URL(req.url).origin;
  const handle = comment.post?.creator?.handle ?? "creator";

  // 100% to platform — no transfer_data
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": "Comment Boost · Pinned for 24 hours",
    "line_items[0][price_data][product_data][description]": `Your comment will be pinned at the top of this post for 24 hours.`,
    "line_items[0][price_data][unit_amount]": String(Math.round(amountUsd * 100)),
    "line_items[0][quantity]": "1",
    "success_url": `${origin}/${handle}?boosted=1`,
    "cancel_url": `${origin}/${handle}`,
    "client_reference_id": user.id,
    "metadata[type]": "comment_boost",
    "metadata[comment_id]": commentId,
    "metadata[user_id]": user.id,
    "metadata[amount_usd]": String(amountUsd),
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
