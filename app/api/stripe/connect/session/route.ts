import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import Stripe from "stripe";
import { writeOrLog } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, stripe_account_id, kind, handle")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .single();
  if (!profile) return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });

  let accountId = profile.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        url: profile.handle
          ? `https://www.spotlightly.app/${profile.handle}`
          : "https://www.spotlightly.app",
        mcc: "5815",
        product_description: "Subscriptions, tips, and exclusive content for my audience on Spotlightly.",
      },
    });
    accountId = account.id;
    await writeOrLog("stripe/connect/session update creator_profiles", (supabase as any)
      .from("creator_profiles")
      .update({ stripe_account_id: accountId })
      .eq("id", profile.id));
  }

  try {
    const session = await stripe.accountSessions.create({
      account: accountId,
      components: { account_onboarding: { enabled: true } },
    });
    return NextResponse.json({ client_secret: session.client_secret });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not start onboarding" }, { status: 500 });
  }
}
