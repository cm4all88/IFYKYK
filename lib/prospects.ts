// ──────────────────────────────────────────────────────────────────
// lib/prospects.ts
// Validation and pipeline rules for creator prospects, kept pure so every
// branch is testable without a database.
//
// A prospect is a person who has agreed to nothing. Two rules follow from
// that and are enforced here rather than in the UI, because the UI is not
// the only caller:
//
//   • Contact controls (do_not_contact, opted_out_at, missing address) are
//     checked at SEND time, not just when a message is drafted.
//   • Approval is required before sending. The database enforces it too
//     (061_prospect_outreach), so this is defence in depth, not the only gate.
// ──────────────────────────────────────────────────────────────────

export const PROSPECT_STAGES = [
  "identified",
  "qualified",
  "contacted",
  "replied",
  "page_built",
  "invited",
  "joined",
  "disqualified",
] as const;
export type ProspectStage = (typeof PROSPECT_STAGES)[number];

export const PROSPECT_SOURCES = [
  "manual", "csv", "referral", "inbound", "event", "partner", "other",
] as const;
export type ProspectSource = (typeof PROSPECT_SOURCES)[number];

export const PROSPECT_PLATFORMS = [
  "youtube", "tiktok", "instagram", "twitch", "substack", "x", "patreon", "other",
] as const;
export type ProspectPlatform = (typeof PROSPECT_PLATFORMS)[number];

/**
 * Stages an admin sets directly. Everything from `joined` onward reflects
 * something the creator did, so it is set by the claim flow or derived from
 * creator_profiles — never chosen from a dropdown.
 */
export const ADMIN_SETTABLE_STAGES: ProspectStage[] = [
  "identified", "qualified", "contacted", "replied", "disqualified",
];

export interface ProspectInput {
  display_name?: unknown;
  platform?: unknown;
  platform_handle?: unknown;
  profile_url?: unknown;
  email?: unknown;
  niche?: unknown;
  follower_count?: unknown;
  location?: unknown;
  handle_wanted?: unknown;
  source?: unknown;
  source_detail?: unknown;
  score?: unknown;
  notes?: unknown;
  follow_up_at?: unknown;
  do_not_contact?: unknown;
}

export interface ProspectFields {
  display_name: string;
  platform: ProspectPlatform | null;
  platform_handle: string | null;
  profile_url: string | null;
  email: string | null;
  niche: string | null;
  follower_count: number | null;
  location: string | null;
  handle_wanted: string | null;
  source: ProspectSource;
  source_detail: string | null;
  score: number | null;
  notes: string | null;
  follow_up_at: string | null;
  do_not_contact: boolean;
}

export type ValidationResult =
  | { ok: true; value: ProspectFields }
  | { ok: false; errors: string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/**
 * Normalise and validate prospect input from a form, an API call, or a CSV row.
 * Unknown fields are dropped rather than passed through — the caller builds
 * the database payload from the returned object, never from raw input.
 */
export function validateProspect(input: ProspectInput): ValidationResult {
  const errors: string[] = [];

  const display_name = str(input.display_name);
  if (!display_name) errors.push("Name is required.");
  else if (display_name.length > 200) errors.push("Name must be 200 characters or fewer.");

  const rawPlatform = str(input.platform)?.toLowerCase() ?? null;
  let platform: ProspectPlatform | null = null;
  if (rawPlatform) {
    if ((PROSPECT_PLATFORMS as readonly string[]).includes(rawPlatform)) {
      platform = rawPlatform as ProspectPlatform;
    } else {
      errors.push(`Platform must be one of: ${PROSPECT_PLATFORMS.join(", ")}.`);
    }
  }

  const rawSource = str(input.source)?.toLowerCase() ?? "manual";
  let source: ProspectSource = "manual";
  if ((PROSPECT_SOURCES as readonly string[]).includes(rawSource)) {
    source = rawSource as ProspectSource;
  } else {
    errors.push(`Source must be one of: ${PROSPECT_SOURCES.join(", ")}.`);
  }

  let email = str(input.email)?.toLowerCase() ?? null;
  if (email && !EMAIL_RE.test(email)) {
    errors.push("Enter a valid email address, or leave it blank.");
    email = null;
  }

  const profile_url = str(input.profile_url);
  if (profile_url && !/^https?:\/\//i.test(profile_url)) {
    errors.push("Profile URL must start with http:// or https://.");
  }

  let follower_count: number | null = null;
  if (input.follower_count !== undefined && input.follower_count !== null && input.follower_count !== "") {
    // Accept "1,200" and "1200" alike — CSV exports are inconsistent.
    const n = typeof input.follower_count === "number"
      ? input.follower_count
      : Number(String(input.follower_count).replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      errors.push("Follower count must be a whole number of zero or more.");
    } else {
      follower_count = n;
    }
  }

  let score: number | null = null;
  if (input.score !== undefined && input.score !== null && input.score !== "") {
    const n = Number(input.score);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) {
      errors.push("Score must be a whole number between 0 and 100.");
    } else {
      score = n;
    }
  }

  let follow_up_at: string | null = null;
  const rawFollowUp = str(input.follow_up_at);
  if (rawFollowUp) {
    const d = new Date(rawFollowUp);
    if (Number.isNaN(d.getTime())) errors.push("Follow-up date is not a valid date.");
    else follow_up_at = d.toISOString();
  }

  const handle_wanted = str(input.handle_wanted)?.toLowerCase().replace(/[^a-z0-9_]/g, "") ?? null;

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      display_name: display_name!,
      platform,
      platform_handle: str(input.platform_handle)?.replace(/^@/, "") ?? null,
      profile_url,
      email,
      niche: str(input.niche),
      follower_count,
      location: str(input.location),
      handle_wanted: handle_wanted && handle_wanted.length ? handle_wanted : null,
      source,
      source_detail: str(input.source_detail),
      score,
      notes: str(input.notes),
      follow_up_at,
      do_not_contact: input.do_not_contact === true || input.do_not_contact === "true",
    },
  };
}

