// ──────────────────────────────────────────────────────────────────
// acquisition-service.ts — the IO half of the acquisition runner.
//
// Every decision lives in lib/acquisition-runner.ts (pure, fully tested).
// This file only performs the effects: read prospects, build a page through
// the EXISTING concierge path, mint a claim code with the EXISTING helper,
// send through the EXISTING Resend wrapper, and write the audit trail.
//
// Three safety properties are enforced here rather than by the caller:
//
//   1. KILL SWITCH. platform_settings.acquisition_runner_enabled must be 'on'.
//      It ships 'off'. Nothing sends until an administrator flips it.
//   2. APPROVAL. prospect_outreach requires approved_at + approved_by before
//      sent_at (constraint from 061). The runner resolves the configured
//      admin user and stamps it, so every automated send is still attributable
//      to a named human who enabled the runner.
//   3. RE-CHECK BEFORE SEND. Suppression is evaluated again immediately
//      before the Resend call, not just at planning time.
//
// Nothing in here touches creator_profiles rows that are already claimed,
// nor auth users, billing, subscriptions, payments or Stripe.
// ──────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase-server";
import { createConciergeCreator, normalizeHandle, syntheticEmailFor } from "@/lib/concierge-create";
import { claimExpiryFrom, generateClaimCode } from "@/lib/claim";
import { sendProspectInviteTracked } from "@/lib/email";
import {
  buildInvite,
  chooseAvatar,
  DEFAULT_BATCH_SIZE,
  MAX_NEW_PER_DAY,
  nextMessage,
  planBatch,
  qualify,
  sendBlock,
  type Candidate,
  type OutreachHistory,
} from "@/lib/acquisition-runner";

export interface RunOptions {
  dryRun?: boolean;
  limit?: number;
  trigger?: "manual" | "cron" | "dry_run";
}

export interface RunResult {
  runId: string | null;
  dryRun: boolean;
  considered: number;
  qualified: number;
  pagesCreated: number;
  claimLinks: number;
  emailsSent: number;
  followUps: number;
  skipped: { id: string; display_name: string; reason: string }[];
  failed: { id: string; display_name: string; error: string }[];
  paused: boolean;
  pauseReason: string | null;
  preview: {
    display_name: string;
    email: string;
    sequence: number;
    handle: string;
    claimUrl: string;
    avatar: string;
    subject: string;
    text: string;
  }[];
  blocked: string | null;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://spotlightly.app";

function empty(overrides: Partial<RunResult> = {}): RunResult {
  return {
    runId: null,
    dryRun: false,
    considered: 0,
    qualified: 0,
    pagesCreated: 0,
    claimLinks: 0,
    emailsSent: 0,
    followUps: 0,
    skipped: [],
    failed: [],
    paused: false,
    pauseReason: null,
    preview: [],
    blocked: null,
    ...overrides,
  };
}

/** Extracts a site avatar from public HTML. Prefers icons over og:image. */
export function extractAvatarUrl(html: string, pageUrl: string): string | null {
  const abs = (u: string): string | null => {
    try {
      const url = new URL(u, pageUrl);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  };
  const pick = (re: RegExp): string | null => {
    const m = re.exec(html);
    return m ? abs(m[1]) : null;
  };
  return (
    pick(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i) ||
    pick(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i) ||
    pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
  );
}

async function fetchAvatar(pageUrl: string): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(pageUrl, {
      signal: ctl.signal,
      headers: { "User-Agent": "SpotlightlyBot/1.0 (+https://spotlightly.app)" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    return extractAvatarUrl(await res.text(), pageUrl);
  } catch {
    return null;
  }
}

async function settingEnabled(db: any): Promise<boolean> {
  const { data } = await db
    .from("platform_settings")
    .select("value")
    .eq("key", "acquisition_runner_enabled")
    .maybeSingle();
  return (data?.value ?? "off").trim().toLowerCase() === "on";
}

/** The admin user whose authority every automated send is attributed to. */
async function resolveAdminUserId(db: any): Promise<string | null> {
  const email = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) return null;
  try {
    const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = (data?.users ?? []).find(
      (x: any) => (x.email ?? "").trim().toLowerCase() === email
    );
    return u?.id ?? null;
  } catch {
    return null;
  }
}

export async function runAcquisitionBatch(opts: RunOptions = {}): Promise<RunResult> {
  const dryRun = opts.dryRun === true;
  const limit = Math.max(0, Math.min(opts.limit ?? DEFAULT_BATCH_SIZE, MAX_NEW_PER_DAY));
  const trigger = opts.trigger ?? (dryRun ? "dry_run" : "manual");
  const now = new Date();

  const db: any = await createServiceClient();

  if (!dryRun && !(await settingEnabled(db))) {
    return empty({ blocked: "acquisition_runner_enabled is 'off' in platform_settings" });
  }

  const adminId = dryRun ? null : await resolveAdminUserId(db);
  if (!dryRun && !adminId) {
    return empty({
      blocked:
        "Could not resolve NEXT_PUBLIC_ADMIN_EMAIL to a user; outreach requires an approver (061 constraint)",
    });
  }

  // ── Candidates ──────────────────────────────────────────────────
  const { data: rows, error } = await db
    .from("creator_prospects")
    .select(
      "id, display_name, email, location, profile_url, platform, platform_handle, niche, notes, stage, do_not_contact, opted_out_at, creator_profile_id, handle_wanted"
    )
    .in("stage", ["qualified", "identified", "invited"])
    .eq("do_not_contact", false)
    .is("opted_out_at", null)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) return empty({ blocked: `prospect query failed: ${error.message}` });

  const prospects = rows ?? [];
  if (prospects.length === 0) return empty({ dryRun, blocked: "no candidate prospects" });

  const ids = prospects.map((p: any) => p.id);
  const { data: hist } = await db
    .from("prospect_outreach")
    .select(
      "prospect_id, sequence, sent_at, bounced_at, unsubscribed_at, replied_at, complained_at"
    )
    .in("prospect_id", ids);

  const byProspect = new Map<string, OutreachHistory[]>();
  for (const h of hist ?? []) {
    const list = byProspect.get(h.prospect_id) ?? [];
    list.push(h);
    byProspect.set(h.prospect_id, list);
  }

  // Global counters for the circuit breaker and the daily cap.
  const { count: sentTotal } = await db
    .from("prospect_outreach")
    .select("id", { count: "exact", head: true })
    .not("sent_at", "is", null);
  const { count: bouncedTotal } = await db
    .from("prospect_outreach")
    .select("id", { count: "exact", head: true })
    .not("bounced_at", "is", null);

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count: sentToday } = await db
    .from("prospect_outreach")
    .select("id", { count: "exact", head: true })
    .eq("sequence", 1)
    .gte("sent_at", dayAgo);

