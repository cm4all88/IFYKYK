import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Call on first authenticated load. Marks the caller's pending referral
// verified (if any) and fires the referrer's reward ladder. Idempotent.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true });

  await (supabase as any).rpc("verify_referral", { p_referred: user.id });
  return NextResponse.json({ ok: true });
}
