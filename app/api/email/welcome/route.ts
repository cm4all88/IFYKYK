import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ ok: false });

    await sendWelcomeEmail(email, "");
      to: email,
      subject: "Welcome to Spotlightly — your stage is ready",
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;background:#09090C;color:#F2F2F0;">
          <div style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#fff;letter-spacing:-0.01em;margin-bottom:8px;">
            Spot<span style="color:#F0B429;">light</span>ly
          </div>
          <div style="height:1px;background:rgba(255,255,255,0.08);margin:20px 0;"></div>
          <h1 style="font-family:Georgia,serif;font-size:36px;font-weight:300;line-height:1.1;color:#fff;margin:0 0 16px;">
            Your stage is ready.
          </h1>
          <p style="font-size:15px;line-height:1.75;color:rgba(242,242,240,0.72);margin:0 0 20px;">
            Welcome to Spotlightly. You've got everything you need to turn your audience into income — your page, your handle, your rules.
          </p>
          <p style="font-size:15px;line-height:1.75;color:rgba(242,242,240,0.72);margin:0 0 28px;">
            Here's what to do first:
          </p>
          <div style="background:#111115;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:20px 24px;margin-bottom:28px;">
            <div style="margin-bottom:12px;"><strong style="color:#F0B429;">1.</strong> <span style="color:#F2F2F0;">Edit your profile</span> — add your bio, avatar, and cover photo</div>
            <div style="margin-bottom:12px;"><strong style="color:#F0B429;">2.</strong> <span style="color:#F2F2F0;">Create your channels</span> — at least one free, one paid</div>
            <div style="margin-bottom:12px;"><strong style="color:#F0B429;">3.</strong> <span style="color:#F2F2F0;">Connect Stripe</span> — so you can actually receive money</div>
            <div><strong style="color:#F0B429;">4.</strong> <span style="color:#F2F2F0;">Post something</span> — then put your Spotlightly link in your bios</div>
          </div>
          <a href="https://spotlightly.app/dashboard" style="display:inline-block;background:#F0B429;color:#0A0A0D;font-family:-apple-system,sans-serif;font-size:14px;font-weight:700;padding:14px 28px;border-radius:999px;text-decoration:none;">
            Go to your dashboard →
          </a>
          <div style="height:1px;background:rgba(255,255,255,0.08);margin:32px 0 20px;"></div>
          <p style="font-size:12px;color:rgba(242,242,240,0.35);margin:0;">
            Spotlightly · Tahoma Systems LLC · Seattle, WA<br>
            <a href="https://spotlightly.app/terms" style="color:#F0B429;">Terms</a> ·
            <a href="https://spotlightly.app/privacy" style="color:#F0B429;">Privacy</a>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Welcome email failed:", e);
    return NextResponse.json({ ok: false });
  }
}
