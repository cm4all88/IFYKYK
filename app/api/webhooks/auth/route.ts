import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";
import { shouldSuppressWelcomeEmail } from "@/lib/claim";

export const runtime = "nodejs";

// Supabase calls this webhook on user signup.
// Configure in Supabase Dashboard → Auth → Webhooks.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!process.env.SUPABASE_WEBHOOK_SECRET || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, record } = body;

  if (type === "INSERT" && record?.email) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("handle, claim_code, claimed_at")
      .eq("user_id", record.id)
      .maybeSingle();

    // An admin preparing a creator page calls auth.admin.createUser(), which
    // fires this webhook. That account belongs to somebody who has agreed to
    // nothing yet, so a welcome email would be unapproved outreach.
    const p = profile as any;
    if (shouldSuppressWelcomeEmail({ email: record.email, claim_code: p?.claim_code, claimed_at: p?.claimed_at })) {
      return NextResponse.json({ ok: true, skipped: "concierge" });
    }

    await sendWelcomeEmail(record.email, p?.handle ?? "you");
  }

  return NextResponse.json({ ok: true });
}
