import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { sendProspectInvite } from "@/lib/email";
import {
  OUTREACH_REFUSAL_MESSAGES,
  outreachRefusal,
  renderOutreachTemplate,
} from "@/lib/prospects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spotlightly.app").replace(/\/+$/, "");

/**
 * Compose a draft. ALWAYS lands as `pending` — there is no way to compose and
 * send in one call, by design. Approval is a separate, deliberate act.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const prospectId = String(body?.prospect_id || "");
  const subject = String(body?.subject || "").trim();
  const message = String(body?.body || "").trim();
  const channel = ["email", "dm", "manual"].includes(String(body?.channel)) ? String(body.channel) : "email";

  if (!prospectId) return NextResponse.json({ error: "Missing prospect_id" }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "A subject is required." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 });

  const admin = await createServiceClient();
  const { data: prospect } = await (admin as any)
    .from("creator_prospects")
    .select("id, display_name, platform, platform_handle, niche, creator_profile_id, do_not_contact, opted_out_at")
    .eq("id", prospectId)
    .maybeSingle();
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  // Refuse to even draft for somebody who has opted out — drafting invites
  // sending, and a draft that can never legitimately go out is a trap.
  if (prospect.do_not_contact) {
    return NextResponse.json({ error: OUTREACH_REFUSAL_MESSAGES.do_not_contact }, { status: 400 });
  }
  if (prospect.opted_out_at) {
    return NextResponse.json({ error: OUTREACH_REFUSAL_MESSAGES.opted_out }, { status: 400 });
  }

  // Resolve the claim URL now so the audit trail records exactly what was
  // offered, even if the code is later re-issued.
  let claimUrl: string | null = null;
  if (prospect.creator_profile_id) {
    const { data: profile } = await (admin as any)
      .from("creator_profiles")
      .select("claim_code, claimed_at")
      .eq("id", prospect.creator_profile_id)
      .maybeSingle();
    if (profile?.claim_code && !profile.claimed_at) claimUrl = `${APP_URL}/claim/${profile.claim_code}`;
  }

  const rendered = renderOutreachTemplate(message, {
    name: prospect.display_name,
    handle: prospect.platform_handle,
    platform: prospect.platform,
    niche: prospect.niche,
    claim_url: claimUrl,
  });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (admin as any)
    .from("prospect_outreach")
    .insert({
      prospect_id: prospectId,
      channel,
      subject,
      body: rendered,
      claim_url_sent: claimUrl,
      status: "pending",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Could not save this draft." }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id, claimUrl, preview: rendered });
}

/** Approve or reject a draft. Approval records who gave it. */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const id = String(body?.id || "");
  const action = String(body?.action || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Action must be approve or reject." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const admin = await createServiceClient();
  const { data: record } = await (admin as any)
    .from("prospect_outreach").select("id, status, sent_at").eq("id", id).maybeSingle();
  if (!record) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (record.sent_at) return NextResponse.json({ error: OUTREACH_REFUSAL_MESSAGES.already_sent }, { status: 400 });

  const fields = action === "approve"
    ? { status: "approved", approved_at: new Date().toISOString(), approved_by: user.id }
    : { status: "rejected", approved_at: null, approved_by: null };

  const { error } = await (admin as any).from("prospect_outreach").update(fields).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not update this draft." }, { status: 500 });

  return NextResponse.json({ ok: true, status: fields.status });
}

/**
 * Send an approved message.
 *
 * Eligibility is re-checked here against live data, not against whatever was
 * true when the draft was approved — somebody may have opted out in between.
 * The database CHECK constraints are the backstop; this is the first gate.
 */
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const admin = await createServiceClient();
  const { data: record } = await (admin as any)
    .from("prospect_outreach")
    .select("id, prospect_id, channel, subject, body, claim_url_sent, status, approved_at, approved_by, sent_at")
    .eq("id", id)
    .maybeSingle();
  if (!record) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const { data: prospect } = await (admin as any)
    .from("creator_prospects")
    .select("id, email, do_not_contact, opted_out_at, stage")
    .eq("id", record.prospect_id)
    .maybeSingle();

  const refusal = outreachRefusal(prospect, record);
  if (refusal) {
    return NextResponse.json({ error: OUTREACH_REFUSAL_MESSAGES[refusal], refusal }, { status: 400 });
  }

  // A 'manual' or 'dm' record is a log of contact made elsewhere: mark it
  // sent without touching the mail provider.
  let delivered = true;
  if (record.channel === "email") {
    delivered = await sendProspectInvite({
      to: prospect.email,
      subject: record.subject ?? "An invitation from Spotlightly",
      body: record.body,
      claimUrl: record.claim_url_sent,
    });
  }

  if (!delivered) {
    await (admin as any).from("prospect_outreach")
      .update({ status: "failed", error: "Delivery failed or was suppressed." })
      .eq("id", id);
    return NextResponse.json({ error: "The message could not be delivered." }, { status: 502 });
  }

  const sentAt = new Date().toISOString();
  const { error: sendErr } = await (admin as any).from("prospect_outreach")
    .update({ status: "sent", sent_at: sentAt, sent_by: user.id, error: null })
    .eq("id", id);
  if (sendErr) {
    // The mail went out; failing to record that is worse than failing to send,
    // so surface it loudly rather than returning success.
    return NextResponse.json(
      { error: "The message was sent but could not be recorded. Check the outreach log before resending." },
      { status: 500 }
    );
  }

  // Advance the pipeline, but never regress somebody who is already further on.
  if (prospect.stage === "identified" || prospect.stage === "qualified" || prospect.stage === "page_built") {
    await (admin as any).from("creator_prospects")
      .update({ stage: record.claim_url_sent ? "invited" : "contacted", updated_at: sentAt })
      .eq("id", prospect.id);
  }

  return NextResponse.json({ ok: true, sent_at: sentAt });
}
