import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { sendNotifyEmail } from "@/lib/email";
import { writeOrLog } from "@/lib/db";
import {
  normalizeCode,
  checkPromo,
  quote,
  type PromoCodeRow,
} from "@/lib/promotions";

// Digital is 0% to Spotlightly: the fan covers the card fee and the creator
// keeps 100% (matches the "0% cut" promise on the niche pages).
//
// Discounts (a sale price on the product, or a promo code the buyer types) come
// off the creator's price BEFORE the gross up, so the creator nets exactly the
// discounted price and the fan pays that plus the card fee. Every number is
// recomputed here from the database row, so a request that lies about the price
// or the code just gets charged the real amount.
//
// NOTE: very large files cost real BunnyCDN storage/bandwidth. A size-based
// hosting fee can be added here once a threshold + amount are decided.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = await req.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  const rawCode = normalizeCode(body.code);
  const typedEmail = typeof body.email === "string" ? body.email.trim() : "";

  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const { data: product } = await (supabase as any)
    .from("digital_products")
    .select("*, creator:creator_profile_id(stripe_account_id, handle, display_name)")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // ── Resolve the code, if one was typed ──────────────────────────────────
  // Service role: promo_codes has no public read policy by design.
  const service = await createServiceClient();
  let promo: PromoCodeRow | null = null;

  if (rawCode.length >= 3) {
    const { data: rows, error: codeErr } = await (service as any)
      .from("promo_codes")
      .select("*")
      .eq("creator_profile_id", product.creator_profile_id)
      .ilike("code", rawCode)
      .limit(1);

    if (codeErr) {
      console.error("digital/purchase promo lookup failed:", codeErr);
      return NextResponse.json({ error: "Could not check that code. Try again." }, { status: 500 });
    }

    const found = (rows ?? [])[0] as PromoCodeRow | undefined;
    if (!found) return NextResponse.json({ error: "That code is not valid for this product." }, { status: 400 });

    const verdict = checkPromo(found, product, new Date());
    if (!verdict.ok) return NextResponse.json({ error: verdict.reason }, { status: 400 });

    promo = found;
  }

  const q = quote(product, promo, new Date());

  if (q.belowStripeMinimum) {
    return NextResponse.json(
      { error: "That code brings this below the minimum a card can be charged." },
      { status: 400 }
    );
  }

  // ── Free: skip Stripe entirely ──────────────────────────────────────────
  // A 100% code, or a sale price of zero. There is no card charge to make, and
  // going near Stripe would only fail at its 50 cent floor. Record the purchase
  // and hand over the download the same way the webhook would.
  if (q.free) {
    const email = (user?.email || typedEmail).trim();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { needEmail: true, error: "Enter your email and we will send the download link." },
        { status: 200 }
      );
    }

    // Already claimed it. Hand back the same download rather than minting a
    // second row (and, for a code, tripping the one per buyer index).
    const { data: existing } = await (service as any)
      .from("digital_purchases")
      .select("download_token")
      .eq("digital_product_id", product.id)
      .ilike("fan_email", email)
      .maybeSingle();

    if (existing?.download_token) {
      return NextResponse.json({ free: true, downloadUrl: `/api/digital/download?token=${existing.download_token}` });
    }

    if (promo) {
      const { data: prior } = await (service as any)
        .from("promo_redemptions")
        .select("id")
        .eq("promo_code_id", promo.id)
        .ilike("fan_email", email)
        .maybeSingle();
      if (prior) return NextResponse.json({ error: "You have already used that code." }, { status: 400 });
    }

    const { data: purchase, error: purchaseErr } = await (service as any)
      .from("digital_purchases")
      .insert({
        digital_product_id: product.id,
        creator_profile_id: product.creator_profile_id,
        fan_user_id: user?.id ?? null,
        fan_email: email,
        amount_paid: 0,
        platform_fee: 0,
        creator_receives: 0,
        list_price: q.listCents / 100,
        discount_amount: (q.listCents - q.netCents) / 100,
        promo_code_id: promo?.id ?? null,
      })
      .select()
      .single();

    if (purchaseErr || !purchase) {
      console.error("FREE DIGITAL GRANT INSERT FAILED:", purchaseErr);
      return NextResponse.json({ error: "Could not record that. Try again." }, { status: 500 });
    }

    if (promo) {
      await writeOrLog(
        "digital/purchase insert promo_redemptions",
        (service as any).from("promo_redemptions").insert({
          promo_code_id: promo.id,
          creator_profile_id: product.creator_profile_id,
          digital_product_id: product.id,
          digital_purchase_id: purchase.id,
          fan_user_id: user?.id ?? null,
          fan_email: email,
          discount_amount: (q.listCents - q.netCents) / 100,
        })
      );
      await writeOrLog(
        "digital/purchase increment promo_codes",
        (service as any)
          .from("promo_codes")
          .update({ redemption_count: (promo.redemption_count ?? 0) + 1 })
          .eq("id", promo.id)
      );
    }

    await writeOrLog(
      "digital/purchase free grant total_sales",
      (service as any)
        .from("digital_products")
        .update({ total_sales: (product.total_sales ?? 0) + 1 })
        .eq("id", product.id)
    );

    const freeAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spotlightly.app";
    sendNotifyEmail({
      to: email,
      subject: `Your download is ready — ${product.title}`,
      preview: "Your download is ready.",
      body: `<strong style="color:#fff;font-size:18px;">${product.title}</strong><br>
from ${product.creator?.display_name ?? "a creator"} on Spotlightly<br><br>
<a href="${freeAppUrl}/api/digital/download?token=${purchase.download_token}" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:700;padding:14px 28px;border-radius:999px;text-decoration:none;font-size:14px;">
  Download now →
</a><br><br>
<span style="font-size:12px;color:rgba(242,242,240,0.3);">This link is unique to you. Bookmark it for future downloads.</span>`,
    }).catch((e) => {
      console.error(
        `DELIVERY FAILED: free digital grant ${purchase.id} to ${email}. ` +
        `Download token ${purchase.download_token}. Reason:`, e
      );
    });

    return NextResponse.json({ free: true, downloadUrl: `/api/digital/download?token=${purchase.download_token}` });
  }

  // ── Paid: Stripe checkout at the discounted price ───────────────────────
  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spotlightly.app";
  const netCents = q.netCents;
  const fanCents = q.fanCents; // fan covers the card fee on the discounted price

  // Stripe rejects an empty string here rather than treating it as absent, so the
  // parameter is only sent when there is something to send. Any product without a
  // description was failing at checkout, which bundles surfaced first because
  // they are the first thing a creator makes without writing one.
  const description = (product.description ?? "").trim().slice(0, 255);

  const params = new URLSearchParams({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": product.title,
    "line_items[0][price_data][unit_amount]": String(fanCents),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${appUrl}/downloads?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/${product.creator.handle}`,
    "metadata[product_id]": productId,
    "metadata[creator_profile_id]": product.creator_profile_id,
    "metadata[fan_user_id]": user?.id ?? "",
    "metadata[fan_email]": user?.email ?? "",
    "metadata[type]": "digital_purchase",
    "metadata[net_usd]": (netCents / 100).toFixed(2),
    "metadata[list_usd]": (q.listCents / 100).toFixed(2),
    "metadata[discount_usd]": ((q.listCents - netCents) / 100).toFixed(2),
  });

  if (promo) {
    params.set("metadata[promo_code_id]", promo.id);
    params.set("metadata[promo_code]", promo.code.toUpperCase());
  }

  if (product.creator.stripe_account_id) {
    params.set("payment_intent_data[transfer_data][destination]", product.creator.stripe_account_id);
    params.set("payment_intent_data[transfer_data][amount]", String(netCents)); // creator keeps 100% of the discounted price
  }

  if (description) {
    params.set("line_items[0][price_data][product_data][description]", description);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const session = await res.json();
  if (!res.ok) return NextResponse.json({ error: session.error?.message ?? "Checkout failed" }, { status: 500 });
  return NextResponse.json({ url: session.url });
}
