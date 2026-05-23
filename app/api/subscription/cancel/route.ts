import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscriptionId } = await req.json();
  if (!subscriptionId) return NextResponse.json({ error: "Missing subscriptionId" }, { status: 400 });

  const { data: sub } = await (supabase as any)
    .from("subscriptions")
    .select("stripe_subscription_id, fan_user_id")
    .eq("id", subscriptionId)
    .eq("fan_user_id", user.id)
    .maybeSingle();

  if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  if (!sub.stripe_subscription_id) return NextResponse.json({ error: "No Stripe subscription" }, { status: 400 });

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ cancel_at_period_end: "true" }).toString(),
  });

  if (!res.ok) return NextResponse.json({ error: "Could not cancel" }, { status: 500 });

  await (supabase as any).from("subscriptions").update({ status: "cancelling" }).eq("id", subscriptionId);
  return NextResponse.json({ ok: true });
}
