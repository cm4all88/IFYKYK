import { NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/ccbill";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const payload = Object.fromEntries(body.entries()) as Record<string, string>;

  if (!verifyWebhook(payload as Parameters<typeof verifyWebhook>[0])) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { eventType, subscriptionId, email } = payload;

  switch (eventType) {
    case "NewSaleSuccess":
      await supabase.from("ccbill_subscriptions").insert({
        ccbill_subscription_id: subscriptionId,
        fan_email: email,
        status: "active",
        event_type: eventType,
      });
      break;

    case "Cancellation":
      await supabase.from("ccbill_subscriptions")
        .update({ status: "canceled" })
        .eq("ccbill_subscription_id", subscriptionId);
      break;

    case "RenewalSuccess":
      await supabase.from("ccbill_subscriptions")
        .update({ status: "active", last_renewal: new Date().toISOString() })
        .eq("ccbill_subscription_id", subscriptionId);
      break;
  }

  return new Response("OK", { status: 200 });
}