  const candidates: Candidate[] = prospects.map((p: any) => ({
    ...p,
    history: byProspect.get(p.id) ?? [],
  }));

  const plan = planBatch(candidates, {
    now,
    limit,
    sentToday: sentToday ?? 0,
    stats: { sent: sentTotal ?? 0, bounced: bouncedTotal ?? 0 },
  });

  const result = empty({
    dryRun,
    considered: candidates.length,
    qualified: plan.send.length,
    skipped: plan.skipped,
    paused: plan.paused,
    pauseReason: plan.pauseReason,
  });

  // ── Run log ─────────────────────────────────────────────────────
  let runId: string | null = null;
  if (!dryRun) {
    const { data: run } = await db
      .from("acquisition_runs")
      .insert({ trigger, dry_run: false, batch_size: limit, considered: candidates.length })
      .select("id")
      .maybeSingle();
    runId = run?.id ?? null;
    result.runId = runId;
  }

  const byId = new Map<string, any>(
    prospects.map((p: any) => [p.id as string, p] as [string, any])
  );

  for (const s of plan.send) {
    const p = byId.get(s.id);
    if (!p) continue;

    try {
      // ── Page + claim code ───────────────────────────────────────
      let profileId: string | null = p.creator_profile_id ?? null;
      let handle = normalizeHandle(p.handle_wanted || p.platform_handle || p.display_name);
      let claimCode: string | null = null;
      let createdPage = false;

      if (profileId) {
        const { data: prof } = await db
          .from("creator_profiles")
          .select("id, handle, claim_code, claimed_at")
          .eq("id", profileId)
          .maybeSingle();
        // Never touch a page somebody has already claimed.
        if (prof?.claimed_at) {
          result.skipped.push({ id: s.id, display_name: s.display_name, reason: "already_claimed" });
          continue;
        }
        handle = prof?.handle ?? handle;
        claimCode = prof?.claim_code ?? null;
      }

      if (!profileId) {
        if (dryRun) {
          claimCode = "0".repeat(32);
        } else {
          const created = await createConciergeCreator({
            handle,
            displayName: s.display_name,
            email: syntheticEmailFor(handle),
          });
          if (!created.ok) {
            result.failed.push({
              id: s.id,
              display_name: s.display_name,
              error: `page_build:${created.error}${created.detail ? `:${created.detail}` : ""}`,
            });
            continue;
          }
          profileId = created.profileId ?? null;
          handle = created.handle ?? handle;
          createdPage = true;
        }
      }

      if (!dryRun && profileId && !claimCode) {
        claimCode = generateClaimCode();
        await db
          .from("creator_profiles")
          .update({ claim_code: claimCode, claim_expires_at: claimExpiryFrom(), claimed_at: null })
          .eq("id", profileId)
          .is("claimed_at", null);
      }

      // ── Page content, verified fields only ──────────────────────
      const avatarPage = p.profile_url as string | null;
      const websiteAvatar =
        !dryRun && avatarPage && p.platform === "other" ? await fetchAvatar(avatarPage) : null;
      const avatar = chooseAvatar({
        displayName: s.display_name,
        websiteAvatarUrl: websiteAvatar,
        websiteSourceUrl: avatarPage,
      });

      if (!dryRun && profileId) {
        const fields: Record<string, unknown> = {
          display_name: s.display_name,
          published: false,
          updated_at: new Date().toISOString(),
        };
        if (p.location) fields.location = p.location;
        if (avatar.url) {
          fields.avatar_url = avatar.url;
          fields.avatar_source_url = avatar.sourceUrl;
        }
        await db.from("creator_profiles").update(fields).eq("id", profileId).is("claimed_at", null);
      }

      const claimUrl = `${APP_URL}/claim/${claimCode ?? "0".repeat(32)}`;
      const mail = buildInvite({
        displayName: s.display_name,
        detail: s.detail,
        claimUrl,
        sequence: s.sequence,
      });

      if (createdPage) result.pagesCreated += 1;
      if (claimCode) result.claimLinks += 1;

      result.preview.push({
        display_name: s.display_name,
        email: s.email,
        sequence: s.sequence,
        handle,
        claimUrl,
        avatar: avatar.source === "placeholder" ? `initials:${avatar.initials}` : avatar.url!,
        subject: mail.subject,
        text: mail.text,
      });

      if (dryRun) continue;

      // ── Re-check suppression immediately before sending ─────────
      const { data: fresh } = await db
        .from("creator_prospects")
        .select("email, do_not_contact, opted_out_at")
        .eq("id", s.id)
        .maybeSingle();
      const block = sendBlock(fresh ?? {}, byProspect.get(s.id) ?? []);
      if (block) {
        result.skipped.push({ id: s.id, display_name: s.display_name, reason: `late_${block}` });
        continue;
      }

      // ── Audit row first. The unique (prospect_id, sequence) index is
      //    what makes a retry safe: a duplicate collides here, before
      //    anything is handed to Resend.
      const { data: rec, error: recErr } = await db
        .from("prospect_outreach")
        .insert({
          prospect_id: s.id,
          channel: "email",
          sequence: s.sequence,
          subject: mail.subject,
          body: mail.text,
          claim_url_sent: claimUrl,
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: adminId,
          created_by: adminId,
        })
        .select("id")
        .maybeSingle();

      if (recErr || !rec) {
        result.skipped.push({
          id: s.id,
          display_name: s.display_name,
          reason: `duplicate_sequence_or_insert_failed`,
        });
        continue;
      }

      const { ok, providerId } = await sendProspectInviteTracked({
        to: s.email,
        subject: mail.subject,
        body: mail.text,
        claimUrl,
      });

      if (!ok) {
        await db
          .from("prospect_outreach")
          .update({ status: "failed", error: "resend_rejected" })
          .eq("id", rec.id);
        result.failed.push({ id: s.id, display_name: s.display_name, error: "resend_rejected" });
        continue;
      }

      const sentAt = new Date().toISOString();
      await db
        .from("prospect_outreach")
        .update({ status: "sent", sent_at: sentAt, sent_by: adminId, provider_id: providerId })
        .eq("id", rec.id);

      const nxt = nextMessage(
        [...(byProspect.get(s.id) ?? []), { sent_at: sentAt, sequence: s.sequence }],
        new Date()
      );
      await db
        .from("creator_prospects")
        .update({
          stage: "invited",
          follow_up_at: nxt ? nxt.dueAt.toISOString() : null,
          creator_profile_id: profileId,
          updated_at: sentAt,
        })
        .eq("id", s.id);

      if (s.sequence === 1) result.emailsSent += 1;
      else result.followUps += 1;
    } catch (e: unknown) {
      result.failed.push({
        id: s.id,
        display_name: s.display_name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (!dryRun && runId) {
    await db
      .from("acquisition_runs")
      .update({
        finished_at: new Date().toISOString(),
        qualified: result.qualified,
        pages_created: result.pagesCreated,
        emails_sent: result.emailsSent,
        follow_ups: result.followUps,
        skipped: result.skipped.length,
        failed: result.failed.length,
        paused: result.paused,
        pause_reason: result.pauseReason,
        detail: { skipped: result.skipped.slice(0, 100), failed: result.failed.slice(0, 100) },
      })
      .eq("id", runId);
  }

  return result;
}

/** Qualification-only pass, for reporting without touching anything. */
export async function auditQualification() {
  const db: any = await createServiceClient();
  const { data } = await db
    .from("creator_prospects")
    .select("id, display_name, email, location, profile_url, platform, platform_handle, niche, notes, stage, do_not_contact, opted_out_at")
    .in("stage", ["qualified", "identified"]);
  const rows = data ?? [];
  const passed = rows.filter((r: any) => qualify(r).qualified);
  return { total: rows.length, qualified: passed.length, rejected: rows.length - passed.length };
}
