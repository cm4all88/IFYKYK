import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Returns the caller's own referral code + progress. Also opportunistically
// verifies the caller's own pending referral (if they signed up via someone's
// link), which fires that referrer's reward ladder. Idempotent.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  await (supabase as any).rpc("verify_referral", { p_referred: user.id });

  const { data, error } = await (supabase as any).rpc("referral_status", { p_user: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
