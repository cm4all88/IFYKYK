import { NextRequest, NextResponse } from "next/server";
import { getPayeeCreator } from "@/lib/payee";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { grossUpForStripe } from "@/lib/fees";
import { finishAttempt, guardTipCheckout, validateTipPost } from "@/lib/trust/tip-guard";
import { normalizeTipSource, type TipSource } from "@/lib/trust/tip-state";

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/tip
//
// Creates a Stripe Checkout session for a standard tip. Creators keep 100%; the
// fan covers the card fee (lib/fees.ts).
//
// ORDER OF OPERATIONS (trust and safety, see lib/trust/*):
//   1. guardTipCheckout: creator eligibility, velocity limits, attempt log.
//      If it refuses, Stripe is never called.
//   2. tips row inserted as status "checkout_created". This is NOT a tip yet.
//   3. Checkout session created with tip_id in metadata.
//   4. Only the verified webhook moves the row to "succeeded".
//
// Accepts a form post (TipButton without JS) or JSON / FormData via fetch.
// Fetch callers get JSON { url } or { error }; plain form posts get a 303.
// The creator is NOT notified here any more: a notification now means money
// actually arrived (moved to the webhook, closes SL-022).
// ──────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";

type Body = { creatorProfileId: string | null; amountUsd: number; postId: string | null; source: string | null };

async function readBody(req: NextRequest): Promise<Body> {
  const ct = req.headers.get("content-type") ?? "";
  let raw: Record<string, unknown> = {};
  try {
    if (ct.includes("application/json")) {
      raw = (await req.json()) ?? {};
    } else {
      const fd = await req.formData();
      raw = Object.fromEntries(fd.entries());
    }
  } catch {
    raw = {};
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);
  return {
    creatorProfileId: str(raw.creator_profile_id),
    amountUsd: Math.max(1, Math.min(1000, Number(raw.amount_usd) || 5)),
    postId: str(raw.post_id),
    source: str(raw.tip_source),
  };
}

function wantsJson(req: NextRequest): boolean {
  const accept = req.headers.get("accept") ?? "";
  const ct = req.headers.get("content-type") ?? "";
  return accept.includes("application/json") || ct.includes("application/json") || req.headers.get("x-requested-with") === "fetch";
}

export async function POST(req: NextRequest) {
  const body = await readBody(req);
  const json = wantsJson(req);
  const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

  if (!body.creatorProfileId) return fail(400, "Missing creator_profile_id");

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return fail(503, "Tipping not yet available.");

  const supabase = await createClient();
  // Auth is optional; guests can tip without an account.
  const { data: { user } } = await supabase.auth.getUser();

  // Connect routing data via the service role (lib/payee.ts).
  const profile = await getPayeeCreator(body.creatorProfileId);
  if (!profile) return fail(404, "We couldn't find that creator.");

  // Source is decided server side from what we can verify. A post id that is
  // not a live post of this creator is rejected rather than silently dropped.
  let postId: string | null = null;
  let source: TipSource = "profile";
  if (body.postId) {
    const { createServiceClient } = await import("@/lib/supabase-server");
    const admin = await createServiceClient();
    postId = await validateTipPost(admin, profile.id, body.postId);
    if (!postId) return fail(400, "That post isn't available for tips.");
    source = "post";
  } else if (body.source) {
    const s = normalizeTipSource(body.source);
    source = s === "unknown" || s === "post" || s === "live_stream" ? "other" : s;
  }

  const guard = await guardTipCheckout({
    kind: "tip",
    creatorProfileId: profile.id,
    fanUserId: user?.id ?? null,
    headers: req.headers,
    amountUsd: body.amountUsd,
    postId,
    source,
  });
  if (!guard.ok) return fail(guard.status, guard.message);
  const { admin, config, attemptId } = guard;

  // Fan covers the card fee so the creator receives the FULL tip.
  const tipCents = Math.round(body.amountUsd * 100);
  const totalCents = grossUpForStripe(tipCents);
  const feeCents = totalCents - tipCents;

  // 1. Ledger row, not yet money.
  const { data: tipRow, error: tipErr } = await admin.from("tips").insert({
    creator_profile_id: profile.id,
    fan_user_id: user?.id ?? null,
    amount: tipCents / 100,
    creator_receives: 0,
    platform_receives: 0,
    currency: "usd",
    status: "checkout_created",
    tip_source: source,
    post_id: postId,
  }).select("id").single();
  if (tipErr || !tipRow) {
    console.error(JSON.stringify({ at: "api/tip", event: "tip_row_insert_failed", code: tipErr?.code ?? null }));
    await finishAttempt(admin, attemptId, { outcome: "internal_error", block_reason: "tip_row_insert_failed" });
    return fail(503, "Tips are briefly unavailable. Please try again in a few minutes.");
  }
  const tipId: string = tipRow.id;

  const origin = new URL(req.url).origin;
  const expiresAt = Math.floor(Date.now() / 1000) + config.tipSessionExpiryMinutes * 60;

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": `Tip for @${profile.handle}`,
    "line_items[0][price_data][product_data][description]": `Includes a $${(feeCents / 100).toFixed(2)} card fee so your full $${body.amountUsd.toFixed(2)} reaches @${profile.handle}.`,
    "line_items[0][price_data][unit_amount]": String(totalCents),
    "line_items[0][quantity]": "1",
    // Creator receives the full tip; the grossed up fee stays on the platform to cover Stripe.
    "payment_intent_data[transfer_data][destination]": profile.stripe_account_id!,
    "payment_intent_data[transfer_data][amount]": String(tipCents),
    // Lets payment_intent.* events find the tip without a session lookup.
    "payment_intent_data[metadata][type]": "tip",
    "payment_intent_data[metadata][tip_id]": tipId,
    "payment_intent_data[metadata][creator_profile_id]": profile.id,
    "success_url": `${origin}/${profile.handle}?tipped=1`,
    "cancel_url": `${origin}/${profile.handle}`,
    "expires_at": String(expiresAt),
    "metadata[creator_profile_id]": profile.id,
    "metadata[type]": "tip",
    "metadata[tip_id]": tipId,
    "metadata[tip_source]": source,
    "metadata[amount_usd]": String(body.amountUsd),
    "metadata[fan_paid_usd]": (totalCents / 100).toFixed(2),
  });
  if (postId) params.set("metadata[post_id]", postId);
  if (user) {
    params.set("client_reference_id", user.id);
    params.set("metadata[fan_user_id]", user.id);
  }

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Retrying this request with the same key returns the same session.
      "Idempotency-Key": `tip_${tipId}`,
    },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    console.error("Stripe tip error:", err.slice(0, 500));
    await admin.from("tips").update({ status: "failed", failure_reason: "checkout_create_failed", failed_at: new Date().toISOString(), status_updated_at: new Date().toISOString() }).eq("id", tipId);
    await finishAttempt(admin, attemptId, { tip_id: tipId, outcome: "stripe_error" });
    return fail(500, "Could not start checkout");
  }

  const session = await stripeRes.json();
  await admin.from("tips").update({ stripe_session_id: session.id }).eq("id", tipId);
  await finishAttempt(admin, attemptId, { tip_id: tipId, stripe_session_id: session.id });

  if (json) return NextResponse.json({ url: session.url });
  return NextResponse.redirect(session.url, { status: 303 });
}
