import { getSecrets } from "@/lib/settings";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send a transactional email via Resend.
 * Returns { ok: true } on success, { ok: false, reason } on failure or missing config.
 *
 * Callers should NOT throw on failure — emails are best-effort. Log and continue.
 */
export async function sendEmail(args: SendArgs): Promise<{ ok: boolean; reason?: string }> {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = await getSecrets([
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
  ]);

  if (!RESEND_API_KEY) {
    console.warn(`Email not sent (Resend not configured): ${args.subject} → ${args.to}`);
    return { ok: false, reason: "Resend API key not configured" };
  }

  const from = RESEND_FROM_EMAIL || "noreply@spotlightly.app";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend send failed (${res.status}):`, body);
    return { ok: false, reason: `Resend API ${res.status}` };
  }

  return { ok: true };
}

/**
 * Standard HTML wrapper — keeps Spotlightly brand consistent across all emails.
 */
export function emailLayout(opts: { heading: string; body: string; ctaUrl?: string; ctaText?: string }) {
  const cta = opts.ctaUrl
    ? `<p style="margin:32px 0;"><a href="${opts.ctaUrl}" style="background:#f5c842;color:#0a0a0f;padding:14px 28px;text-decoration:none;border-radius:3px;font-family:monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:500;">${opts.ctaText ?? "Open"}</a></p>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${opts.heading}</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;color:#e8e8f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:48px 24px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#111118;border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:40px;">
        <tr><td>
          <p style="font-family:Georgia,serif;font-size:24px;color:#fff;margin:0 0 24px;font-weight:300;">Spot<span style="color:#f5c842;">light</span>ly</p>
          <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#fff;margin:0 0 16px;line-height:1.2;">${opts.heading}</h1>
          <div style="font-size:15px;line-height:1.7;color:rgba(232,232,240,0.85);">${opts.body}</div>
          ${cta}
          <p style="font-size:12px;color:#6b6b80;margin:48px 0 0;border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">A Tahoma Systems product · Every creator deserves a spotlight.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
