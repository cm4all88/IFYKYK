import { NextRequest, NextResponse } from "next/server";

const RESEND_KEY = process.env.RESEND_API_KEY;

async function sendRaw(to: string, subject: string, html: string) {
  if (!RESEND_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Spotlightly <hello@spotlightly.app>", to, subject, html }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject, preview, body } = await req.json();
    if (!to || !subject) return NextResponse.json({ ok: false });

    await sendRaw(to, subject, `
      <div style="font-family:-apple-system,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;background:#09090C;color:#F2F2F0;">
        <div style="font-family:Georgia,serif;font-size:22px;color:#fff;margin-bottom:6px;">
          Spot<span style="color:#F0B429;">light</span>ly
        </div>
        <div style="height:1px;background:rgba(255,255,255,0.08);margin:16px 0 24px;"></div>
        ${preview ? `<p style="font-size:15px;color:rgba(242,242,240,0.7);margin:0 0 16px;">${preview}</p>` : ""}
        <div style="font-size:14px;line-height:1.8;color:rgba(242,242,240,0.75);">${body}</div>
        <div style="margin-top:28px;">
          <a href="https://spotlightly.app/dashboard" style="display:inline-block;background:#F0B429;color:#0A0A0D;font-size:13px;font-weight:700;padding:12px 24px;border-radius:4px;text-decoration:none;">
            Go to dashboard →
          </a>
        </div>
        <div style="height:1px;background:rgba(255,255,255,0.08);margin:28px 0 16px;"></div>
        <p style="font-size:11px;color:rgba(242,242,240,0.3);margin:0;">Spotlightly · Tahoma Systems LLC</p>
      </div>
    `);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Notify email failed:", e);
    return NextResponse.json({ ok: false });
  }
}
