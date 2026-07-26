// ──────────────────────────────────────────────────────────────────
// acquisition-runner.ts — every decision the acquisition runner makes.
//
// PURE. No database, no network, no clock of its own. The IO lives in
// lib/acquisition-service.ts; everything that decides *whether* to act lives
// here so it can be tested exhaustively without a Supabase or a Resend key.
//
// Invariants this file exists to hold:
//
//   • Nobody is contacted without a verified public business email, a
//     verified US location and evidence of recent activity. Absence of
//     evidence is disqualifying — never assume.
//   • A prospect receives at most THREE messages, ever, across all records.
//   • A bounce, unsubscribe, reply, complaint or do-not-contact flag ends the
//     sequence immediately and permanently.
//   • Follow-ups are 4 days and 9 days after the INITIAL send, not after the
//     previous one, so a delayed send cannot compress the sequence.
//   • The batch pauses itself if the bounce rate crosses 5%, measured over a
//     meaningful sample rather than the first bounce.
//
// Suppression is deliberately checked twice: once when planning a batch and
// again immediately before handing anything to Resend. A prospect who
// unsubscribes between those two moments must not receive the message.
// ──────────────────────────────────────────────────────────────────

export const MAX_MESSAGES_PER_PROSPECT = 3;
export const FOLLOW_UP_1_DAYS = 4;
export const FOLLOW_UP_2_DAYS = 9;
export const DEFAULT_BATCH_SIZE = 10;
export const MAX_NEW_PER_DAY = 20;
export const BOUNCE_PAUSE_RATE = 0.05;
/** Below this many sends, one bounce is noise rather than a signal. */
export const BOUNCE_MIN_SAMPLE = 10;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/** Addresses that are role accounts or obvious placeholders — never contact. */
const ROLE_EMAIL_RE =
  /^(no-?reply|do-?not-?reply|postmaster|abuse|webmaster|hostmaster|mailer-daemon|filler)@/i;
const PLACEHOLDER_EMAIL_RE = /(example\.(com|org|net)|test\.com|filler@|@godaddy\.com)$/i;

// ── US location ───────────────────────────────────────────────────

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];
const US_STATE_NAMES = [
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut",
  "delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa",
  "kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan",
  "minnesota","mississippi","missouri","montana","nebraska","nevada",
  "new hampshire","new jersey","new mexico","new york","north carolina",
  "north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island",
  "south carolina","south dakota","tennessee","texas","utah","vermont",
  "virginia","washington","west virginia","wisconsin","wyoming",
];

/**
 * True only when the string positively identifies a US location.
 *
 * A bare "Washington" is accepted as the state; "Washington, UK" is not,
 * because the explicit foreign country wins. Anything unrecognised is false —
 * an unknown location must never be treated as domestic.
 */
export function isUsLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  const raw = location.trim();
  if (!raw) return false;
  const s = raw.toLowerCase();

  // An explicit non-US country anywhere in the string disqualifies it, even if
  // a US-looking token also appears (e.g. "Netherlands (originally Ohio)").
  const foreign = [
    "united kingdom","england","scotland","wales","ireland","canada","australia",
    "new zealand","germany","france","spain","italy","netherlands","belgium",
    "sweden","norway","denmark","finland","poland","portugal","austria",
    "switzerland","czech","japan","china","korea","singapore","india","brazil",
    "mexico","argentina","chile","south africa","philippines","indonesia",
    "malaysia","thailand","vietnam","russia","ukraine","turkey","greece",
    "hungary","romania","israel","uae","dubai",
    ", uk", ", gb", ", ca,", ", de", ", fr", ", au", ", nz", ", nl",
  ];
  if (foreign.some((f) => s.includes(f))) return false;

  if (/\b(usa|u\.s\.a\.|united states|u\.s\.)\b/.test(s)) return true;

  // ", TX" / ", TX," / ", TX 78701" — a state code in positional context.
  if (US_STATES.some((st) => new RegExp(`,\\s*${st}\\b`, "i").test(raw))) return true;
  if (US_STATE_NAMES.some((n) => new RegExp(`\\b${n}\\b`).test(s))) return true;

  return false;
}

// ── Qualification ─────────────────────────────────────────────────

export interface QualificationInput {
  display_name?: string | null;
  email?: string | null;
  location?: string | null;
  profile_url?: string | null;
  platform?: string | null;
  platform_handle?: string | null;
  niche?: string | null;
  notes?: string | null;
  stage?: string | null;
  do_not_contact?: boolean | null;
  opted_out_at?: string | null;
}

