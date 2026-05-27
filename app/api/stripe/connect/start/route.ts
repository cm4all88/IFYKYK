import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createConnectAccount, createOnboardingLink } from "@/lib/stripe";

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
      const account = await createConnectAccount(user.email!);
      accountId = account.id;
      await (supabase as any)
        .from("creator_profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", profile.id);
    }

    const link = await createOnboardingLink(accountId);
    return NextResponse.json({ url: link.url });

  } catch (e: any) {
    console.error("Stripe connect error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to start Stripe onboarding" },
      { status: 500 }
    );
  }
}
