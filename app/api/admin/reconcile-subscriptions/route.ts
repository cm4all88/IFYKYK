import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rebuild subscription rows that Stripe has and the database does not.
 *
 * Why this exists: /api/subscribe/tier never sent client_reference_id, so the
 * webhook wrote fan_user_id null into a not-null column. Every insert was
 * rejected, the error was never checked, and the webhook returned 200. Stripe
 * believed every subscription was delivered. Creators saw no subscribers at all
 * while fans were being charged monthly.
 *
 * Replaying the Stripe events cannot fix it: those events never carried a fan
 * id. The only link back to an account is the customer's email, which is what
 * this matches on.
 *
 * GET  = dry run, reports what it would do and changes nothing.
 * POST = writes the missing rows.
 */
export async function GET(req: NextRequest) { return run(req, false); }
export async function POST(req: NextRequest) { return run(req, true); }

async function run(req: NextRequest, commit: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const admin = await createServiceClient();

  // Every subscription Stripe knows about, with its customer expanded so we have
  // an email to match on.
  const subs: any[] = [];
  let startingAfter: string | null = null;
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ limit: "100", status: "all", "expand[]": "data.customer" });
    if (startingAfter) qs.set("starting_after", startingAfter);
    const res = await fetch(`https://api.stripe.com/v1/subscriptions?${qs}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Stripe: ${await res.text()}` }, { status: 502 });
    }
    const json = await res.json();
    subs.push(...(json.data ?? []));
    if (!json.has_more) break;
    startingAfter = json.data[json.data.length - 1]?.id ?? null;
    if (!startingAfter) break;
  }

  const { data: existing } = await (admin as any)
    .from("subscriptions").select("stripe_subscription_id");
  const known = new Set((existing ?? []).map((r: any) => r.stripe_subscription_id).filter(Boolean));

  const repaired: any[] = [];
  const unmatched: any[] = [];

  for (const sub of subs) {
    if (known.has(sub.id)) continue;

    const email: string | null =
      sub.customer?.email ?? sub.customer_email ?? null;
    const creatorProfileId: string | null = sub.metadata?.creator_profile_id ?? null;

    // Without a creator we cannot say who the subscription belongs to.
    if (!creatorProfileId) {
      unmatched.push({ subscription: sub.id, email, reason: "no creator_profile_id in metadata" });
      continue;
    }
    if (!email) {
      unmatched.push({ subscription: sub.id, email: null, reason: "no email on the Stripe customer" });
      continue;
    }

    // Match the payer to an account by email. Nothing else links them.
    let fanUserId: string | null = null;
    try {
      const { data } = await (admin as any).auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = (data?.users ?? []).find(
        (u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase()
      );
      fanUserId = match?.id ?? null;
    } catch { /* fall through to unmatched */ }

    if (!fanUserId) {
      unmatched.push({ subscription: sub.id, email, reason: "no Spotlightly account with that email" });
      continue;
    }

    const row = {
      creator_profile_id: creatorProfileId,
      fan_user_id: fanUserId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      status: sub.status === "trialing" ? "trialing" : sub.status === "active" ? "active" : sub.status,
      tier: "premium",
      tier_id: sub.metadata?.tier_id || null,
      price: sub.items?.data?.[0]?.price?.unit_amount != null
        ? sub.items.data[0].price.unit_amount / 100
        : null,
      current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      created_at: sub.created ? new Date(sub.created * 1000).toISOString() : new Date().toISOString(),
    };

    if (commit) {
      const { error } = await (admin as any)
        .from("subscriptions")
        .upsert(row, { onConflict: "fan_user_id,creator_profile_id" });
      if (error) {
        unmatched.push({ subscription: sub.id, email, reason: error.message });
        continue;
      }
    }
    repaired.push({ subscription: sub.id, email, status: row.status, price: row.price });
  }

  return NextResponse.json({
    mode: commit ? "committed" : "dry run, nothing written",
    stripeSubscriptions: subs.length,
    alreadyRecorded: subs.filter((s) => known.has(s.id)).length,
    repaired,
    repairedCount: repaired.length,
    unmatched,
    unmatchedCount: unmatched.length,
  });
}
