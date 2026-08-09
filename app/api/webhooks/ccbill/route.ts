import { NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase-server";
import Stripe from "stripe";
import { writeOrLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return Response.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = verifyWebhook(body, sig);
  } catch (err) {
    console.error("Stripe webhook verification failed:", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  switch (event.type) {
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const fanUserId = sub.metadata?.fan_user_id;
      const creatorId = sub.metadata?.creator_id;

      if (!fanUserId || !creatorId) {
        console.error("Stripe sub created without fan_user_id/creator_id metadata", sub.id);
        return Response.json({ error: "Missing metadata" }, { status: 400 });
      }

      await writeOrLog("webhooks/ccbill insert subscriptions", (supabase as any).from("subscriptions").insert({
        creator_profile_id: creatorId,
        fan_user_id: fanUserId,
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer as string,
        status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }));
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await writeOrLog("webhooks/ccbill update subscriptions", supabase.from("subscriptions")
        .update({
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })
        .eq("stripe_subscription_id", sub.id));
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await writeOrLog("webhooks/ccbill update subscriptions", supabase.from("subscriptions")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", sub.id));
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("Payment succeeded for invoice:", invoice.id);
      break;
    }
  }

  return Response.json({ received: true });
}