import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// Records an attribution when someone signs up via a ?ref= link. Runs with the
// service role because the new account may not have a session yet (email not
// confirmed). No reward is granted here — that only happens on verification.
export async function POST(req: NextRequest) {
  const { code, referredUserId, accountType } = await req.json().catch(() => ({}));
  if (!code || !referredUserId) return NextResponse.json({ ok: true });

  const supabase = await createServiceClient();
  await (supabase as any).rpc("record_referral", {
    p_code: String(code),
    p_referred: String(referredUserId),
    p_type: accountType === "creator" ? "creator" : "fan",
  });
  return NextResponse.json({ ok: true });
}
