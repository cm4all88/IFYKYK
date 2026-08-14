import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import {
  normalizeCode,
  checkPromo,
  quote,
  describeDiscount,
  type PromoCodeRow,
} from "@/lib/promotions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Codes are short and typed by hand, so this endpoint is guessable by anyone
// willing to sit there hammering it. A per-instance throttle will not stop a
// determined attacker across a serverless fleet, but it does stop a script, and
// the real ceiling is the creator's own max_redemptions.
const ATTEMPTS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (ATTEMPTS.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  ATTEMPTS.set(key, hits);
  if (ATTEMPTS.size > 5000) ATTEMPTS.clear(); // crude ceiling, this is not a cache
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (throttled(ip)) {
    return NextResponse.json({ ok: false, error: "Too many tries. Wait a minute and try again." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  const code = normalizeCode(body.code);

  if (!productId) return NextResponse.json({ ok: false, error: "Missing product" }, { status: 400 });
  if (code.length < 3) return NextResponse.json({ ok: false, error: "Enter a code." }, { status: 400 });

  // Service role on purpose. promo_codes has no public read policy and no anon
  // grant: a visitor who could query the table could list every code a creator
  // has ever made. This route answers one question about one code instead.
  const service = await createServiceClient();

  const { data: product, error: productErr } = await (service as any)
    .from("digital_products")
    .select("id, creator_profile_id, price, sale_price, sale_starts_at, sale_ends_at, title")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (productErr) {
    console.error("promo/validate product lookup failed:", productErr);
    return NextResponse.json({ ok: false, error: "Could not check that code. Try again." }, { status: 500 });
  }
  if (!product) return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });

  const { data: rows, error: codeErr } = await (service as any)
    .from("promo_codes")
    .select("*")
    .eq("creator_profile_id", product.creator_profile_id)
    .ilike("code", code)
    .limit(1);

  if (codeErr) {
    console.error("promo/validate code lookup failed:", codeErr);
    return NextResponse.json({ ok: false, error: "Could not check that code. Try again." }, { status: 500 });
  }

  const promo = (rows ?? [])[0] as PromoCodeRow | undefined;
  if (!promo) return NextResponse.json({ ok: false, error: "That code is not valid for this product." }, { status: 200 });

  const verdict = checkPromo(promo, product, new Date());
  if (!verdict.ok) return NextResponse.json({ ok: false, error: verdict.reason }, { status: 200 });

  // Already used it, and we can tell. Only possible for a signed in buyer; a
  // logged out buyer's email is not known until Stripe collects it.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    const { data: prior } = await (service as any)
      .from("promo_redemptions")
      .select("id")
      .eq("promo_code_id", promo.id)
      .ilike("fan_email", user.email)
      .maybeSingle();
    if (prior) return NextResponse.json({ ok: false, error: "You have already used that code." }, { status: 200 });
  }

  const q = quote(product, promo, new Date());

  if (q.belowStripeMinimum) {
    return NextResponse.json(
      { ok: false, error: "That code brings this below the minimum a card can be charged." },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    code: promo.code.toUpperCase(),
    label: describeDiscount(promo),
    listCents: q.listCents,
    fullCents: q.fullCents,
    discountCents: q.discountCents,
    netCents: q.netCents,
    fanCents: q.fanCents,
    free: q.free,
    saleLive: q.saleLive,
  });
}