export type DisqualifyReason =
  | "no_name"
  | "no_email"
  | "role_or_placeholder_email"
  | "not_us"
  | "no_social_profile"
  | "no_recent_activity"
  | "no_monetization"
  | "not_individual"
  | "triage_rejected"
  | "suppressed";

export interface QualificationResult {
  qualified: boolean;
  reasons: DisqualifyReason[];
  /** Verified detail reused as the email's opening line. */
  evidence: {
    location: string | null;
    activity: string | null;
    monetization: string | null;
  };
}

/** Wording in the verification notes that marks a non-individual. */
const NOT_INDIVIDUAL_RE =
  /\b(company|companies|GbR|LLC|agency|our team|dedicated team|design team|a team|partnership|studio, not|workshop|corporation|Inc\.)\b/i;

/** Wording that evidences activity we actually saw, with a date or a signal. */
const ACTIVITY_RE =
  /(copyright\s*\(c\)?\s*2026|©\s*2026|\b2026\b[^.]{0,60}(convention|modified|window|release|post)|most recent post|posted\s+yesterday|booked\s+(two|2)\s+to\s+four|commissions?\s+(are\s+)?open|last modified on)/i;

const MONETIZATION_RE =
  /\b(patreon|ko-?fi|commission|merch|shop|store|subscription|tiers?|paid member|deposit|per session|\/month|\bUSD\b|\bEUR\b|pre-?order|wishlist|gumroad|etsy|bandcamp)\b/i;

export function qualify(p: QualificationInput): QualificationResult {
  const reasons: DisqualifyReason[] = [];
  const notes = p.notes ?? "";

  if (!p.display_name || !p.display_name.trim()) reasons.push("no_name");

  const email = (p.email ?? "").trim();
  if (!email || !EMAIL_RE.test(email)) {
    reasons.push("no_email");
  } else if (ROLE_EMAIL_RE.test(email) || PLACEHOLDER_EMAIL_RE.test(email)) {
    reasons.push("role_or_placeholder_email");
  }

  if (!isUsLocation(p.location)) reasons.push("not_us");

  // A verified social profile: a real https profile URL, plus a platform and
  // handle we actually recorded.
  const url = (p.profile_url ?? "").trim();
  const hasUrl = /^https:\/\/[^\s]+\.[^\s]+/i.test(url);
  const hasHandle = !!(p.platform && p.platform_handle && p.platform_handle.trim());
  if (!hasUrl || !hasHandle) reasons.push("no_social_profile");

  const activity = ACTIVITY_RE.exec(notes);
  if (!activity) reasons.push("no_recent_activity");

  const money = MONETIZATION_RE.exec(notes);
  if (!money) reasons.push("no_monetization");

  if (NOT_INDIVIDUAL_RE.test(notes)) reasons.push("not_individual");

  // A human triage verdict outranks every regex above it. The keyword
  // heuristics exist to catch what a reviewer has not looked at yet; they
  // must never re-admit somebody a reviewer already rejected. Without this,
  // "commissions are open" in a note about a DORMANT creator reads as
  // evidence of activity and puts them back in the send queue.
  if (/TRIAGE[^:]*:\s*REJECT/i.test(notes)) reasons.push("triage_rejected");

  if (p.do_not_contact === true || p.opted_out_at) reasons.push("suppressed");

  return {
    qualified: reasons.length === 0,
    reasons,
    evidence: {
      location: isUsLocation(p.location) ? (p.location ?? null) : null,
      activity: activity ? activity[0] : null,
      monetization: money ? money[0] : null,
    },
  };
}

// ── Suppression, applied at plan time AND again at send time ───────

export interface OutreachHistory {
  sent_at?: string | null;
  sequence?: number | null;
  bounced_at?: string | null;
  unsubscribed_at?: string | null;
  replied_at?: string | null;
  complained_at?: string | null;
}

export type SendBlock =
  | "do_not_contact"
  | "opted_out"
  | "bounced"
  | "replied"
  | "complained"
  | "max_messages"
  | "no_email";

/**
 * Why this prospect must not receive another message, or null if they may.
 *
 * Ends the sequence permanently on any negative signal. Note that `replied`
 * is a stop: someone who answered is a conversation, not a campaign.
 */
