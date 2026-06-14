import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, stripe_account_id")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .single();
  if (!profile?.stripe_account_id) return NextResponse.json({ onboarded: false });

  try {
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const onboarded = !!account.details_submitted;
    if (onboarded) {
      await (supabase as any)
        .from("creator_profiles")
        .update({ stripe_onboarded: true })
        .eq("id", profile.id);
    }
    return NextResponse.json({ onboarded });
  } catch {
    return NextResponse.json({ onboarded: false });
  }
}
