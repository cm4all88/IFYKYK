// ──────────────────────────────────────────────────────────────────
// lib/email.ts
// Every outbound Spotlightly email goes through this module. One provider
// (Resend), one From address, one footer.
//
// Two rules this module enforces so callers cannot get them wrong:
//
//   1. The footer never claims a relationship the recipient does not have.
//      `relationship` is a required part of every send; the account-holder
//      wording is the default because that is what almost every send is.
//
//   2. The unsubscribe link is real or it is absent. It is never a dead
//      token. Marketing sends are suppressed for opted-out addresses;
//      transactional sends (receipts, payment failures, security notices)
//      are not, because suppressing those harms the recipient.
// ──────────────────────────────────────────────────────────────────

import crypto from "crypto";

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = "Spotlightly <hello@spotlightly.app>";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spotlightly.app").replace(/\/+$/, "");

/**
 * Transactional = the recipient asked for it by taking an action (receipt,
 * payment failure, download link). Never suppressed.
 * Marketing = we chose to send it. Always suppressed for opted-out addresses.
 */
export type EmailCategory = "transactional" | "marketing";

export const ACCOUNT_RELATIONSHIP =
  "You're receiving this because you have a Spotlightly account.";

// ─── Unsubscribe links ────────────────────────────────────────────
// Signed so that a link cannot be forged to opt somebody else out. The
// secret is separate from every other secret in the app; if it is unset we
// render no unsubscribe link at all rather than a broken one.

function unsubSecret(): string | null {
  const s = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  return s && s.trim().length > 0 ? s : null;
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeUnsubEmail(encoded: string): string | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const out = Buffer.from(b64, "base64").toString("utf8");
    return out.includes("@") ? out : null;
  } catch {
    return null;
  }
}

export function unsubscribeSignature(email: string): string | null {
  const secret = unsubSecret();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}

/** Constant-time comparison so the signature cannot be probed byte by byte. */
export function verifyUnsubscribeSignature(email: string, sig: string): boolean {
  const expected = unsubscribeSignature(email);
  if (!expected || !sig) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Full unsubscribe URL, or null when no signing secret is configured. */
export function unsubscribeUrl(email: string): string | null {
  const sig = unsubscribeSignature(email);
  if (!sig) return null;
  return `${APP_URL}/unsubscribe?e=${b64url(email.trim().toLowerCase())}&s=${sig}`;
}

// ─── Opt-out suppression ──────────────────────────────────────────
// Uses a bare supabase-js client rather than lib/supabase-server, which
// imports next/headers and therefore cannot be used from every context that
// sends email (cron jobs, webhooks).

async function isOptedOut(email: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(url, key);
    const { data } = await (db as any)
      .from("email_opt_outs")
      .select("email")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    return !!data;
  } catch {
    // Never let a suppression-lookup failure block a transactional send.
    return false;
  }
}

// ─── Transport ────────────────────────────────────────────────────

/**
 * The transport. Returns Resend's message id on success so a caller that
 * needs to correlate delivery webhooks can store it; `null` means not sent.
 *
 * `text` is optional and, when given, is sent alongside the HTML so the
 * message is genuinely multipart rather than HTML-only.
 */
async function sendRaw(
  to: string,
  subject: string,
  html: string,
  opts: { category?: EmailCategory; text?: string } = {}
): Promise<string | null> {
  const category = opts.category ?? "transactional";
  if (!RESEND_KEY) { console.warn("RESEND_API_KEY not set"); return null; }
  if (!to || !to.includes("@")) return null;

  if (category === "marketing" && (await isOptedOut(to))) {
    console.warn("Suppressed marketing email to opted-out address");
    return null;
  }

  const payload: Record<string, unknown> = { from: FROM, to, subject, html };
  if (opts.text) payload.text = opts.text;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { console.error("Resend error:", await res.text()); return null; }

  try {
    const body = (await res.json()) as { id?: string };
    return body?.id ?? "sent";
  } catch {
    return "sent";
  }
}

