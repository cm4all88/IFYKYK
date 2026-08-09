import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { sendMerchShippedEmail, sendAdminAlert } from "@/lib/email";
import { writeOrLog } from "@/lib/db";

export const runtime = "nodejs";

// ──────────────────────────────────────────────────────────────────
// Loudcap (Printful) → Spotlightly return channel.
//
// This is the half of the integration that was missing: Loudcap talking BACK.
// It updates a merch order's status + tracking as fulfillment progresses and
// notifies the fan when their package ships / is delivered.
//
// SETUP (one time):
//   1. Set env var PRINTFUL_WEBHOOK_SECRET to a long random string.
//   2. In Printful, register this webhook URL (Settings → API → Webhooks, or
//      via API). Use the URL WITH the secret query param:
//        https://spotlightly.app/api/webhooks/printful?key=YOUR_SECRET
//      Enable events: package_shipped, order_updated, order_failed,
//      order_canceled, order_refunded.
//
// Security: Printful v1 webhooks aren't HMAC-signed, so we (a) require the
// shared secret in the query string and (b) key every update off our own stored
// loudcap_order_id — an attacker can't invent a real order id.
// ──────────────────────────────────────────────────────────────────

// Map a Printful order status to our merch_orders.status enum.
function mapStatus(pf?: string): string | null {
  switch ((pf ?? "").toLowerCase()) {
    case "draft":
    case "pending":
    case "inprocess":
    case "onhold":
    case "partial":     return "in_production";
    case "fulfilled":   return "shipped";
    case "canceled":
    case "cancelled":   return "cancelled";
    case "refunded":    return "refunded";
    default:            return null;
  }
}

export async function POST(req: NextRequest) {
  // ── Auth: shared secret in the URL (fail closed if unconfigured) ──
  const secret = process.env.PRINTFUL_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  if (new URL(req.url).searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const type: string = payload?.type ?? "";
  const order = payload?.data?.order ?? {};
  const shipment = payload?.data?.shipment ?? {};
  const printfulOrderId = order?.id != null ? String(order.id) : null;

  // Always 200 for events we don't act on — Printful retries on non-2xx.
  if (!printfulOrderId) return NextResponse.json({ ok: true, ignored: "no order id" });

  const supabase = await createServiceClient();

  const { data: mo } = await (supabase as any)
    .from("merch_orders")
    .select("id, status, tracking_number, fan_user_id, merch_product_id, creator_profile_id")
    .eq("loudcap_order_id", printfulOrderId)
    .maybeSingle();

  if (!mo) return NextResponse.json({ ok: true, ignored: "unknown order" });

  // Product + creator handle for nicer notifications.
  const { data: prod } = await (supabase as any)
    .from("merch_products")
    .select("name, creator:creator_profile_id(handle)")
    .eq("id", mo.merch_product_id)
    .maybeSingle();
  const productName = prod?.name ?? "your order";
  const creatorHandle = prod?.creator?.handle ?? null;

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  let notifyShipped = false;

  if (type === "package_shipped") {
    update.status = "shipped";
    if (shipment?.tracking_number) update.tracking_number = String(shipment.tracking_number);
    if (shipment?.tracking_url) update.tracking_url = String(shipment.tracking_url);
    // Only notify the first time we mark it shipped.
    if (mo.status !== "shipped" && mo.status !== "delivered") notifyShipped = true;
  } else if (type === "order_updated") {
    const mapped = mapStatus(order?.status);
    if (mapped) update.status = mapped;
  } else if (type === "order_failed") {
    // Fulfillment failed at Loudcap — keep the order as-is but alert the owner.
    sendAdminAlert(
      `Loudcap order FAILED — ${productName}`,
      "A Loudcap order failed at the vendor.",
      [`Product: ${productName}`, `Loudcap order: ${printfulOrderId}`, `Reason: ${order?.error ?? "see Printful dashboard"}`]
    ).catch(() => {});
    return NextResponse.json({ ok: true });
  } else if (type === "order_canceled") {
    update.status = "cancelled";
  } else if (type === "order_refunded") {
    update.status = "refunded";
  } else {
    return NextResponse.json({ ok: true, ignored: type });
  }

  await writeOrLog("webhooks/printful update merch_orders", (supabase as any).from("merch_orders").update(update).eq("id", mo.id));

  // ── Tell the fan their order shipped (in-app + email) ────────────
  if (notifyShipped && mo.fan_user_id) {
    const link = "/account?tab=orders";
    const body = `${productName}${creatorHandle ? ` from @${creatorHandle}` : ""} is on its way.`;

    // Service client bypasses RLS, so this insert always lands.
    await writeOrLog("webhooks/printful insert notifications", (supabase as any).from("notifications").insert({
      user_id: mo.fan_user_id, type: "merch_shipped", title: "Your order shipped 📦", body, link,
    }));

    // Email — look the fan's address up via the admin API.
    try {
      const { data: au } = await (supabase as any).auth.admin.getUserById(mo.fan_user_id);
      const email = au?.user?.email;
      if (email) {
        await sendMerchShippedEmail(email, productName, {
          trackingUrl: update.tracking_url ?? null,
          trackingNumber: update.tracking_number ?? null,
          creatorHandle,
        });
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true });
}
