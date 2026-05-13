import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import crypto from "node:crypto";

export const runtime = "nodejs";

/**
 * Verify Stripe webhook signature manually (no SDK needed).
 * Stripe signs with HMAC-SHA256 over `${timestamp}.${body}`.
 */
function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

export async function POST(req: NextRequest) {
  const { STRIPE_WEBHOOK_SECRET } = await getSecrets(["STRIPE_WEBHOOK_SECRET"]);
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig || !verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
    console.error("Stripe webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const supabase = await createClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const meta = s.metadata ?? {};

      const amountDollars = (s.amount_total ?? 0) / 100;
      const platformPct = 0.15;

      if (meta.type === "tip") {
        await supabase.from("tips").insert({
          fan_user_id: meta.user_id,
          creator_profile_id: meta.creator_profile_id,
          amount: amountDollars,
          creator_receives: amountDollars * (1 - platformPct),
          platform_receives: amountDollars * platformPct,
          stripe_payment_intent_id: s.payment_intent ?? s.id,
        });
      } else {
        await (supabase as any).from("subscriptions").insert({
          creator_profile_id: meta.creator_profile_id,
          fan_user_id: meta.user_id,
          stripe_subscription_id: s.subscription,
          status: "active",
          price: amountDollars,
        });
      }
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      await supabase
        .from("subscriptions")
        .update({ status: sub.status })
        .eq("stripe_subscription_id", sub.id);
      break;
    }

    default:
      // Other events — log and ignore
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
