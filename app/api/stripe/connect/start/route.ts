import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createOnboardingLink } from "@/lib/stripe";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await (supabase as any)
      .from("creator_profiles")
      .select("id, stripe_account_id, kind")
      .eq("user_id", user.id)
      .eq("kind", "spotlight")
      .single();

    if (!profile) return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });

    let accountId = profile.stripe_account_id;

    if (!accountId) {
      console.log("Creating new Stripe Connect account for user", user.id);
      try {
        const account = await stripe.accounts.create({ type: "express" });
        accountId = account.id;
        console.log("Created account:", accountId);
        await (supabase as any)
          .from("creator_profiles")
          .update({ stripe_account_id: accountId })
          .eq("id", profile.id);
      } catch (e: any) {
        console.error("Account creation failed:", e.message, e.code);
        return NextResponse.json({ error: `Account creation failed: ${e.message}` }, { status: 500 });
      }
    } else {
      console.log("Reusing existing account:", accountId);
    }

    try {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${base}/dashboard?pane=payments`,
        // Route the return through the handler that marks stripe_onboarded=true,
        // then it redirects to the dashboard using the real request origin.
        return_url: `${base}/api/stripe/connect/return`,
        type: "account_onboarding",
      });
      console.log("Onboarding link created:", link.url);
      return NextResponse.json({ url: link.url });
    } catch (e: any) {
      console.error("Account link creation failed:", e.message, e.code);
      return NextResponse.json({ error: `Onboarding link failed: ${e.message}` }, { status: 500 });
    }

  } catch (e: any) {
    console.error("Stripe connect error:", e.message);
    return NextResponse.json({ error: e.message ?? "Failed to start Stripe onboarding" }, { status: 500 });
  }
}
