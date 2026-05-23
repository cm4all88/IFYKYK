import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

// ── Helpers ───────────────────────────────────────────────────────

async function stripePost(path: string, params: URLSearchParams, secretKey: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  return res.json();
}

async function createStripePrice(params: {
  productId: string;
  amount: number; // in cents
  interval: "month" | "year";
  stripeAccountId: string;
  secretKey: string;
  tierId: string;
}) {
  const p = new URLSearchParams({
    product: params.productId,
    currency: "usd",
    unit_amount: String(params.amount),
    "recurring[interval]": params.interval,
    "metadata[tier_id]": params.tierId,
    "metadata[platform]": "spotlightly",
  });
  // Create on connected account
  const res = await fetch(`https://api.stripe.com/v1/prices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      "Stripe-Account": params.stripeAccountId,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: p.toString(),
  });
  return res.json();
}

// ── GET — list tiers for a creator ────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const creatorProfileId = searchParams.get("creatorProfileId");

  if (!creatorProfileId) return NextResponse.json({ error: "creatorProfileId required" }, { status: 400 });

  const { data: tiers } = await (supabase as any)
    .from("subscription_tiers")
    .select("*")
    .eq("creator_profile_id", creatorProfileId)
    .order("sort_order", { ascending: true })
    .order("monthly_price", { ascending: true });

  return NextResponse.json({ tiers: tiers ?? [] });
}

// ── POST — create a new tier ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { creatorProfileId, name, description, perks, monthlyPrice, yearlyDiscount } = body;

  if (!creatorProfileId || !name || !monthlyPrice) {
    return NextResponse.json({ error: "creatorProfileId, name, and monthlyPrice are required" }, { status: 400 });
  }

  // Verify ownership
  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, stripe_account_id, display_name")
    .eq("id", creatorProfileId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const discountPct = yearlyDiscount ?? 20;
  const monthlyPriceCents = Math.round(parseFloat(monthlyPrice) * 100);
  const yearlyPriceCents = Math.round(monthlyPriceCents * 12 * (1 - discountPct / 100));

  // Get current tier count for sort order
  const { count } = await (supabase as any)
    .from("subscription_tiers")
    .select("id", { count: "exact", head: true })
    .eq("creator_profile_id", creatorProfileId);

  // Create tier record first (without Stripe IDs)
  const { data: tier, error: insertError } = await (supabase as any)
    .from("subscription_tiers")
    .insert({
      creator_profile_id: creatorProfileId,
      name: name.trim(),
      description: description?.trim() || null,
      perks: Array.isArray(perks) ? perks.filter(Boolean) : [],
      monthly_price: parseFloat(monthlyPrice),
      yearly_price: discountPct > 0 ? yearlyPriceCents / 100 : null,
      yearly_discount_pct: discountPct,
      sort_order: count ?? 0,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Create Stripe prices if creator has a Connect account
  if (profile.stripe_account_id) {
    try {
      const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
      if (STRIPE_SECRET_KEY) {
        // Create Stripe Product on creator's account
        const productParams = new URLSearchParams({
          name: `${profile.display_name ?? "Creator"} — ${name.trim()}`,
          "metadata[tier_id]": tier.id,
          "metadata[creator_profile_id]": creatorProfileId,
          "metadata[platform]": "spotlightly",
        });
        const product = await fetch("https://api.stripe.com/v1/products", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            "Stripe-Account": profile.stripe_account_id,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: productParams.toString(),
        }).then(r => r.json());

        // Monthly price
        const monthlyPrice_ = await createStripePrice({
          productId: product.id,
          amount: monthlyPriceCents,
          interval: "month",
          stripeAccountId: profile.stripe_account_id,
          secretKey: STRIPE_SECRET_KEY,
          tierId: tier.id,
        });

        // Yearly price
        let yearlyPriceId = null;
        if (discountPct > 0) {
          const yearlyPrice_ = await createStripePrice({
            productId: product.id,
            amount: yearlyPriceCents,
            interval: "year",
            stripeAccountId: profile.stripe_account_id,
            secretKey: STRIPE_SECRET_KEY,
            tierId: tier.id,
          });
          yearlyPriceId = yearlyPrice_.id;
        }

        // Update tier with Stripe IDs
        await (supabase as any)
          .from("subscription_tiers")
          .update({
            stripe_product_id: product.id,
            stripe_monthly_price_id: monthlyPrice_.id,
            stripe_yearly_price_id: yearlyPriceId,
          })
          .eq("id", tier.id);

        tier.stripe_product_id = product.id;
        tier.stripe_monthly_price_id = monthlyPrice_.id;
        tier.stripe_yearly_price_id = yearlyPriceId;
      }
    } catch (e) {
      // Stripe creation failed — tier saved without Stripe IDs, can retry
      console.error("Stripe tier creation failed:", e);
    }
  }

  return NextResponse.json({ tier });
}

// ── PATCH — update tier ────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tierId, ...updates } = await req.json();
  if (!tierId) return NextResponse.json({ error: "tierId required" }, { status: 400 });

  // Verify ownership
  const { data: tier } = await (supabase as any)
    .from("subscription_tiers")
    .select("id, creator:creator_profile_id(user_id)")
    .eq("id", tierId)
    .maybeSingle();

  if (!tier || (tier.creator as any)?.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = ["name", "description", "perks", "is_active", "sort_order"];
  const clean = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));

  const { data: updated } = await (supabase as any)
    .from("subscription_tiers")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", tierId)
    .select()
    .single();

  return NextResponse.json({ tier: updated });
}

// ── DELETE — archive tier ──────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tierId } = await req.json();
  if (!tierId) return NextResponse.json({ error: "tierId required" }, { status: 400 });

  // Soft delete — deactivate instead of hard delete (active subscribers keep access)
  await (supabase as any)
    .from("subscription_tiers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", tierId)
    .eq("creator_profile_id", (await (supabase as any).from("creator_profiles").select("id").eq("user_id", user.id)));

  return NextResponse.json({ ok: true });
}
