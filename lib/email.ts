const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = "Spotlightly <hello@spotlightly.app>";

async function send(to: string, subject: string, html: string) {
  if (!RESEND_KEY) { console.warn("RESEND_API_KEY not set"); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) console.error("Resend error:", await res.text());
}

function base(content: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#09090C;font-family:'Helvetica Neue',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#111115;border-radius:8px;overflow:hidden;">
<tr><td style="background:#F0B429;height:4px;"></td></tr>
<tr><td style="padding:40px 48px;">
<p style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#ffffff;margin:0 0 32px;">Spot<span style="color:#F0B429;">light</span>ly</p>
${content}
</td></tr>
<tr><td style="padding:24px 48px;border-top:1px solid rgba(255,255,255,0.07);">
<p style="font-size:11px;color:#6B6560;margin:0;">Spotlightly · Tahoma Systems LLC · PO Box 472 · Black Diamond, WA 98010</p>
<p style="font-size:11px;color:#6B6560;margin:4px 0 0;">You're receiving this because you have a Spotlightly account. <a href="{{unsubscribe}}" style="color:#6B6560;">Unsubscribe</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

export async function sendWelcomeEmail(to: string, handle: string) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">Welcome to Spotlightly.</h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 24px;">Your page is live at <a href="https://spotlightly.app/${handle}" style="color:#F0B429;">spotlightly.app/${handle}</a>. Share it everywhere — it's your link-in-bio, your stage, your home.</p>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 32px;">Three things to do right now:</p>
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:#F0B429;font-weight:bold;">1.</span> <a href="https://spotlightly.app/dashboard?pane=profile" style="color:#ffffff;text-decoration:none;">Complete your profile</a> — photo, bio, cover image.</td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:#F0B429;font-weight:bold;">2.</span> <a href="https://spotlightly.app/dashboard?pane=payments" style="color:#ffffff;text-decoration:none;">Connect Stripe</a> — so fans can pay you.</td></tr>
      <tr><td style="padding:12px 0;"><span style="color:#F0B429;font-weight:bold;">3.</span> <a href="https://spotlightly.app/dashboard?pane=posts" style="color:#ffffff;text-decoration:none;">Publish your first post</a> — free posts build your audience.</td></tr>
    </table>
    <br/>
    <a href="https://spotlightly.app/dashboard" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;margin-top:8px;">Go to your dashboard →</a>
    <p style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:32px;line-height:1.6;">Your 30-day free trial has started. No card required. Questions? Reply to this email or contact <a href="mailto:support@spotlightly.app" style="color:#F0B429;">support@spotlightly.app</a>.</p>
  `);
  await send(to, "Welcome to Spotlightly — your stage is ready", html);
}

export async function sendNewSubscriberEmail(to: string, creatorHandle: string, fanName: string, amount: string) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">New subscriber. 🎉</h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 24px;"><strong style="color:#ffffff;">${fanName}</strong> just subscribed to your channel for <strong style="color:#F0B429;">${amount}/month</strong>.</p>
    <a href="https://spotlightly.app/dashboard?pane=fans" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">View your audience →</a>
  `);
  await send(to, `New subscriber on Spotlightly — ${amount}/mo`, html);
}

export async function sendTipEmail(to: string, fanName: string, amount: string, message?: string) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">Someone sent you a tip. 💛</h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 16px;"><strong style="color:#ffffff;">${fanName}</strong> tipped you <strong style="color:#F0B429;">${amount}</strong>.</p>
    ${message ? `<p style="font-size:14px;color:rgba(255,255,255,0.5);font-style:italic;padding:16px;background:rgba(255,255,255,0.04);border-left:3px solid #F0B429;border-radius:4px;margin:0 0 24px;">"${message}"</p>` : ""}
    <a href="https://spotlightly.app/dashboard" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">View dashboard →</a>
  `);
  await send(to, `You received a ${amount} tip on Spotlightly`, html);
}

export async function sendTrialEndingEmail(to: string, daysLeft: number) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.</h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 24px;">Add a payment method to keep your Spotlightly account active. Your content, subscribers, and earnings history are all preserved.</p>
    <a href="https://spotlightly.app/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">Add payment method →</a>
    <p style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:24px;">Questions? <a href="mailto:support@spotlightly.app" style="color:#F0B429;">support@spotlightly.app</a></p>
  `);
  await send(to, `Your Spotlightly trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`, html);
}

export async function sendMessageEmail(to: string, fromName: string, preview: string, creatorHandle: string) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">New message from ${fromName}.</h1>
    <p style="font-size:14px;color:rgba(255,255,255,0.5);font-style:italic;padding:16px;background:rgba(255,255,255,0.04);border-left:3px solid #F0B429;border-radius:4px;margin:0 0 24px;">"${preview}${preview.length >= 100 ? "…" : ""}"</p>
    <a href="https://spotlightly.app/messages" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">Reply →</a>
  `);
  await send(to, `New message on Spotlightly from ${fromName}`, html);
}
