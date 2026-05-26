import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { getOrCreateStripePrices } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const { data: billing } = await (supabase as any)
    .from("creator_billing")
    .select("stripe_customer_id, stripe_subscription_id, tier")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!billing?.stripe_customer_id) return NextResponse.json({ error: "No billing account" }, { status: 404 });

  // Ensure Stripe prices exist for all tiers
  await getOrCreateStripePrices(STRIPE_SECRET_KEY);

  const origin = new URL(req.url).origin;

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      customer: billing.stripe_customer_id,
      return_url: `${origin}/dashboard?pane=billing`,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.error?.message ?? "Could not open billing portal" }, { status: 500 });
  }

  const session = await res.json();
  return NextResponse.json({ url: session.url });
}
