import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notify";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import crypto from "node:crypto";

export const runtime = "nodejs";

function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

async function notifyCreator(supabase: any, creatorProfileId: string, subject: string, preview: string, body: string) {
  try {
    const { data: cp } = await supabase.from("creator_profiles").select("user_id").eq("id", creatorProfileId).maybeSingle();
    if (!cp) return;
    const { data: au } = await supabase.auth.admin.getUserById(cp.user_id);
    if (!au?.user?.email) return;
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app"}/api/email/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: au.user.email, subject, preview, body }),
    }).catch(() => {});
  } catch { /* non-fatal */ }
}

export async function POST(req: NextRequest) {
  const { STRIPE_WEBHOOK_SECRET } = await getSecrets(["STRIPE_WEBHOOK_SECRET"]);
  if (!STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig || !verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const supabase = await createClient();

  // ── Connected account became ready → mark the creator onboarded ──
  // Reliable fallback: fires whenever the account's status changes, so the
  // dashboard updates even if the post-onboarding return redirect never ran.
  if (event.type === "account.updated") {
    const acct = event.data.object;
    if (acct?.id && acct.details_submitted && acct.charges_enabled) {
      await (supabase as any)
        .from("creator_profiles")
        .update({ stripe_onboarded: true })
        .eq("stripe_account_id", acct.id);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const meta = s.metadata ?? {};
    const type = meta.type;

    // ── Tip ─────────────────────────────────────────────────────────
    if (type === "tip") {
      const amount = (s.amount_total ?? 0) / 100;
      await (supabase as any).from("tips").insert({
        fan_user_id: meta.fan_user_id || null,
        creator_profile_id: meta.creator_profile_id,
        amount,
        stripe_session_id: s.id,
      });
      await notifyCreator(supabase, meta.creator_profile_id,
        `💛 New tip: $${amount.toFixed(2)}`,
        `A fan just tipped you $${amount.toFixed(2)}.`,
        `A fan sent you a <strong>$${amount.toFixed(2)} tip</strong>. The full amount goes directly to your Stripe account.`
      );
    }

    // ── Super Tip ────────────────────────────────────────────────────
    else if (type === "super_tip") {
      const amount = parseFloat(meta.amount_usd ?? "0");
      const creatorReceives = Math.round(amount * 0.85 * 100) / 100;
      const platformReceives = Math.round(amount * 0.15 * 100) / 100;
      const badgeExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await (supabase as any).from("super_tips").insert({
        creator_profile_id: meta.creator_profile_id,
        fan_user_id: meta.fan_user_id || null,
        fan_display_name: meta.fan_display_name,
        message: meta.message || null,
        amount_usd: amount,
        creator_receives: creatorReceives,
        platform_receives: platformReceives,
        stripe_session_id: s.id,
        badge_expires_at: badgeExpires,
      });

      const msgNote = meta.message ? `<br><br>Their message: <em>"${meta.message}"</em>` : "";
      await notifyCreator(supabase, meta.creator_profile_id,
        `⭐ Super Tip from ${meta.fan_display_name}: $${amount.toFixed(2)}`,
        `${meta.fan_display_name} just sent you a $${amount.toFixed(2)} Super Tip.`,
        `<strong>${meta.fan_display_name}</strong> sent you a <strong>⭐ Super Tip of $${amount.toFixed(2)}</strong>. You receive $${creatorReceives.toFixed(2)} (85%).${msgNote}`
      );
    }

    // ── Subscription ────────────────────────────────────────────────
    else if (type === "subscription" || (s.mode === "subscription" && !type)) {
      await (supabase as any).from("subscriptions").upsert({
        creator_profile_id: meta.creator_profile_id,
        fan_user_id: s.client_reference_id,
        stripe_subscription_id: s.subscription,
        status: "active",
        tier: "premium",
        tier_id: meta.tier_id || null,
        billing_period: meta.billing_period || "monthly",
        updated_at: new Date().toISOString(),
      }, { onConflict: "fan_user_id,creator_profile_id" });

      // Get tier name for notification
      let tierDisplay = "";
      if (meta.tier_id) {
        const { data: tier } = await (supabase as any).from("subscription_tiers").select("name").eq("id", meta.tier_id).maybeSingle();
        if (tier) tierDisplay = ` · ${tier.name}`;
      }

      await notifyCreator(supabase, meta.creator_profile_id,
        `✦ New subscriber${tierDisplay}`,
        "Someone just subscribed to your channel.",
        `A new fan just subscribed${tierDisplay ? ` to your <strong>${tierDisplay.slice(3)}</strong> tier` : ""}. They'll stay subscribed as long as you keep creating.`
      );
    }

    // ── Post Unlock ─────────────────────────────────────────────────
    else if (type === "post_unlock") {
      const amount = parseFloat(meta.amount_usd ?? "0");
      await (supabase as any).from("post_unlocks").upsert({
        post_id: meta.post_id,
        fan_user_id: meta.fan_user_id,
        amount_paid: amount,
        stripe_session_id: s.id,
      }, { onConflict: "post_id,fan_user_id" });

      await notifyCreator(supabase, meta.creator_profile_id ?? "",
        `🔓 Someone unlocked your post · $${amount.toFixed(2)}`,
        `A fan paid $${amount.toFixed(2)} to unlock your post.`,
        `A fan paid <strong>$${amount.toFixed(2)}</strong> to unlock one of your posts.`
      );
    }

    // ── Campaign Donation ────────────────────────────────────────────
    else if (type === "campaign_donation" && meta.campaign_id) {
      const amount = parseFloat(meta.amount_usd ?? "0");
      await (supabase as any).from("campaign_donations").insert({
        campaign_id: meta.campaign_id,
        donor_user_id: meta.donor_user_id || null,
        amount,
        message: meta.message || null,
        stripe_session_id: s.id,
      });
      const { data: camp } = await (supabase as any)
        .from("campaigns").select("raised_amount, goal_amount, title, creator_profile_id").eq("id", meta.campaign_id).maybeSingle();
      if (camp) {
        const newRaised = Number(camp.raised_amount) + amount;
        const newStatus = newRaised >= Number(camp.goal_amount) ? "funded" : "active";
        await (supabase as any).from("campaigns").update({ raised_amount: newRaised, status: newStatus }).eq("id", meta.campaign_id);
        const funded = newStatus === "funded" ? "<br><br><strong>🎉 Your campaign is fully funded!</strong>" : "";
        await notifyCreator(supabase, camp.creator_profile_id,
          `💛 New campaign donation: $${amount.toFixed(2)}`,
          `Your campaign received a $${amount.toFixed(2)} donation.`,
          `A fan donated <strong>$${amount.toFixed(2)}</strong> to your campaign "${camp.title}". Total: $${newRaised.toFixed(2)} of $${Number(camp.goal_amount).toFixed(2)}.${funded}`
        );
      }
    }

    // ── Wishlist Gift ────────────────────────────────────────────────
    else if (type === "wishlist_gift" && meta.wishlist_item_id) {
      await (supabase as any).from("wishlist_items").update({
        is_purchased: true,
        purchased_at: new Date().toISOString(),
        purchased_by_id: meta.buyer_user_id,
      }).eq("id", meta.wishlist_item_id);

      await (supabase as any).from("wishlist_purchases").insert({
        wishlist_item_id: meta.wishlist_item_id,
        creator_profile_id: meta.creator_profile_id,
        buyer_user_id: meta.buyer_user_id || null,
        item_price: parseFloat(meta.item_price ?? "0"),
        service_fee: parseFloat(meta.service_fee ?? "0"),
        total_charged: parseFloat(meta.item_price ?? "0") + parseFloat(meta.service_fee ?? "0"),
        stripe_session_id: s.id,
        status: "pending",
        buyer_message: meta.buyer_message || null,
      });

      const { data: item } = await (supabase as any).from("wishlist_items").select("name, price").eq("id", meta.wishlist_item_id).maybeSingle();
      if (item) {
        await notifyCreator(supabase, meta.creator_profile_id,
          `🎁 A fan funded your wish list item`,
          `Someone funded "${item.name}" on your wish list.`,
          `A fan funded <strong>${item.name}</strong> ($${Number(item.price).toFixed(2)}) from your wish list. Go buy it and click "I bought it" in your dashboard to receive your reimbursement.`
        );
      }
    }

    // ── Front Row Message ────────────────────────────────────────────
    else if (type === "front_row_message") {
      const amount = parseFloat(meta.amount_usd ?? "0");
      const creatorShare = Math.round(amount * 0.5 * 100) / 100;

      // Get or create thread
      let { data: thread } = await (supabase as any)
        .from("message_threads")
        .select("id, creator_unread")
        .eq("creator_profile_id", meta.creator_profile_id)
        .eq("fan_user_id", meta.buyer_user_id)
        .maybeSingle();

      if (!thread) {
        const { data: t } = await (supabase as any).from("message_threads").insert({
          creator_profile_id: meta.creator_profile_id,
          fan_user_id: meta.buyer_user_id,
          creator_unread: 1,
        }).select().single();
        thread = t;
      } else {
        await (supabase as any).from("message_threads")
          .update({ creator_unread: (thread.creator_unread ?? 0) + 1, last_message_at: new Date().toISOString() })
          .eq("id", thread.id);
      }

      if (thread) {
        await (supabase as any).from("messages").insert({
          thread_id: thread.id,
          sender_user_id: meta.buyer_user_id,
          creator_profile_id: meta.creator_profile_id,
          content: meta.content,
          is_front_row: true,
          front_row_amount: amount,
        });
      }

      await notifyCreator(supabase, meta.creator_profile_id,
        `💬 Front Row Message — $${amount.toFixed(2)}`,
        `A fan sent you a paid Front Row Message.`,
        `A fan sent you a <strong>Front Row Message</strong> with a $${amount.toFixed(2)} payment. You receive $${creatorShare.toFixed(2)} (50%).<br><br>Their message: <em>"${meta.content}"</em>`
      );
    }

    // ── Comment Boost ────────────────────────────────────────────────
    else if (type === "comment_boost") {
      const boostedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await (supabase as any)
        .from("comments")
        .update({
          is_boosted: true,
          boosted_until: boostedUntil,
          boost_amount_usd: parseFloat(meta.amount_usd ?? "0"),
          boost_stripe_session: s.id,
        })
        .eq("id", meta.comment_id);
    }

    // ── Early Access Pass ────────────────────────────────────────────
    else if (type === "early_access") {
      await (supabase as any).from("early_access_passes").upsert({
        fan_user_id: meta.fan_user_id,
        creator_profile_id: meta.creator_profile_id,
        stripe_subscription_id: s.subscription,
        status: "active",
      }, { onConflict: "fan_user_id,creator_profile_id" });
    }

    // ── Gift Subscription ────────────────────────────────────────────
    else if (type === "gift_subscription") {
      const amount = parseFloat(meta.amount_usd ?? "0");
      const { data: gift } = await (supabase as any)
        .from("gift_subscriptions")
        .insert({
          gifter_user_id: meta.gifter_user_id,
          recipient_email: meta.recipient_email,
          creator_profile_id: meta.creator_profile_id,
          months: parseInt(meta.months ?? "1"),
          amount_paid: amount,
          stripe_session_id: s.id,
        })
        .select()
        .single();

      if (gift) {
        const { data: profile } = await (supabase as any)
          .from("creator_profiles").select("handle").eq("id", meta.creator_profile_id).maybeSingle();
        fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app"}/api/email/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: meta.recipient_email,
            subject: `🎁 You've been gifted a ${meta.months}-month subscription to @${profile?.handle}`,
            preview: `Someone gifted you a subscription on Spotlightly.`,
            body: `You've received a <strong>${meta.months}-month subscription</strong> to <strong>@${profile?.handle}</strong> on Spotlightly.<br><br>
Your redemption code: <strong style="font-family:monospace;font-size:18px;letter-spacing:0.1em;">${gift.redemption_code}</strong><br><br>
<a href="https://spotlightly.app/redeem?code=${gift.redemption_code}" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:700;">Redeem your gift →</a>`,
          }),
        }).catch(() => {});
      }
    }

    // ── Digital product purchase ──────────────────────────────────────
    else if ((type === "digital_product" || type === "digital_purchase") && meta.product_id) {
      const priceTotal = (s.amount_total ?? 0) / 100;
      const platformFee = Math.round(priceTotal * 0.10 * 100) / 100;
      const creatorEarns = Math.round((priceTotal - platformFee) * 100) / 100;

      const { data: purchase } = await (supabase as any)
        .from("digital_purchases")
        .insert({
          digital_product_id: meta.product_id,
          creator_profile_id: meta.creator_profile_id,
          fan_user_id: meta.fan_user_id || null,
          fan_email: meta.fan_email || s.customer_details?.email || "",
          amount_paid: priceTotal,
          platform_fee: platformFee,
          creator_earns: creatorEarns,
          stripe_session_id: s.id,
        })
        .select()
        .single();

      // Update product sales count
      if (purchase) {
        await (supabase as any)
          .from("digital_products")
          .update({ sales_count: (supabase as any).rpc("increment", { x: 1 }) })
          .eq("id", meta.product_id);
        // Simpler approach — just increment directly
        const { data: prod } = await (supabase as any).from("digital_products").select("sales_count").eq("id", meta.product_id).maybeSingle();
        await (supabase as any).from("digital_products").update({ sales_count: (prod?.sales_count ?? 0) + 1 }).eq("id", meta.product_id);
      }

      // Email fan with download link
      if (purchase && s.customer_details?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
        const { data: product } = await (supabase as any)
          .from("digital_products")
          .select("title, creator:creator_profile_id(display_name, handle)")
          .eq("id", meta.product_id)
          .maybeSingle();

        fetch(`${appUrl}/api/email/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: s.customer_details.email,
            subject: `Your download is ready — ${product?.title}`,
            preview: "Your purchase is ready to download.",
            body: `Thanks for your purchase!<br><br>
<strong style="color:#fff;font-size:18px;">${product?.title}</strong><br>
from ${product?.creator?.display_name ?? "a creator"} on Spotlightly<br><br>
<a href="${appUrl}/api/digital/download?token=${purchase.download_token}" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:700;padding:14px 28px;border-radius:999px;text-decoration:none;font-size:14px;">
  Download now →
</a><br><br>
<span style="font-size:12px;color:rgba(242,242,240,0.3);">This link is unique to your purchase. Keep it safe — bookmark it for future downloads.</span>`,
          }),
        }).catch(() => {});

        // Notify creator of sale
        await notifyCreator(
          supabase,
          meta.creator_profile_id,
          `💾 New sale — ${product?.title}`,
          `Someone bought your digital product for $${priceTotal.toFixed(2)}.`,
          `Someone just bought <strong>${product?.title}</strong> for <strong>$${priceTotal.toFixed(2)}</strong>. You receive <strong style="color:#F0B429;">$${creatorEarns.toFixed(2)}</strong>.`
        );
      }
    }
  }

  // ── Subscription status changes ──────────────────────────────────
  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const sub = event.data.object;

    // Fan→creator subscription updates
    await supabase.from("subscriptions").update({ status: sub.status }).eq("stripe_subscription_id", sub.id);
    await (supabase as any).from("early_access_passes").update({ status: sub.status }).eq("stripe_subscription_id", sub.id);

    // Creator platform billing updates
    const meta = sub.metadata ?? {};
    if (meta.platform === "spotlightly" || meta.user_id) {
      const billingStatus =
        sub.status === "trialing"    ? "trial"     :
        sub.status === "active"      ? "active"    :
        sub.status === "past_due"    ? "past_due"  :
        sub.status === "canceled"    ? "cancelled" : sub.status;

      await (supabase as any)
        .from("creator_billing")
        .update({
          status: billingStatus,
          stripe_subscription_id: sub.id,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", sub.customer);

      // If cancelled — send retention email
      if (sub.status === "canceled" && meta.user_id) {
        const { data: au } = await supabase.auth.admin.getUserById(meta.user_id);
        if (au?.user?.email) {
          fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app"}/api/email/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: au.user.email,
              subject: "Your Spotlightly subscription has ended",
              preview: "Your creator account has been deactivated.",
              body: `Your Spotlightly subscription has ended and your creator features have been paused.<br><br>Your content and subscribers are safe — reactivate anytime at <a href="https://spotlightly.app/dashboard?pane=billing">spotlightly.app/dashboard</a>.`,
            }),
          }).catch(() => {});
        }
      }
    }
  }

  // Trial ending soon — send warning email 3 days before
  if (event.type === "customer.subscription.trial_will_end") {
    const sub = event.data.object;
    const meta = sub.metadata ?? {};

    if (meta.platform === "spotlightly" || meta.user_id) {
      const { data: billing } = await (supabase as any)
        .from("creator_billing")
        .select("trial_warning_sent, user_id")
        .eq("stripe_customer_id", sub.customer)
        .maybeSingle();

      if (billing && !billing.trial_warning_sent) {
        const { data: au } = await supabase.auth.admin.getUserById(billing.user_id);
        if (au?.user?.email) {
          const trialEnd = new Date(sub.trial_end * 1000);
          const daysLeft = Math.ceil((trialEnd.getTime() - Date.now()) / 86400000);

          fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app"}/api/email/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: au.user.email,
              subject: `Your Spotlightly trial ends in ${daysLeft} days`,
              preview: "Add a payment method to keep your creator account active.",
              body: `Your 30-day free trial ends on <strong>${trialEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.<br><br>
Add a payment method before then to keep your creator account active. If you don't, your account will be paused — your content and subscribers will be saved, but you won't be able to accept payments.<br><br>
<a href="https://spotlightly.app/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Add payment method →</a>`,
            }),
          }).catch(() => {});

          // Mark warning as sent
          await (supabase as any)
            .from("creator_billing")
            .update({ trial_warning_sent: true })
            .eq("stripe_customer_id", sub.customer);
        }
      }
    }
  }

  // Payment succeeded — auto-upgrade tier if subscriber count has grown
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    if (invoice.subscription) {
      const { data: billing } = await (supabase as any)
        .from("creator_billing")
        .select("user_id, tier, stripe_subscription_id")
        .eq("stripe_subscription_id", invoice.subscription)
        .maybeSingle();

      if (billing) {
        // Count current subscribers
        const { data: profiles } = await (supabase as any)
          .from("creator_profiles").select("id").eq("user_id", billing.user_id);
        const profileIds = (profiles ?? []).map((p: any) => p.id);

        if (profileIds.length > 0) {
          const { count } = await (supabase as any)
            .from("subscriptions")
            .select("id", { count: "exact", head: true })
            .in("creator_profile_id", profileIds)
            .eq("status", "active");

          const { tierForCount, getPriceId } = await import("@/lib/billing");
          const { getSecrets } = await import("@/lib/settings");
          const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);

          if (STRIPE_SECRET_KEY) {
            const correctTier = tierForCount(count ?? 0);
            if (correctTier !== billing.tier) {
              // Upgrade subscription to new tier
              const newPriceId = await getPriceId(correctTier, STRIPE_SECRET_KEY);

              // Get current subscription items
              const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${billing.stripe_subscription_id}`, {
                headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
              });
              const subData = await subRes.json();
              const itemId = subData.items?.data?.[0]?.id;

              if (itemId) {
                await fetch(`https://api.stripe.com/v1/subscriptions/${billing.stripe_subscription_id}`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
                  body: new URLSearchParams({
                    [`items[0][id]`]: itemId,
                    [`items[0][price]`]: newPriceId,
                    proration_behavior: "none", // Apply on next cycle
                  }).toString(),
                });

                await (supabase as any)
                  .from("creator_billing")
                  .update({ tier: correctTier, updated_at: new Date().toISOString() })
                  .eq("user_id", billing.user_id);
              }
            }
          }
        }
      }
    }
  }

  // Payment failed — notify creator
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    if (invoice.subscription) {
      const { data: billing } = await (supabase as any)
        .from("creator_billing")
        .select("user_id")
        .eq("stripe_subscription_id", invoice.subscription)
        .maybeSingle();

      if (billing) {
        const { data: au } = await supabase.auth.admin.getUserById(billing.user_id);
        if (au?.user?.email) {
          fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app"}/api/email/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: au.user.email,
              subject: "Payment failed — action required",
              preview: "We couldn't process your Spotlightly subscription payment.",
              body: `We couldn't process your Spotlightly subscription payment. Please update your payment method to keep your creator account active.<br><br>
<a href="https://spotlightly.app/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Update payment method →</a>`,
            }),
          }).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
