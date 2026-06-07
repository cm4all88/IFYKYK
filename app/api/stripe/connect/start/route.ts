import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });

// Shared logic for both POST (JSON, used by the dashboard buttons) and GET
// (302 redirect, used by anchor links / Stripe's refresh_url).
async function startOnboarding(): Promise<{ url?: string; error?: string; status?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, stripe_account_id, kind, handle")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .single();

  if (!profile) return { error: "Creator profile not found", status: 404 };

  let accountId = profile.stripe_account_id;

  if (!accountId) {
    try {
      // Pre-fill the business profile so creators don't have to guess at the
      // "website" and "what do you sell" fields — their Spotlightly page is it.
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          url: profile.handle ? `https://spotlightly.app/${profile.handle}` : undefined,
          product_description: "Subscriptions, tips, and exclusive content for my audience on Spotlightly.",
        },
      });
      accountId = account.id;
      await (supabase as any)
        .from("creator_profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", profile.id);
    } catch (e: any) {
      console.error("Account creation failed:", e.message, e.code);
      return { error: `Account creation failed: ${e.message}`, status: 500 };
    }
  }

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
    const link = await stripe.accountLinks.create({
      account: accountId,
      // refresh_url regenerates a fresh link if this one expires.
      refresh_url: `${base}/api/stripe/connect/start`,
      // return marks stripe_onboarded=true, then bounces to the dashboard.
      return_url: `${base}/api/stripe/connect/return`,
      type: "account_onboarding",
    });
    return { url: link.url };
  } catch (e: any) {
    console.error("Account link creation failed:", e.message, e.code);
    return { error: `Onboarding link failed: ${e.message}`, status: 500 };
  }
}

export async function POST() {
  const r = await startOnboarding();
  if (r.url) return NextResponse.json({ url: r.url });
  return NextResponse.json({ error: r.error ?? "Failed to start Stripe onboarding" }, { status: r.status ?? 500 });
}

export async function GET(req: NextRequest) {
  const r = await startOnboarding();
  if (r.url) return NextResponse.redirect(r.url, 303);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return NextResponse.redirect(
    `${base}/dashboard?pane=payments&stripe_error=${encodeURIComponent(r.error ?? "Could not start Stripe onboarding")}`,
    303,
  );
}
