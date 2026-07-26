import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendWelcomeEmail } from "@/lib/email";
import { shouldSuppressWelcomeEmail } from "@/lib/claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends the welcome email to the CURRENTLY SIGNED-IN user.
//
// This route used to accept `{ email, handle }` from the request body with no
// authentication at all, which made it a way for anyone on the internet to
// send mail as Spotlightly to any address. Both values are now derived from
// the session and the database; the request body is ignored entirely.
//
// The signup flow (app/(auth)/signup/page.tsx) calls this immediately after
// creating the account, at which point a session exists, so the behaviour for
// real signups is unchanged.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("handle, claim_code, claimed_at")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .maybeSingle();

  // Same concierge suppression as the auth webhook: a prepared-but-unclaimed
  // page must not trigger a "welcome, your stage is ready" email.
  if (shouldSuppressWelcomeEmail({ email: user.email, claim_code: profile?.claim_code, claimed_at: profile?.claimed_at })) {
    return NextResponse.json({ ok: true, skipped: "concierge" });
  }

  await sendWelcomeEmail(user.email, profile?.handle ?? "you");
  return NextResponse.json({ ok: true });
}
