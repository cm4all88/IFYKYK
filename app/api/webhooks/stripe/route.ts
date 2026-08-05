import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notify";
import { createServiceClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { sendAdminAlert, sendNotifyEmail } from "@/lib/email";
import { verifyWebhook } from "@/lib/stripe";
import { buildTipLedgerRow, tipWebhookOutcome } from "@/lib/tips";

export const runtime = "nodejs";

// The hand-rolled HMAC that used to live here fed the `t` timestamp into the
// signature but never compared it against the clock, so a captured request
// stayed valid forever. It also threw a RangeError instead of returning false
// when `v1` had an unexpected length. `verifyWebhook` (lib/stripe.ts) wraps the
// official SDK, which enforces signature, timestamp tolerance and raw body.

async function notifyCreator(supabase: any, creatorProfileId: string, subject: string, preview: string, body: string) {
  try {
    const { data: cp } = await supabase.from("creator_profiles").select("user_id").eq("id", creatorProfileId).maybeSingle();
    if (!cp) return;
    const { data: au } = await supabase.auth.admin.getUserById(cp.user_id);
    if (!au?.user?.email) return;
    sendNotifyEmail({ to: au.user.email, subject, preview, body }).catch(() => {});
  } catch { /* non-fatal */ }
}

export async function POST(req: NextRequest) {
  const { STRIPE_WEBHOOK_SECRET } = await getSecrets(["STRIPE_WEBHOOK_SECRET"]);
  if (!STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  // Raw text, never re-serialised JSON — the signature is over these exact bytes.
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: any;
  try {
    event = verifyWebhook(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    // Covers a forged signature AND a replayed one outside the 300s tolerance.
    // Never fall through to JSON.parse: an unverified body is not an event.
    console.error(
      JSON.stringify({
        at: "webhooks/stripe",
        event: "signature_rejected",
        reason: e?.type ?? e?.name ?? "unknown",
      })
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Service role, not the anon client. Stripe posts with no cookies, so there is
  // no session and auth.uid() is null. Under RLS that made every insert with a
  // .select() chained onto it fail: the insert policy allowed the write, the
  // select policy denied the RETURNING, and Postgres rolled the whole statement
  // back. Digital purchases vanished exactly that way. It is also why
  // notifyCreator's auth.admin.getUserById call could never have worked.
  const supabase = await createServiceClient();

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

    // ── Platform subscription (creator's monthly fee) ───────────────
    if (type === "platform_subscription" && s.subscription && meta.user_id) {
      let trialEnd = new Date(Date.now() + 30 * 86400000).toISOString();
      let billingStatus = "trial";
      try {
        const { getSecrets } = await import("@/lib/settings");
        const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
        if (STRIPE_SECRET_KEY) {
          const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${s.subscription}`, {
            headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
          });
          const sub = await subRes.json();
          if (sub.trial_end) trialEnd = new Date(sub.trial_end * 1000).toISOString();
          billingStatus = sub.status === "trialing" ? "trial" : sub.status === "active" ? "active" : "trial";
        }
      } catch { /* defaults are fine */ }
      await (supabase as any).from("creator_billing").upsert({
        user_id: meta.user_id,
        stripe_customer_id: s.customer,
        stripe_subscription_id: s.subscription,
        status: billingStatus,
        tier: "starter",
        trial_ends_at: trialEnd,
        current_period_end: trialEnd,
        grace_ends_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    // ── Tip ─────────────────────────────────────────────────────────
    // The ledger write is the point of this branch. It used to omit two NOT NULL
    // columns, never inspect the result, and return 200 — so Stripe recorded the
    // event as delivered and every tip was lost. `tips` held 0 rows.
    //
    // The Connect transfer is created by Stripe at payment time via
    // payment_intent_data[transfer_data] on the checkout session. It is NOT
    // created here, so a retry of this handler cannot produce a second transfer.
    // Retrying is therefore safe, and the unique index on stripe_session_id
    // (migration 065) makes it non-duplicating.
    if (type === "tip") {
      const built = buildTipLedgerRow({ session: s, eventId: event.id });

      // Only attempt the write when the event is well formed.
      const { error: tipErr } = built.ok
        ? await (supabase as any).from("tips").insert(built.row)
        : { error: null };

      // The whole decision lives in one pure, unit-tested function
      // (lib/tips.ts). It is what the old handler was missing: it ignored the
      // insert result and returned 200, so Stripe marked the event delivered
      // and never retried — which is how every tip was lost silently.
      const decision = tipWebhookOutcome(built, tipErr);

      if (decision.outcome !== "recorded") {
        // Structured, greppable, and carrying no customer data or secret —
        // only ids and the Postgres error code.
        console.error(
          JSON.stringify({
            at: "webhooks/stripe",
            event: `tip_${decision.outcome}`,
            reason: built.ok ? null : built.reason,
            code: tipErr?.code ?? null,
            retryable: decision.retryable,
            stripe_event_id: event.id,
            stripe_session_id: built.ok ? built.row.stripe_session_id : (s.id ?? null),
            creator_profile_id: built.ok ? built.row.creator_profile_id : null,
          })
        );
      }

      if (decision.outcome === "unprocessable") {
        return NextResponse.json({ error: "Tip could not be recorded", reason: built.ok ? null : built.reason }, { status: decision.status });
      }
      if (decision.outcome === "duplicate") {
        // Already recorded by an earlier delivery. Acknowledge and stop — a
        // second notification would tell the creator about one tip twice.
        return NextResponse.json({ received: true, deduplicated: true }, { status: decision.status });
      }
      if (decision.outcome === "write_failed") {
        // The fan has been charged and the creator has already been transferred
        // to by Stripe. Fail loudly so the retry can recover the record.
        return NextResponse.json({ error: "Could not record tip" }, { status: decision.status });
      }

      if (decision.notify && built.ok) {
        const amount = built.row.amount;
        await notifyCreator(supabase, built.row.creator_profile_id,
          `💛 New tip: $${amount.toFixed(2)}`,
          `A fan just tipped you $${amount.toFixed(2)}.`,
          `A fan sent you a <strong>$${amount.toFixed(2)} tip</strong>. The full amount goes directly to your Stripe account.`
        );
      }
    }

    // ── Super Tip ────────────────────────────────────────────────────
    else if (type === "super_tip") {
      const amount = parseFloat(meta.amount_usd ?? "0");
      // Creator keeps 100% of the tip; platform revenue is the fan-paid recognition fee.
      const creatorReceives = amount;
      const platformReceives = parseFloat(meta.recognition_usd ?? "0");
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
        `<strong>${meta.fan_display_name}</strong> sent you a <strong>⭐ Super Tip of $${amount.toFixed(2)}</strong>. You receive $${creatorReceives.toFixed(2)} (100%).${msgNote}`
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

      const { data: subCreator } = await (supabase as any).from("creator_profiles").select("handle").eq("id", meta.creator_profile_id).maybeSingle();
      await sendAdminAlert(
        `New subscriber → @${subCreator?.handle ?? "?"}`,
        "New subscriber. 🎉",
        [
          `Creator: <strong>@${subCreator?.handle ?? "unknown"}</strong>`,
          `Tier: ${tierDisplay ? tierDisplay.slice(3) : "premium"}`,
          `Billing: ${meta.billing_period || "monthly"}`,
        ]
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
        tier_id: meta.tier_id || null,
        backer_code: meta.backer_code || null,
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

    // ── Social follow-back (mark paid + tell the creator who to follow) ──
    else if (type === "social_addback") {
      const { data: order } = await (supabase as any)
        .from("social_addback_orders")
        .select("id, addback_id, fan_handle, message, amount_usd, status")
        .eq("stripe_session_id", s.id)
        .maybeSingle();

      // Guard on 'pending' so webhook retries never double-notify.
      if (order && order.status === "pending") {
        await (supabase as any).from("social_addback_orders")
          .update({ status: "paid" }).eq("id", order.id);

        const { data: addback } = await (supabase as any)
          .from("social_addbacks")
          .select("platform, creator_profile_id")
          .eq("id", order.addback_id)
          .maybeSingle();

        if (addback) {
          const labels: Record<string, string> = {
            instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube",
            twitter: "X / Twitter", twitch: "Twitch", discord: "Discord",
            spotify: "Spotify", snapchat: "Snapchat",
          };
          const platformLabel = labels[addback.platform] ?? addback.platform;
          const amt = Number(order.amount_usd ?? (s.amount_total ?? 0) / 100);
          await notifyCreator(supabase, addback.creator_profile_id,
            `${platformLabel} follow-back — $${amt.toFixed(2)}`,
            `Follow @${order.fan_handle} on ${platformLabel}.`,
            `New follow-back order. Follow <strong>@${order.fan_handle}</strong> on ${platformLabel}.${order.message ? `<br><br>Their note: <em>"${order.message}"</em>` : ""}<br><br>You keep 100%. Open Social in your dashboard to mark it done once you've followed back.`
          );
        }
      }
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

    // ── Medal Pack purchase (100% platform) ──────────────────────────
    else if (type === "medal_pack" && meta.fan_user_id) {
      const medals = parseInt(meta.medals ?? "0", 10);
      await (supabase as any).from("medal_purchases").insert({
        fan_user_id: meta.fan_user_id,
        pack_id: meta.pack_id,
        medals,
        amount_usd: parseFloat(meta.amount_usd ?? "0"),
        stripe_session: s.id,
      });
      // Credit the fan's balance (create the row if needed).
      const { data: bal } = await (supabase as any)
        .from("medal_balances").select("balance, lifetime_purchased").eq("fan_user_id", meta.fan_user_id).maybeSingle();
      await (supabase as any).from("medal_balances").upsert({
        fan_user_id: meta.fan_user_id,
        balance: (bal?.balance ?? 0) + medals,
        lifetime_purchased: (bal?.lifetime_purchased ?? 0) + medals,
        updated_at: new Date().toISOString(),
      }, { onConflict: "fan_user_id" });
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
        sendNotifyEmail({
            to: meta.recipient_email,
            subject: `🎁 You've been gifted a ${meta.months}-month subscription to @${profile?.handle}`,
            preview: `Someone gifted you a subscription on Spotlightly.`,
            body: `You've received a <strong>${meta.months}-month subscription</strong> to <strong>@${profile?.handle}</strong> on Spotlightly.<br><br>
Your redemption code: <strong style="font-family:monospace;font-size:18px;letter-spacing:0.1em;">${gift.redemption_code}</strong><br><br>
<a href="https://spotlightly.app/redeem?code=${gift.redemption_code}" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:700;">Redeem your gift →</a>`,
          }).catch(() => {});
      }
    }

    // ── Digital product purchase ──────────────────────────────────────
    else if ((type === "digital_product" || type === "digital_purchase") && meta.product_id) {
      const priceTotal = (s.amount_total ?? 0) / 100; // what the fan paid (incl. card fee)
      const platformFee = 0; // 0% on digital — fan covers the card fee, creator keeps 100%
      const creatorEarns = meta.net_usd ? Number(meta.net_usd) : priceTotal;

      const { data: purchase, error: purchaseErr } = await (supabase as any)
        .from("digital_purchases")
        .insert({
          digital_product_id: meta.product_id,
          creator_profile_id: meta.creator_profile_id,
          fan_user_id: meta.fan_user_id || null,
          fan_email: meta.fan_email || s.customer_details?.email || "",
          amount_paid: priceTotal,
          platform_fee: platformFee,
          creator_receives: creatorEarns,
          stripe_session_id: s.id,
        })
        .select()
        .single();

      if (purchaseErr || !purchase) {
        // The buyer has paid and has nothing. Fail loudly so Stripe retries
        // rather than recording a success that never happened.
        console.error(`DIGITAL PURCHASE INSERT FAILED for session ${s.id}:`, purchaseErr);
        return NextResponse.json({ error: "Could not record purchase" }, { status: 500 });
      }

      // Update product sales count
      if (purchase) {
        const { data: prod } = await (supabase as any).from("digital_products").select("total_sales").eq("id", meta.product_id).maybeSingle();
        await (supabase as any).from("digital_products").update({ total_sales: (prod?.total_sales ?? 0) + 1 }).eq("id", meta.product_id);
      }

      // Email fan with download link
      if (purchase && s.customer_details?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spotlightly.app";
        const { data: product } = await (supabase as any)
          .from("digital_products")
          .select("title, creator:creator_profile_id(display_name, handle)")
          .eq("id", meta.product_id)
          .maybeSingle();

        sendNotifyEmail({
            to: s.customer_details.email,
            subject: `Your download is ready — ${product?.title}`,
            preview: "Your purchase is ready to download.",
            body: `Thanks for your purchase!<br><br>
<strong style="color:#fff;font-size:18px;">${product?.title}</strong><br>
from ${product?.creator?.display_name ?? "a creator"} on Spotlightly<br><br>
<a href="${appUrl}/api/digital/download?token=${purchase.download_token}" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:700;padding:14px 28px;border-radius:999px;text-decoration:none;font-size:14px;">
  Download now →
</a><br><br>
<span style="font-size:12px;color:rgba(242,242,240,0.3);">This link is unique to your purchase. Keep it safe. Bookmark it for future downloads.</span>`,
          }).catch((e) => {
            // The buyer has paid. If this email does not go out they have nothing,
            // and a silent catch leaves no trace anywhere. Make it findable.
            console.error(
              `DELIVERY FAILED: digital purchase ${purchase.id} to ${s.customer_details?.email}. ` +
              `Download token ${purchase.download_token}. Reason:`, e
            );
          });

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

    // ── Merch (Loudcap fulfillment) ──────────────────────────────────
    else if (type === "merch" && meta.product_id) {
      const retail = parseFloat(meta.retail_price ?? "0");
      const creatorEarnings = parseFloat(meta.creator_earns ?? "0");
      const platformEarnings = parseFloat(meta.platform_earnings ?? "0");
      const ship = s.shipping_details ?? s.customer_details ?? {};
      const addr = ship.address ?? {};
      const fanEmail = s.customer_details?.email ?? "";

      // Place the fulfillment order with Loudcap. Never block recording the sale
      // on this — the creator has already been paid. If it can't be placed, the
      // order is stored as unfulfilled and the admin is alerted (not swallowed).
      let loudcapOrderId = `unfulfilled_${s.id}`;
      let orderStatus = "pending";
      let trackingNumber: string | null = null;
      let trackingUrl: string | null = null;
      let fulfillError: string | null = null;

      try {
        const { LOUDCAP_API_KEY } = await getSecrets(["LOUDCAP_API_KEY"]);
        if (!LOUDCAP_API_KEY) {
          fulfillError = "LOUDCAP_API_KEY not set";
        } else {
          const auth = { Authorization: `Bearer ${LOUDCAP_API_KEY}`, "Content-Type": "application/json" };

          // The exact variant the fan bought, resolved at checkout from the
          // product's variant_map. No fuzzy name matching, no silent fallback.
          let variantId: number | null =
            meta.loudcap_variant_id && Number.isFinite(Number(meta.loudcap_variant_id))
              ? Number(meta.loudcap_variant_id)
              : null;

          // Backward-compat: legacy products (created before variant_map) carry
          // no variant id. Resolve by exact size, and only then.
          if (!variantId && meta.loudcap_product_id) {
            const prodRes = await fetch(`https://api.printful.com/store/products/${meta.loudcap_product_id}`, { headers: auth });
            if (prodRes.ok) {
              const { result } = await prodRes.json();
              const variants = result?.sync_variants ?? [];
              const wanted = String(meta.size ?? "").trim().toLowerCase();
              const match = variants.find((v: any) => {
                const sz = String(v.size ?? "").trim().toLowerCase();
                if (sz && sz === wanted) return true;
                const tail = String(v.name ?? "").split("/").pop()?.trim().toLowerCase();
                return !!wanted && tail === wanted;
              });
              // Only auto-pick when the product has exactly one variant.
              variantId = match?.id ?? (variants.length === 1 ? variants[0]?.id : null) ?? null;
            }
          }

          if (!variantId) {
            fulfillError = `No matching Loudcap variant for size "${meta.size ?? "?"}"`;
          } else {
            const orderRes = await fetch("https://api.printful.com/orders?confirm=1", {
              method: "POST",
              headers: auth,
              body: JSON.stringify({
                external_id: `sl_${s.id}`, // idempotency guard against webhook retries
                recipient: {
                  name: ship.name ?? "",
                  address1: addr.line1 ?? "",
                  address2: addr.line2 ?? "",
                  city: addr.city ?? "",
                  state_code: addr.state ?? "",
                  zip: addr.postal_code ?? "",
                  country_code: addr.country ?? "US",
                  email: fanEmail,
                },
                items: [{ sync_variant_id: variantId, quantity: 1 }],
              }),
            });
            if (orderRes.ok) {
              const { result } = await orderRes.json();
              loudcapOrderId = String(result?.id ?? loudcapOrderId);
              orderStatus = "in_production";
              trackingNumber = result?.shipments?.[0]?.tracking_number ?? null;
              trackingUrl = result?.shipments?.[0]?.tracking_url ?? null;
            } else {
              fulfillError = `Loudcap order rejected (HTTP ${orderRes.status}): ${(await orderRes.text()).slice(0, 300)}`;
            }
          }
        }
      } catch (e: any) {
        fulfillError = `Loudcap order threw: ${e?.message ?? "unknown"}`;
      }

      // Make a failed fulfillment VISIBLE so it can be placed manually.
      if (fulfillError) {
        sendAdminAlert(
          `Merch order needs manual fulfillment — ${meta.product_name ?? "product"}`,
          "A paid merch order didn't reach Loudcap.",
          [
            `Product: ${meta.product_name ?? "?"}${meta.size ? ` (${meta.size})` : ""}`,
            `Reason: ${fulfillError}`,
            `Fan email: ${fanEmail || "unknown"}`,
            `Stripe session: ${s.id}`,
            `Ship to: ${ship.name ?? ""}, ${addr.city ?? ""} ${addr.state ?? ""} ${addr.postal_code ?? ""} ${addr.country ?? ""}`,
          ]
        ).catch(() => {});
      }

      await (supabase as any).from("merch_orders").insert({
        merch_product_id: meta.product_id,
        creator_profile_id: meta.creator_profile_id,
        fan_user_id: meta.buyer_user_id || null,
        loudcap_order_id: loudcapOrderId,
        variant_id: meta.size || "default",
        quantity: 1,
        retail_price: retail,
        creator_earnings: creatorEarnings,
        platform_earnings: platformEarnings,
        stripe_payment_id: s.payment_intent ?? s.id,
        status: orderStatus,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        shipping_name: ship.name ?? "",
        shipping_line1: addr.line1 ?? "",
        shipping_city: addr.city ?? "",
        shipping_state: addr.state ?? "",
        shipping_zip: addr.postal_code ?? "",
        shipping_country: addr.country ?? "US",
      });

      await notifyCreator(supabase, meta.creator_profile_id,
        `🧢 New merch order — ${meta.product_name}`,
        `Someone ordered your ${meta.product_name}.`,
        `A fan ordered your <strong>${meta.product_name}</strong>${meta.size ? ` (${meta.size})` : ""}. You earn <strong style="color:#F0B429;">$${creatorEarnings.toFixed(2)}</strong> — Loudcap handles printing and shipping. Track it from your dashboard.`
      );
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
        try {
          const { getSecrets } = await import("@/lib/settings");
          const { pauseFanSubscriptionsForCreator } = await import("@/lib/billing");
          const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
          if (STRIPE_SECRET_KEY) await pauseFanSubscriptionsForCreator(supabase, STRIPE_SECRET_KEY, meta.user_id);
        } catch { /* non-fatal */ }
        const { data: au } = await supabase.auth.admin.getUserById(meta.user_id);
        if (au?.user?.email) {
          sendNotifyEmail({
              to: au.user.email,
              subject: "Your Spotlightly subscription has ended",
              preview: "Your creator account has been deactivated.",
              body: `Your Spotlightly subscription has ended and your creator features have been paused.<br><br>Your content and subscribers are safe — reactivate anytime at <a href="https://spotlightly.app/dashboard?pane=billing">spotlightly.app/dashboard</a>.`,
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

          sendNotifyEmail({
              to: au.user.email,
              subject: `Your Spotlightly trial ends in ${daysLeft} days`,
              preview: "Add a payment method to keep your creator account active.",
              body: `Your 30-day free trial ends on <strong>${trialEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.<br><br>
Add a payment method before then to keep your creator account active. If you don't, your account will be paused — your content and subscribers will be saved, but you won't be able to accept payments.<br><br>
<a href="https://spotlightly.app/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Add payment method →</a>`,
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

    // ── Fan subscription revenue ledger ───────────────────────────────────
    // A fan paying a creator, as opposed to a creator paying Spotlightly. The
    // subscriptions table only held current state, so recurring revenue was
    // never countable. One row per invoice; stripe_invoice_id is unique, so a
    // replayed event cannot double count.
    if (invoice.subscription) {
      const { data: fanSub } = await (supabase as any)
        .from("subscriptions")
        .select("id, creator_profile_id, fan_user_id")
        .eq("stripe_subscription_id", invoice.subscription)
        .maybeSingle();

      if (fanSub?.creator_profile_id && (invoice.amount_paid ?? 0) > 0) {
        const gross = (invoice.amount_paid ?? 0) / 100;
        // Fans cover Stripe on subscriptions, so the creator keeps their full
        // net. application_fee_amount is exactly the gross-up, not a cut.
        const appFee = (invoice.application_fee_amount ?? 0) / 100;
        const { error: ledgerErr } = await (supabase as any)
          .from("subscription_payments")
          .insert({
            subscription_id: fanSub.id,
            creator_profile_id: fanSub.creator_profile_id,
            fan_user_id: fanSub.fan_user_id ?? null,
            gross_usd: gross,
            platform_fee_usd: appFee,
            creator_receives: Math.max(gross - appFee, 0),
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: invoice.subscription,
            status: "paid",
          });
        // Duplicate invoice ids are expected on replays and are not an error.
        if (ledgerErr && !/duplicate key/i.test(ledgerErr.message ?? "")) {
          console.error("Subscription ledger insert failed:", ledgerErr);
        }
      }
    }

    if (invoice.subscription) {
      const { data: billing } = await (supabase as any)
        .from("creator_billing")
        .select("user_id, tier, stripe_subscription_id")
        .eq("stripe_subscription_id", invoice.subscription)
        .maybeSingle();

      if (billing) {
        // Real payment cleared — lift any past-due/grace and reactivate.
        if ((invoice.amount_paid ?? 0) > 0) {
          await (supabase as any).from("creator_billing")
            .update({ status: "active", grace_ends_at: null, last_dunning_warned_at: null, updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", invoice.subscription);
          try {
            const { getSecrets } = await import("@/lib/settings");
            const { resumeFanSubscriptionsForCreator } = await import("@/lib/billing");
            const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
            if (STRIPE_SECRET_KEY) await resumeFanSubscriptionsForCreator(supabase, STRIPE_SECRET_KEY, billing.user_id);
          } catch { /* non-fatal */ }
        }
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
        .select("user_id, grace_ends_at")
        .eq("stripe_subscription_id", invoice.subscription)
        .maybeSingle();

      if (billing) {
        // Declined card → past_due with a 7-day grace window (set once per cycle).
        const graceEnds = billing.grace_ends_at ?? new Date(Date.now() + 7 * 86400000).toISOString();
        await (supabase as any).from("creator_billing")
          .update({ status: "past_due", grace_ends_at: graceEnds, last_dunning_warned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", invoice.subscription);

        const { data: au } = await supabase.auth.admin.getUserById(billing.user_id);
        if (au?.user?.email) {
          sendNotifyEmail({
              to: au.user.email,
              subject: "Payment failed — action required",
              preview: "We couldn't process your Spotlightly subscription payment.",
              body: `We couldn't process your Spotlightly subscription payment. Please update your payment method to keep your creator account active.<br><br>
<a href="https://spotlightly.app/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Update payment method →</a>`,
            }).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
