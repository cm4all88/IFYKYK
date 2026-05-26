import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";

// Supabase calls this webhook on user signup
// Configure in Supabase Dashboard → Auth → Webhooks
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, record } = body;

  if (type === "INSERT" && record?.email) {
    // Get their creator profile handle
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("handle")
      .eq("user_id", record.id)
      .maybeSingle();

    await sendWelcomeEmail(record.email, profile?.handle ?? "you");
  }

  return NextResponse.json({ ok: true });
}
