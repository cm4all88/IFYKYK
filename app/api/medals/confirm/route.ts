import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { writeOrLog } from "@/lib/db";

// Records a medal-pack purchase by verifying the PaymentIntent directly with
// Stripe (never trusting the client). Idempotent: safe to call more than once.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { paymentIntentId } = await req.json();
  if (!paymentIntentId || typeof paymentIntentId !== "string") {
    return NextResponse.json({ error: "Missing payment" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return NextResponse.json({ error: "Payment not found" }, { status: 400 });
  const pi = await res.json();

  const meta = pi.metadata ?? {};
  if (pi.status !== "succeeded") return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
  if (meta.type !== "medal_pack") return NextResponse.json({ error: "Wrong payment type" }, { status: 400 });
  if (meta.fan_user_id !== user.id) return NextResponse.json({ error: "Not your payment" }, { status: 403 });

  const { data: existing } = await (supabase as any)
    .from("medal_purchases").select("id").eq("stripe_session", pi.id).maybeSingle();

  const medals = parseInt(meta.medals ?? "0", 10);

  if (!existing) {
    await writeOrLog("medals/confirm insert medal_purchases", (supabase as any).from("medal_purchases").insert({
      fan_user_id: user.id,
      pack_id: meta.pack_id,
      medals,
      amount_usd: parseFloat(meta.amount_usd ?? "0"),
      stripe_session: pi.id,
    }));
    const { data: bal } = await (supabase as any)
      .from("medal_balances").select("balance, lifetime_purchased").eq("fan_user_id", user.id).maybeSingle();
    await writeOrLog("medals/confirm upsert medal_balances", (supabase as any).from("medal_balances").upsert({
      fan_user_id: user.id,
      balance: (bal?.balance ?? 0) + medals,
      lifetime_purchased: (bal?.lifetime_purchased ?? 0) + medals,
      updated_at: new Date().toISOString(),
    }, { onConflict: "fan_user_id" }));
  }

  const { data: now } = await (supabase as any)
    .from("medal_balances").select("balance").eq("fan_user_id", user.id).maybeSingle();
  return NextResponse.json({ ok: true, balance: now?.balance ?? medals });
}