export function sendBlock(
  prospect: { email?: string | null; do_not_contact?: boolean | null; opted_out_at?: string | null },
  history: OutreachHistory[]
): SendBlock | null {
  if (prospect.do_not_contact === true) return "do_not_contact";
  if (prospect.opted_out_at) return "opted_out";

  const email = (prospect.email ?? "").trim();
  if (!email || !EMAIL_RE.test(email)) return "no_email";

  if (history.some((h) => h.bounced_at)) return "bounced";
  if (history.some((h) => h.unsubscribed_at)) return "opted_out";
  if (history.some((h) => h.complained_at)) return "complained";
  if (history.some((h) => h.replied_at)) return "replied";

  const sent = history.filter((h) => h.sent_at).length;
  if (sent >= MAX_MESSAGES_PER_PROSPECT) return "max_messages";

  return null;
}

// ── Follow-up scheduling ──────────────────────────────────────────

export interface FollowUpPlan {
  /** 1 = initial, 2 = day-4 follow-up, 3 = day-9 final. */
  sequence: number;
  dueAt: Date;
  /** True when dueAt has passed and the message should go now. */
  due: boolean;
}

/**
 * The next message in the sequence, or null if there is none.
 *
 * Both follow-ups are measured from the INITIAL send. Measuring the second
 * from the first would let a late send slide the whole schedule.
 */
export function nextMessage(history: OutreachHistory[], now: Date): FollowUpPlan | null {
  const sends = history
    .filter((h) => h.sent_at)
    .map((h) => new Date(h.sent_at as string))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sends.length === 0) return { sequence: 1, dueAt: now, due: true };
  if (sends.length >= MAX_MESSAGES_PER_PROSPECT) return null;

  const first = sends[0];
  const offset = sends.length === 1 ? FOLLOW_UP_1_DAYS : FOLLOW_UP_2_DAYS;
  const dueAt = new Date(first.getTime() + offset * 24 * 60 * 60 * 1000);
  return { sequence: sends.length + 1, dueAt, due: now.getTime() >= dueAt.getTime() };
}

// ── Bounce-rate circuit breaker ───────────────────────────────────

export function bounceRate(sent: number, bounced: number): number {
  if (sent <= 0) return 0;
  return bounced / sent;
}

/**
 * Pause only once the sample is big enough to mean something. One bounce out
 * of three is 33% and tells you nothing; one out of forty is a signal.
 */
export function shouldPause(sent: number, bounced: number): boolean {
  if (sent < BOUNCE_MIN_SAMPLE) return false;
  return bounceRate(sent, bounced) > BOUNCE_PAUSE_RATE;
}

// ── Avatar selection ──────────────────────────────────────────────

export type AvatarSource = "website" | "social" | "placeholder";

export interface AvatarChoice {
  source: AvatarSource;
  url: string | null;
  /** The page the image was taken from, recorded on the profile. */
  sourceUrl: string | null;
  initials: string | null;
}

/** Anything that looks like content rather than an avatar. */
const NON_AVATAR_RE = /\/(posts?|gallery|galleries|products?|shop|media|uploads?\/\d{4})\//i;

export function initialsFor(name: string | null | undefined): string {
  const parts = (name ?? "")
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s._-]+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Exactly one temporary image, preferring the creator's own site.
 *
 * Refuses anything that looks like post/gallery/product imagery — the brief
 * allows an avatar, not a scrape of someone's work.
 */
export function chooseAvatar(input: {
  displayName?: string | null;
  websiteAvatarUrl?: string | null;
  websiteSourceUrl?: string | null;
  socialAvatarUrl?: string | null;
  socialSourceUrl?: string | null;
}): AvatarChoice {
  const ok = (u?: string | null) =>
    !!u && /^https:\/\//i.test(u) && !NON_AVATAR_RE.test(u);

  if (ok(input.websiteAvatarUrl)) {
    return {
      source: "website",
      url: input.websiteAvatarUrl!,
      sourceUrl: input.websiteSourceUrl ?? null,
      initials: null,
    };
  }
  if (ok(input.socialAvatarUrl)) {
    return {
      source: "social",
      url: input.socialAvatarUrl!,
      sourceUrl: input.socialSourceUrl ?? null,
      initials: null,
    };
  }
  return {
    source: "placeholder",
    url: null,
    sourceUrl: null,
    initials: initialsFor(input.displayName),
  };
}

// ── The message ───────────────────────────────────────────────────

