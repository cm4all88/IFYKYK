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

      // Campaign donation — record it and notify creator
      if (meta.type === "campaign_donation" && meta.campaign_id) {
        const donationAmount = parseFloat(meta.amount_usd ?? "0");
        await (supabase as any).from("campaign_donations").insert({
          campaign_id: meta.campaign_id,
          donor_user_id: meta.donor_user_id,
          amount: donationAmount,
          message: meta.buyer_message ?? null,
          stripe_session_id: s.id,
        });
        // Update raised amount
        const { data: camp } = await (supabase as any)
          .from("campaigns").select("raised_amount, goal_amount, title, creator_profile_id").eq("id", meta.campaign_id).maybeSingle();
        if (camp) {
          const newRaised = Number(camp.raised_amount) + donationAmount;
          const newStatus = newRaised >= Number(camp.goal_amount) ? "funded" : "active";
          await (supabase as any).from("campaigns").update({ raised_amount: newRaised, status: newStatus }).eq("id", meta.campaign_id);
          // Notify creator via email
          const { data: creatorProfile } = await (supabase as any)
            .from("creator_profiles").select("user_id").eq("id", camp.creator_profile_id).maybeSingle();
          if (creatorProfile) {
            const { data: authUser } = await supabase.auth.admin.getUserById(creatorProfile.user_id);
            if (authUser?.user?.email) {
              fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app"}/api/email/notify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: authUser.user.email,
                  subject: `💛 Someone donated $${donationAmount} to your campaign`,
                  preview: `Your campaign "${camp.title}" just received a donation.`,
                  body: `A fan donated <strong>$${donationAmount.toFixed(2)}</strong> to your campaign "${camp.title}". Total raised: $${newRaised.toFixed(2)} of $${Number(camp.goal_amount).toFixed(2)}.${newStatus === "funded" ? "<br><br><strong>🎉 Your campaign is fully funded!</strong>" : ""}`,
                }),
              }).catch(() => {});
            }
          }
        }
      }

      // Wishlist gift — notify creator
      if (meta.type === "wishlist_gift" && meta.wishlist_item_id) {
        const { data: purchase } = await (supabase as any)
          .from("wishlist_purchases").select("id").eq("wishlist_item_id", meta.wishlist_item_id).maybeSingle();
        if (purchase) {
          const { data: creatorProfile } = await (supabase as any)
            .from("creator_profiles").select("user_id").eq("id", meta.creator_profile_id).maybeSingle();
          if (creatorProfile) {
            const { data: authUser } = await supabase.auth.admin.getUserById(creatorProfile.user_id);
            const { data: item } = await (supabase as any).from("wishlist_items").select("name, price").eq("id", meta.wishlist_item_id).maybeSingle();
            if (authUser?.user?.email && item) {
              fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app"}/api/email/notify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: authUser.user.email,
                  subject: `🎁 A fan funded your wish list item`,
                  preview: `Someone funded "${item.name}" on your wish list.`,
                  body: `A fan funded <strong>${item.name}</strong> ($${Number(item.price).toFixed(2)}) from your wish list.<br><br>Go buy it from any store — then go to <a href="https://spotlightly.app/dashboard?pane=wishlist">your dashboard</a> and click "I bought it" to receive your reimbursement immediately.`,
                }),
              }).catch(() => {});
            }
          }
        }
      }

      // Wishlist gift fulfillment
      if (meta.type === "wishlist_gift" && meta.wishlist_item_id) {
        await (supabase as any).from("wishlist_items").update({
          is_purchased: true,
          purchased_at: new Date().toISOString(),
          purchased_by_id: meta.buyer_user_id,
          reserved_until: null,
        }).eq("id", meta.wishlist_item_id);

        await (supabase as any).from("wishlist_purchases").insert({
          wishlist_item_id: meta.wishlist_item_id,
          creator_profile_id: meta.creator_profile_id,
          buyer_user_id: meta.buyer_user_id,
          item_price: parseFloat(meta.item_price ?? "0"),
          service_fee: parseFloat(meta.service_fee ?? "0"),
          total_charged: parseFloat(meta.item_price ?? "0") + parseFloat(meta.service_fee ?? "0"),
          stripe_session_id: s.id,
          status: "pending",
          buyer_message: meta.buyer_message ?? null,
        });
      }

      if (meta.type === "tip") {
        await (supabase as any).from("tips").insert({
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
