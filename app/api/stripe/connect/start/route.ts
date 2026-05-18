import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createConnectAccount, createOnboardingLink } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get creator profile
  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, stripe_account_id, kind")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .single();

  if (!profile) return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });

  let accountId = profile.stripe_account_id;

  // Create Stripe account if not exists
  if (!accountId) {
    const account = await createConnectAccount(user.email!);
    accountId = account.id;
    await (supabase as any)
      .from("creator_profiles")
      .update({ stripe_account_id: accountId })
      .eq("id", profile.id);
  }

  // Generate onboarding link
  const link = await createOnboardingLink(accountId);
  return NextResponse.json({ url: link.url });
}