/**
 * How to address this person.
 *
 * Only splits off a first name when the display name actually looks like a
 * personal name — two capitalised alphabetic words. Brand and handle names
 * are used whole, because "Hi The," and "Hi lost," (from "The Geeky
 * Seamstress" and "lost boy ?") are worse than no personalisation at all.
 */
export function firstNameOf(displayName: string | null | undefined): string {
  const cleaned = (displayName ?? "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "there";

  const words = cleaned.split(/[\s,]+/).filter(Boolean);

  // "Christina Persika", "Gavin Maxwell" — a personal name.
  if (
    words.length === 2 &&
    words.every((w) => /^[A-Z][a-z'’-]{1,}$/.test(w))
  ) {
    return words[0];
  }

  // A connector word means this is a brand, not a name: "Ink By Faye",
  // "The Geeky Seamstress", "King Of Weighted". Splitting those yields
  // "Hi Ink," and "Hi The,".
  const CONNECTOR = /^(by|the|of|and|for|with|a|an|at|on|to)$/i;
  const hasConnector = words.some((w) => CONNECTOR.test(w));

  // "Emma-Lee Moss" style, or a three-part personal name.
  if (
    !hasConnector &&
    words.length === 3 &&
    words.every((w) => /^[A-Z][A-Za-z'’.-]*$/.test(w)) &&
    !/cosplay|studio|props|makes|parlor|designs|wigs|training|fitness/i.test(cleaned)
  ) {
    return words[0];
  }

  // Anything else is a brand or handle: address it whole if it is short
  // enough to read naturally, otherwise fall back to a neutral greeting.
  return cleaned.length <= 28 ? cleaned : "there";
}

/**
 * A specific, verified detail for the opening line.
 *
 * Taken from the MONETIZATION clause of the verification notes, which is a
 * sentence a human wrote after reading the creator's own page. Returns null
 * rather than guessing — buildInvite drops the sentence entirely when there
 * is nothing concrete, which is the honest outcome.
 */
export function extractDetail(notes: string | null | undefined): string | null {
  const m = /MONETIZATION:\s*([^.]{12,180})\./i.exec(notes ?? "");
  if (!m) return null;

  let s = m[1].trim().replace(/\s+/g, " ");
  // Strip leading editorialising so the sentence reads as fact.
  s = s.replace(/^(the\s+)?(most|unusually|genuinely|remarkably)\b[^,]*,\s*/i, "");
  s = s.replace(/^(a|an|the)\s+/i, "");

  // Keep one clause. The full note is a paragraph; pasted whole it reads as
  // a dossier rather than a sentence somebody wrote.
  const comma = s.indexOf(", ");
  if (comma > 24) s = s.slice(0, comma);
  if (s.length > 96) {
    const cut = s.lastIndexOf(" ", 96);
    s = s.slice(0, cut > 24 ? cut : 96);
  }
  s = s.replace(/[\s,;:-]+$/, "");
  if (s.length < 12) return null;

  if (/^[A-Z][a-z]/.test(s)) s = s[0].toLowerCase() + s.slice(1);

  // The template reads "I came across <detail>." — make it grammatical.
  if (!/^(your|the|a|an|his|her|their)\b/i.test(s)) s = `your ${s}`;
  return s;
}

export interface InviteEmail {
  subject: string;
  text: string;
}

/**
 * The invitation, as plain text.
 *
 * `detail` must be something verified about this specific person. If we have
 * nothing specific, the sentence is dropped rather than filled with a
 * generality — a fake-personal opener is worse than none.
 */
export function buildInvite(args: {
  displayName: string;
  detail?: string | null;
  claimUrl: string;
  sequence?: number;
}): InviteEmail {
  const { displayName, claimUrl } = args;
  const first = firstNameOf(displayName);
  const seq = args.sequence ?? 1;
  const detail = (args.detail ?? "").trim();

  if (seq === 1) {
    const opener = detail ? `I came across ${detail}.\n\n` : "";
    return {
      subject: `I built a Spotlightly page for ${displayName}`,
      text:
        `Hi ${first},\n\n` +
        opener +
        `I'm Chris, the founder of Spotlightly. It brings subscriptions, tips, paid content, messages, merch, and other creator income into one place.\n\n` +
        `I prepared an unlisted Spotlightly page using the public information you already share. It is not listed in Spotlightly discovery and has not been claimed.\n\n` +
        `${claimUrl}\n\n` +
        `You can claim it, request changes, or ignore it.\n\n` +
        `Chris\nFounder, Spotlightly`,
    };
  }

  if (seq === 2) {
    return {
      subject: `Re: I built a Spotlightly page for ${displayName}`,
      text:
        `Hi ${first},\n\n` +
        `Following up on the Spotlightly page I put together for you. It is still unlisted and unclaimed:\n\n` +
        `${claimUrl}\n\n` +
        `If it is not useful, no reply is needed and I will not chase it further after one last note.\n\n` +
        `Chris\nFounder, Spotlightly`,
    };
  }

  return {
    subject: `Last note about your Spotlightly page`,
    text:
      `Hi ${first},\n\n` +
      `This is the last email I will send about this. The page stays available if you want it:\n\n` +
      `${claimUrl}\n\n` +
      `If you would rather it did not exist at all, reply and I will delete it.\n\n` +
      `Chris\nFounder, Spotlightly`,
  };
}

// ── Batch planning ────────────────────────────────────────────────

export interface Candidate extends QualificationInput {
  id: string;
  history?: OutreachHistory[];
}

export interface PlannedSend {
  id: string;
  display_name: string;
  email: string;
  sequence: number;
  detail: string | null;
}

export interface BatchPlan {
  send: PlannedSend[];
  skipped: { id: string; display_name: string; reason: string }[];
  paused: boolean;
  pauseReason: string | null;
}

/**
 * Decide who gets a message in this batch.
 *
 * Deduplicates by lowercased email so two records for the same person can
 * never both be contacted, caps new (sequence-1) sends at the daily limit,
 * and refuses to plan anything at all while the circuit breaker is open.
 */
export function planBatch(
  candidates: Candidate[],
  opts: {
    now: Date;
    limit?: number;
    sentToday?: number;
    stats?: { sent: number; bounced: number };
    alreadyContactedEmails?: Iterable<string>;
  }
): BatchPlan {
  const limit = Math.max(0, opts.limit ?? DEFAULT_BATCH_SIZE);
  const sentToday = opts.sentToday ?? 0;
  const skipped: BatchPlan["skipped"] = [];

  if (opts.stats && shouldPause(opts.stats.sent, opts.stats.bounced)) {
    const pct = (bounceRate(opts.stats.sent, opts.stats.bounced) * 100).toFixed(1);
    return {
      send: [],
      skipped: candidates.map((c) => ({
        id: c.id,
        display_name: c.display_name ?? "",
        reason: "paused_bounce_rate",
      })),
      paused: true,
      pauseReason: `Bounce rate ${pct}% exceeds ${BOUNCE_PAUSE_RATE * 100}% over ${opts.stats.sent} sends`,
    };
  }

  const seen = new Set<string>();
  for (const e of Array.from(opts.alreadyContactedEmails ?? [])) seen.add(e.trim().toLowerCase());

  const send: PlannedSend[] = [];
  let newToday = sentToday;

  for (const c of candidates) {
    const name = c.display_name ?? "";
    const email = (c.email ?? "").trim().toLowerCase();
    const history = c.history ?? [];

    const block = sendBlock(c, history);
    if (block) {
      skipped.push({ id: c.id, display_name: name, reason: block });
      continue;
    }

    const next = nextMessage(history, opts.now);
    if (!next) {
      skipped.push({ id: c.id, display_name: name, reason: "max_messages" });
      continue;
    }
    if (!next.due) {
      skipped.push({ id: c.id, display_name: name, reason: "follow_up_not_due" });
      continue;
    }

    // A first contact requires full qualification. Follow-ups do not re-run
    // it — the person was qualified when the sequence started, and a site
    // going quiet mid-sequence should not strand them half-contacted.
    if (next.sequence === 1) {
      const q = qualify(c);
      if (!q.qualified) {
        skipped.push({ id: c.id, display_name: name, reason: `unqualified:${q.reasons.join("+")}` });
        continue;
      }
      if (seen.has(email)) {
        skipped.push({ id: c.id, display_name: name, reason: "duplicate_email" });
        continue;
      }
      if (newToday >= MAX_NEW_PER_DAY) {
        skipped.push({ id: c.id, display_name: name, reason: "daily_cap" });
        continue;
      }
      newToday += 1;
    }

    if (send.length >= limit) {
      skipped.push({ id: c.id, display_name: name, reason: "batch_limit" });
      continue;
    }

    seen.add(email);
    send.push({
      id: c.id,
      display_name: name,
      email,
      sequence: next.sequence,
      detail: extractDetail(c.notes),
    });
  }

  return { send, skipped, paused: false, pauseReason: null };
}