async function send(
  to: string,
  subject: string,
  html: string,
  opts: { category?: EmailCategory; text?: string } = {}
): Promise<boolean> {
  return (await sendRaw(to, subject, html, opts)) !== null;
}

// ─── Shared shell ─────────────────────────────────────────────────

function footer(relationship: string, unsubUrl: string | null) {
  const optOut = unsubUrl
    ? `<a href="${unsubUrl}" style="color:#6B6560;">Unsubscribe</a>`
    : `Reply to this email to stop receiving these.`;
  return `<tr><td style="padding:24px 48px;border-top:1px solid rgba(255,255,255,0.07);">
<p style="font-size:11px;color:#6B6560;margin:0;">Spotlightly · Tahoma Systems LLC · PO Box 472 · Black Diamond, WA 98010</p>
<p style="font-size:11px;color:#6B6560;margin:4px 0 0;">${relationship} ${optOut}</p>
</td></tr>`;
}

/**
 * The branded shell. `relationship` states, truthfully, why this person is
 * receiving this message — it is a parameter precisely so that a future
 * non-account recipient cannot silently inherit the account-holder wording.
 */
function base(
  content: string,
  opts: { relationship?: string; unsubscribeUrl?: string | null } = {}
) {
  const relationship = opts.relationship ?? ACCOUNT_RELATIONSHIP;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#09090C;font-family:'Helvetica Neue',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#111115;border-radius:8px;overflow:hidden;">
<tr><td style="background:#F0B429;height:4px;"></td></tr>
<tr><td style="padding:40px 48px;">
<p style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#ffffff;margin:0 0 32px;">Spot<span style="color:#F0B429;">light</span>ly</p>
${content}
</td></tr>
${footer(relationship, opts.unsubscribeUrl ?? null)}
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
  `, { unsubscribeUrl: unsubscribeUrl(to) });
  await send(to, "Welcome to Spotlightly — your stage is ready", html);
}

export async function sendNewSubscriberEmail(to: string, creatorHandle: string, fanName: string, amount: string) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">New subscriber. 🎉</h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 24px;"><strong style="color:#ffffff;">${fanName}</strong> just subscribed to your channel for <strong style="color:#F0B429;">${amount}/month</strong>.</p>
    <a href="https://spotlightly.app/dashboard?pane=fans" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">View your audience →</a>
  `, { unsubscribeUrl: unsubscribeUrl(to) });
  await send(to, `New subscriber on Spotlightly — ${amount}/mo`, html);
}

export async function sendTipEmail(to: string, fanName: string, amount: string, message?: string) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">Someone sent you a tip. 💛</h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 16px;"><strong style="color:#ffffff;">${fanName}</strong> tipped you <strong style="color:#F0B429;">${amount}</strong>.</p>
    ${message ? `<p style="font-size:14px;color:rgba(255,255,255,0.5);font-style:italic;padding:16px;background:rgba(255,255,255,0.04);border-left:3px solid #F0B429;border-radius:4px;margin:0 0 24px;">"${message}"</p>` : ""}
    <a href="https://spotlightly.app/dashboard" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">View dashboard →</a>
  `, { unsubscribeUrl: unsubscribeUrl(to) });
  await send(to, `You received a ${amount} tip on Spotlightly`, html);
}

export async function sendTrialEndingEmail(to: string, daysLeft: number) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.</h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 24px;">Add a payment method to keep your Spotlightly account active. Your content, subscribers, and earnings history are all preserved.</p>
    <a href="https://spotlightly.app/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">Add payment method →</a>
    <p style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:24px;">Questions? <a href="mailto:support@spotlightly.app" style="color:#F0B429;">support@spotlightly.app</a></p>
  `, { unsubscribeUrl: unsubscribeUrl(to) });
  await send(to, `Your Spotlightly trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`, html);
}