/**
 * May an admin move a prospect from `from` to `to`?
 *
 * Deliberately permissive between the manual stages — real pipelines go
 * backwards, and an admin who mis-clicks should be able to correct it. What
 * it refuses is anything that would fake progress the creator has not made:
 * an admin cannot mark somebody `joined`, `invited`, or `page_built` by hand,
 * because those states are consequences of actions in other systems.
 */
export function canAdminSetStage(from: ProspectStage, to: ProspectStage): boolean {
  if (from === to) return true;
  if (!ADMIN_SETTABLE_STAGES.includes(to)) return false;
  // A prospect who already joined is a creator; the pipeline is done with them.
  if (from === "joined") return false;
  return true;
}

export type OutreachRefusal =
  | "no_email"
  | "do_not_contact"
  | "opted_out"
  | "not_approved"
  | "already_sent"
  | "rejected";

export interface OutreachProspect {
  email?: string | null;
  do_not_contact?: boolean | null;
  opted_out_at?: string | null;
}

export interface OutreachRecord {
  status?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  sent_at?: string | null;
}

/**
 * Why this outreach must not be sent, or null if it may be.
 *
 * Checked immediately before handing anything to Resend — a message approved
 * yesterday must not go out if the person opted out this morning.
 */
export function outreachRefusal(
  prospect: OutreachProspect | null | undefined,
  record: OutreachRecord | null | undefined
): OutreachRefusal | null {
  if (!record) return "not_approved";
  if (record.sent_at || record.status === "sent") return "already_sent";
  if (record.status === "rejected") return "rejected";
  if (record.status !== "approved" || !record.approved_at || !record.approved_by) return "not_approved";

  if (!prospect) return "no_email";
  if (prospect.do_not_contact === true) return "do_not_contact";
  if (prospect.opted_out_at) return "opted_out";
  if (!prospect.email || !EMAIL_RE.test(prospect.email)) return "no_email";

  return null;
}

export const OUTREACH_REFUSAL_MESSAGES: Record<OutreachRefusal, string> = {
  no_email: "This prospect has no valid email address on file.",
  do_not_contact: "This prospect is marked do-not-contact.",
  opted_out: "This prospect has unsubscribed.",
  not_approved: "This message has not been approved yet.",
  already_sent: "This message has already been sent.",
  rejected: "This message was rejected. Draft a new one.",
};

/** Substitutes {{name}}, {{handle}}, {{platform}}, {{niche}}, {{claim_url}}. */
export function renderOutreachTemplate(
  template: string,
  vars: { name?: string | null; handle?: string | null; platform?: string | null; niche?: string | null; claim_url?: string | null }
): string {
  return template.replace(/\{\{\s*(name|handle|platform|niche|claim_url)\s*\}\}/g, (_m, key: string) => {
    const v = (vars as Record<string, string | null | undefined>)[key];
    return v == null ? "" : String(v);
  });
}
