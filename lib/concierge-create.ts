// ──────────────────────────────────────────────────────────────────
// lib/concierge-create.ts
// The single path that mints a creator identity on somebody's behalf.
//
// Extracted from the createCreator server action in app/admin/creators so the
// prospect pipeline can reuse it rather than growing a second, drifting copy.
// Both callers now share one implementation, one rollback, and one set of
// rules about the synthetic email address.
// ──────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase-server";
import { claimExpiryFrom, generateClaimCode } from "@/lib/claim";

export type ConciergeCreateError =
  | "missing_fields"
  | "handle_taken"
  | "email_taken"
  | "auth_failed"
  | "profile_failed";

export interface ConciergeCreateResult {
  ok: boolean;
  error?: ConciergeCreateError;
  detail?: string;
  profileId?: string;
  userId?: string;
  handle?: string;
  claimCode?: string;
}

/** `concierge_{handle}@spotlightly.app` — never a real person's address. */
export function syntheticEmailFor(handle: string): string {
  return `concierge_${handle}@spotlightly.app`;
}

export function normalizeHandle(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/**
 * Create a prepared, unclaimed creator page.
 *
 * `email` defaults to the synthetic address and the PROSPECT PIPELINE MUST
 * LEAVE IT UNSET. Putting a prospect's real address into auth.users would
 * (a) let the auth webhook treat it as a signup and email them, and (b) store
 * a non-consenting person's address in the auth system before they have
 * agreed to anything. Their real address belongs in creator_prospects.email
 * until they claim the page and set their own credentials.
 *
 * The parameter exists only because /admin/creators has always let an admin
 * supply an address for a creator who has already asked them to set the
 * account up. That path is unchanged.
 */
export async function createConciergeCreator(args: {
  handle: string;
  displayName: string;
  email?: string | null;
}): Promise<ConciergeCreateResult> {
  const handle = normalizeHandle(args.handle);
  const displayName = (args.displayName || "").trim();
  if (!handle || !displayName) return { ok: false, error: "missing_fields" };

  const admin = await createServiceClient();

  const { data: existing } = await (admin as any)
    .from("creator_profiles").select("id").eq("handle", handle).maybeSingle();
  if (existing) return { ok: false, error: "handle_taken" };

  const email = (args.email || "").trim().toLowerCase() || syntheticEmailFor(handle);
  // CSPRNG: this briefly guards a real account until the creator claims it.
  const tempPassword = "Sl" + crypto.randomBytes(18).toString("base64url") + "!9";
  const claimCode = generateClaimCode();

  const { data: created, error: cErr } = await (admin as any).auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
  });
  if (cErr || !created?.user) {
    const msg = (cErr as any)?.message || "auth returned no user";
    const m = msg.toLowerCase();
    const dup = m.includes("already") || m.includes("registered") || m.includes("exists");
    return { ok: false, error: dup ? "email_taken" : "auth_failed", detail: String(msg).slice(0, 200) };
  }

  const { data: row, error: pErr } = await (admin as any).from("creator_profiles").insert({
    user_id: created.user.id,
    handle,
    display_name: displayName,
    creator_type: "spotlight",
    kind: "spotlight",
    published: false,
    claim_code: claimCode,
    claim_expires_at: claimExpiryFrom(),
  }).select("id").single();

  if (pErr) {
    // Best-effort rollback so a failed insert does not strand an auth user.
    try { await (admin as any).auth.admin.deleteUser(created.user.id); } catch { /* non-fatal */ }
    return { ok: false, error: "profile_failed", detail: String((pErr as any).message || "").slice(0, 200) };
  }

  // Trial billing row so the prepared page is not billing-locked. A trigger
  // (045) also provisions a free row on insert; this upsert makes the
  // concierge case an explicit year-long trial instead.
  const trialEnds = new Date(Date.now() + 365 * 86400000).toISOString();
  await (admin as any).from("creator_billing").upsert({
    user_id: created.user.id,
    status: "trial",
    tier: "starter",
    trial_ends_at: trialEnds,
    current_period_end: trialEnds,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  return { ok: true, profileId: row?.id, userId: created.user.id, handle, claimCode };
}