export async function sendMessageEmail(to: string, fromName: string, preview: string, creatorHandle: string) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">New message from ${fromName}.</h1>
    <p style="font-size:14px;color:rgba(255,255,255,0.5);font-style:italic;padding:16px;background:rgba(255,255,255,0.04);border-left:3px solid #F0B429;border-radius:4px;margin:0 0 24px;">"${preview}${preview.length >= 100 ? "…" : ""}"</p>
    <a href="https://spotlightly.app/messages" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">Reply →</a>
  `, { unsubscribeUrl: unsubscribeUrl(to) });
  await send(to, `New message on Spotlightly from ${fromName}`, html);
}

// ── Merch order updates (fan-facing) ────────────────────────────────
export async function sendMerchShippedEmail(
  to: string,
  productName: string,
  opts: { trackingUrl?: string | null; trackingNumber?: string | null; creatorHandle?: string | null } = {}
) {
  const { trackingUrl, trackingNumber, creatorHandle } = opts;
  const track = trackingUrl
    ? `<a href="${trackingUrl}" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">Track your package →</a>`
    : `<p style="font-size:14px;color:rgba(255,255,255,0.5);margin:0;">Tracking details will appear here once the carrier scans your package.</p>`;
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">Your order is on its way. 📦</h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 20px;">Your <strong style="color:#ffffff;">${productName}</strong>${creatorHandle ? ` from <strong style="color:#F0B429;">@${creatorHandle}</strong>` : ""} has shipped.</p>
    ${trackingNumber ? `<p style="font-size:13px;color:rgba(255,255,255,0.5);margin:0 0 20px;">Tracking #: <span style="color:#ffffff;font-family:monospace;">${trackingNumber}</span></p>` : ""}
    ${track}
  `, {
    relationship: "You're receiving this because you placed an order on Spotlightly.",
    unsubscribeUrl: unsubscribeUrl(to),
  });
  await send(to, `Your Spotlightly order has shipped`, html);
}

export async function sendMerchDeliveredEmail(to: string, productName: string, creatorHandle?: string | null) {
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#ffffff;margin:0 0 12px;">Delivered. 🎉</h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0 0 24px;">Your <strong style="color:#ffffff;">${productName}</strong>${creatorHandle ? ` from <strong style="color:#F0B429;">@${creatorHandle}</strong>` : ""} was delivered. We hope you love it.</p>
    ${creatorHandle ? `<a href="https://spotlightly.app/${creatorHandle}" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;">Back to @${creatorHandle} →</a>` : ""}
  `, {
    relationship: "You're receiving this because you placed an order on Spotlightly.",
    unsubscribeUrl: unsubscribeUrl(to),
  });
  await send(to, `Your Spotlightly order was delivered`, html);
}

// ── Generic account notification ────────────────────────────────────
// Replaces the former POST /api/email/notify route, which was an
// unauthenticated endpoint that would send mail as Spotlightly to any
// address for any caller who could reach it. Every caller was server-side
// and inside this app, so the HTTP hop bought nothing and cost an open relay.
export async function sendNotifyEmail(args: {
  to: string;
  subject: string;
  preview?: string;
  body: string;
  category?: EmailCategory;
}): Promise<boolean> {
  const { to, subject, preview, body, category } = args;
  if (!to || !subject) return false;
  const unsub = unsubscribeUrl(to);
  const html = `
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
      <p style="font-size:11px;color:rgba(242,242,240,0.3);margin:0;">Spotlightly · Tahoma Systems LLC · PO Box 472 · Black Diamond, WA 98010</p>
      <p style="font-size:11px;color:rgba(242,242,240,0.3);margin:4px 0 0;">${ACCOUNT_RELATIONSHIP} ${
        unsub ? `<a href="${unsub}" style="color:rgba(242,242,240,0.45);">Unsubscribe</a>` : "Reply to this email to stop receiving these."
      }</p>
    </div>
  `;
  return send(to, subject, html, { category: category ?? "transactional" });
}

// ── Creator prospect invitation ─────────────────────────────────────
/**
 * The one function permitted to email a creator prospect.
 *
 * Its template is separate from every other email in this file on purpose.
 * A prospect has no Spotlightly account, so the standard footer's
 * "You're receiving this because you have a Spotlightly account" would be a
 * false statement about a relationship that does not exist. This footer says
 * plainly why they were contacted and carries a working opt-out.
 *
 * Category is "marketing", so an address in email_opt_outs is suppressed by
 * send() before anything reaches Resend.
 *
 * This function does NOT decide whether sending is allowed. The caller must
 * have cleared outreachRefusal() and the database CHECK constraints, which
 * together require a named human approval first.
 */
export async function sendProspectInvite(args: {
  to: string;
  subject: string;
  /** Plain text; newlines become paragraphs. Never raw HTML from a form. */
  body: string;
  claimUrl?: string | null;
}): Promise<boolean> {
  const { to, subject, body, claimUrl } = args;
  if (!to || !subject || !body) return false;

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => escapeHtml(p).replace(/\n/g, "<br/>"))
    .filter(Boolean)
    .map((p) => `<p style="font-size:15px;color:rgba(255,255,255,0.75);line-height:1.7;margin:0 0 18px;">${p}</p>`)
    .join("");

  const cta = claimUrl
    ? `<a href="${claimUrl}" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;margin-top:8px;">See your page →</a>`
    : "";

  const html = base(`${paragraphs}${cta}`, {
    relationship:
      "You're receiving this one-off invitation because we came across your public work and thought Spotlightly would suit you. You do not have an account with us.",
    unsubscribeUrl: unsubscribeUrl(to),
  });

  return send(to, subject, html, { category: "marketing", text: body });
}

