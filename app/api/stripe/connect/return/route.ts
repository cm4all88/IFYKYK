import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { stripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, stripe_account_id")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .single();

  if (profile?.stripe_account_id) {
    try {
      const account = await stripe.accounts.retrieve(profile.stripe_account_id);
      if (account.details_submitted) {
        // ✅ Mark creator as onboarded in the database
        await (supabase as any)
          .from("creator_profiles")
          .update({ stripe_onboarded: true })
          .eq("id", profile.id);

        return NextResponse.redirect(new URL("/dashboard?pane=payments&stripe=connected", req.url));
      }
    } catch {}
  }

  return NextResponse.redirect(new URL("/dashboard?pane=payments&stripe=incomplete", req.url));
}
