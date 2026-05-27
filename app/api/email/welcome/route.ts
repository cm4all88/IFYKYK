import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email, handle } = await req.json();
    if (!email) return NextResponse.json({ ok: false });
    await sendWelcomeEmail(email, handle ?? "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Welcome email failed:", e);
    return NextResponse.json({ ok: false });
  }
}