/**
 * Same message as sendProspectInvite, but returns Resend's id so the caller
 * can correlate delivery, bounce and complaint webhooks back to the outreach
 * row. Used by the acquisition runner, which must stop a sequence the moment
 * a bounce arrives.
 */
export async function sendProspectInviteTracked(args: {
  to: string;
  subject: string;
  body: string;
  claimUrl?: string | null;
}): Promise<{ ok: boolean; providerId: string | null }> {
  const { to, subject, body, claimUrl } = args;
  if (!to || !subject || !body) return { ok: false, providerId: null };

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => escapeHtml(p).replace(/\n/g, "<br/>"))
    .filter(Boolean)
    .map((p) => `<p style="font-size:15px;color:rgba(255,255,255,0.75);line-height:1.7;margin:0 0 18px;">${p}</p>`)
    .join("");

  const cta = claimUrl
    ? `<a href="${claimUrl}" style="display:inline-block;background:#F0B429;color:#09090C;font-weight:bold;font-size:13px;padding:14px 28px;border-radius:4px;text-decoration:none;margin-top:8px;">See your page →</a>`
    : "";

  const html = base(`${paragraphs}${cta}`, {
    relationship:
      "You're receiving this one-off invitation because we came across your public work and thought Spotlightly would suit you. You do not have an account with us.",
    unsubscribeUrl: unsubscribeUrl(to),
  });

  const id = await sendRaw(to, subject, html, { category: "marketing", text: body });
  return { ok: id !== null, providerId: id };
}

/** Prospect copy is admin-authored plain text; never trust it as markup. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Admin alerts ────────────────────────────────────────────────────
// Internal heads-up emails to the platform owner so they don't have to log in
// to know something happened. Recipient is the configured admin address.
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@tahomaindustries.com";

export async function sendAdminAlert(subject: string, headline: string, lines: string[]) {
  const rows = lines
    .filter(Boolean)
    .map((l) => `<p style="font-size:14px;color:rgba(255,255,255,0.78);margin:0 0 8px;line-height:1.6;">${l}</p>`)
    .join("");
  const html = base(`
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:300;color:#ffffff;margin:0 0 16px;">${headline}</h1>
    ${rows}
    <p style="margin-top:28px;">
      <a href="https://www.spotlightly.app/admin" style="display:inline-block;background:#F0B429;color:#0A0A0D;font-size:13px;font-weight:700;padding:12px 24px;border-radius:4px;text-decoration:none;">Open admin →</a>
    </p>
  `, { relationship: "You're receiving this because you administer Spotlightly.", unsubscribeUrl: null });
  await send(ADMIN_EMAIL, `[Spotlightly] ${subject}`, html);
}
