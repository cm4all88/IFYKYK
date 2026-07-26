// ──────────────────────────────────────────────────────────────────
// acquisition-discovery.ts — turning a public page into a candidate record.
//
// The runner could verify, prepare and contact, but "find" was still being
// done by hand. This module is that half: given the HTML of a page a creator
// publishes about themselves, extract the fields qualification needs.
//
// PURE. Fetching lives in the service; everything here is string in, facts
// out, so the extraction rules can be tested against real page shapes.
//
// The governing rule is the same one that governs the whole pipeline:
// EXTRACT, NEVER INFER. Every function returns null rather than a guess.
// A wrong email addresses a stranger; a wrong location contacts someone
// outside the target market; a wrong activity signal wakes a dormant
// account. All three are worse than returning nothing and skipping them.
// ──────────────────────────────────────────────────────────────────

const EMAIL_IN_TEXT =
  /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;

/** Addresses that belong to infrastructure, vendors or nobody. */
const NOT_A_PERSON =
  /^(no-?reply|do-?not-?reply|postmaster|abuse|webmaster|hostmaster|mailer-daemon|filler|sentry|wordpress|admin@localhost)/i;

/**
 * Vendor, telemetry and platform-system domains — matched on ANY subdomain.
 *
 * Anchoring on "@wixpress.com$" let real pages through with addresses like
 * 605a…@sentry-next.wixpress.com and 7c33…@o363271.ingest.us.sentry.io.
 * Those are Sentry DSN keys, not people. A scan of 41 live prospect pages
 * produced seven of them and nothing else, so an unfixed version of this
 * would have written telemetry keys into the prospect table as business
 * addresses.
 */
const VENDOR_DOMAIN =
  /@(?:[a-z0-9-]+\.)*(example\.(?:com|org|net)|test\.com|godaddy\.com|sentry\.io|wixpress\.com|squarespace\.com|shopify\.com|bandcamp\.com|myshopify\.com|wordpress\.com|localhost)$/i;

/**
 * A local part that is a long hex string is a machine key, not a mailbox.
 * Sentry DSNs are the common case.
 */
const HASH_LOCALPART = /^[0-9a-f]{16,}@/i;

/**
 * Every plausible business address on the page, best first.
 *
 * Prefers an address on the site's own domain over a free-mail address,
 * because a self-hosted address is stronger evidence that it is published
 * for business rather than scraped from a comment thread.
 */
export function extractEmails(html: string, pageUrl?: string): string[] {
  let host = "";
  try {
    if (pageUrl) host = new URL(pageUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    host = "";
  }

  const found = new Set<string>();
  for (const m of Array.from(html.matchAll(EMAIL_IN_TEXT))) {
    const raw = m[1];
    // Strip anything that came out of a filename or asset reference.
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(raw)) continue;
    const e = raw.toLowerCase();
    if (NOT_A_PERSON.test(e)) continue;
    if (VENDOR_DOMAIN.test(e)) continue;
    if (HASH_LOCALPART.test(e)) continue;
    found.add(e);
  }

  const list = Array.from(found);
  if (!host) return list;
  return list.sort((a, b) => {
    const aOwn = a.endsWith(`@${host}`) ? 0 : 1;
    const bOwn = b.endsWith(`@${host}`) ? 0 : 1;
    return aOwn - bOwn;
  });
}

// ── Activity ──────────────────────────────────────────────────────

/**
 * Evidence the page is current, or null.
 *
 * `year` is the reference year the caller compares against "now" — the
 * module does not decide what counts as recent, because that depends on the
 * caller's clock, and a module that reads the clock cannot be tested.
 */
export interface ActivitySignal {
  kind: "copyright" | "datetime" | "modified" | "dated-copy";
  year: number;
  evidence: string;
}

export function extractActivity(html: string): ActivitySignal | null {
  const found: ActivitySignal[] = [];

  // Machine-readable dates. Take the LATEST on the page, not the first —
  // a page carries many, and the first in source order is usually the
  // oldest item in a list.
  const isoRe =
    /(?:<meta[^>]+property=["']article:(?:modified|published)_time["'][^>]+content=|datetime=)["'](20\d{2})-\d{2}-\d{2}/gi;
  for (const m of Array.from(html.matchAll(isoRe))) {
    found.push({ kind: "datetime", year: Number(m[1]), evidence: m[0].slice(0, 80) });
  }

  const modRe = /last\s+(?:modified|updated)\s+(?:on\s+)?[^<]{0,30}?(20\d{2})/gi;
  for (const m of Array.from(html.matchAll(modRe))) {
    found.push({ kind: "modified", year: Number(m[1]), evidence: m[0].trim().slice(0, 80) });
  }

  // A copyright year is weaker evidence than a timestamp, but it is still
  // evidence, and a stale timestamp must not mask a current one.
  const copyRe = /(?:©|&copy;|copyright)\s*(?:\(c\)\s*)?(?:\d{4}\s*[–—-]\s*)?(20\d{2})/gi;
  for (const m of Array.from(html.matchAll(copyRe))) {
    found.push({ kind: "copyright", year: Number(m[1]), evidence: m[0].trim().slice(0, 80) });
  }

  if (found.length === 0) return null;

  // Most recent year wins; among equal years prefer the stronger kind.
  const RANK: Record<ActivitySignal["kind"], number> = {
    datetime: 0, modified: 1, copyright: 2, "dated-copy": 3,
  };
  found.sort((a, b) => b.year - a.year || RANK[a.kind] - RANK[b.kind]);
  return found[0];
}

// ── Location ──────────────────────────────────────────────────────

const STATE_ABBR =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

/**
 * A US location stated on the page, or null.
 *
 * Looks for a postal-address shape — "City, ST" optionally followed by a ZIP
 * — or schema.org address markup. Deliberately does NOT accept a bare state
 * name found loose in prose, because "...shipping to Washington" is not a
 * statement about where the creator is.
 */
export function extractUsLocation(html: string): string | null {
  const schema =
    /"addressLocality"\s*:\s*"([^"]{2,40})"[\s\S]{0,120}?"addressRegion"\s*:\s*"([^"]{2,20})"/i.exec(html);
  if (schema) {
    const region = schema[2].trim();
    if (new RegExp(`^(${STATE_ABBR})$`, "i").test(region)) {
      return `${schema[1].trim()}, ${region.toUpperCase()}, USA`;
    }
  }

  const postal = new RegExp(
    `\\b([A-Z][A-Za-z.'-]+(?:\\s+[A-Z][A-Za-z.'-]+){0,2}),\\s*(${STATE_ABBR})\\b(?:\\s+\\d{5})?`,
    "g"
  );
  for (const m of Array.from(html.matchAll(postal))) {
    const city = m[1].trim();
    // Reject sentence fragments that happen to fit the shape.
    if (/^(the|and|for|with|from|our|this|all|copyright|inc|llc)$/i.test(city)) continue;
    if (city.length < 3) continue;
    return `${city}, ${m[2].toUpperCase()}, USA`;
  }

  return null;
}

// ── Monetization ──────────────────────────────────────────────────

export interface MonetizationSignal {
  kinds: string[];
  /** A quoted price, when one is published. */
  price: string | null;
  evidence: string;
}

const PLATFORMS: [string, RegExp][] = [
  ["patreon", /patreon\.com/i],
  ["ko-fi", /ko-?fi\.com/i],
  ["gumroad", /gumroad\.com/i],
  ["etsy", /etsy\.com/i],
  ["bandcamp", /bandcamp\.com/i],
  ["buymeacoffee", /buymeacoffee\.com/i],
  ["shopify-cart", /\/cart\/add|add-to-cart|shopify/i],
  ["commissions", /\bcommissions?\b/i],
  ["coaching", /\bcoaching\b|\bpersonal training\b/i],
  ["merch", /\bmerch(andise)?\b/i],
  ["deposit", /\bdeposit\b/i],
  ["subscription", /\bsubscri(be|ption)\b|\bmembers?hip\b/i],
];

export function extractMonetization(html: string): MonetizationSignal | null {
  const kinds = PLATFORMS.filter(([, re]) => re.test(html)).map(([k]) => k);
  if (kinds.length === 0) return null;

  const price =
    /(?:USD\s*)?[$€£]\s?\d{1,5}(?:[.,]\d{2})?(?:\s*(?:-|–|to)\s*[$€£]?\s?\d{1,5})?(?:\s*(?:\/|per\s+)(?:month|mo|session|hour|hr))?/i.exec(
      html.replace(/<[^>]+>/g, " ")
    );

  return {
    kinds,
    price: price ? price[0].replace(/\s+/g, " ").trim() : null,
    evidence: kinds.slice(0, 4).join(", "),
  };
}

// ── Social profiles ───────────────────────────────────────────────

const SOCIALS: [string, RegExp][] = [
  ["instagram", /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})/i],
  ["tiktok", /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([A-Za-z0-9._]{2,30})/i],
  ["youtube", /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([A-Za-z0-9._-]{2,30})/i],
  ["x", /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{2,30})/i],
  ["twitch", /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([A-Za-z0-9_]{2,30})/i],
  ["patreon", /(?:https?:\/\/)?(?:www\.)?patreon\.com\/([A-Za-z0-9_-]{2,30})/i],
];

const RESERVED = /^(share|intent|home|about|explore|p|reel|status|watch|channel|user|c)$/i;

export function extractSocials(html: string): { platform: string; handle: string }[] {
  const out: { platform: string; handle: string }[] = [];
  for (const [platform, re] of SOCIALS) {
    const m = re.exec(html);
    if (m && !RESERVED.test(m[1])) out.push({ platform, handle: m[1] });
  }
  return out;
}

// ── Is this one person? ───────────────────────────────────────────

const TEAM_LANGUAGE =
  /\b(our team|we are a|our staff|our artists|meet the team|LLC\b|L\.L\.C|GbR\b|Inc\.|our designers|our company|join our)\b/i;
const SOLO_LANGUAGE =
  /\b(I am|I'm|my studio|I make|I create|I design|I hand-?make|just me|one-?woman|one-?man|solo (artist|maker))\b/i;

/**
 * A view on whether the page describes an individual.
 *
 * Returns null when the page says nothing either way — an absent signal is
 * not evidence of a solo creator, and the caller must treat it as unproven.
 */
export function assessIndividual(html: string): { individual: boolean; evidence: string } | null {
  const text = html.replace(/<[^>]+>/g, " ");
  const team = TEAM_LANGUAGE.exec(text);
  const solo = SOLO_LANGUAGE.exec(text);

  // Team language wins: a sole trader with an LLC is still a company for
  // the purposes of "is this a self-managed individual creator".
  if (team) return { individual: false, evidence: team[0].trim() };
  if (solo) return { individual: true, evidence: solo[0].trim() };
  return null;
}

// ── The candidate record ──────────────────────────────────────────

export interface DiscoveredCandidate {
  profile_url: string;
  email: string | null;
  location: string | null;
  activity: ActivitySignal | null;
  monetization: MonetizationSignal | null;
  socials: { platform: string; handle: string }[];
  individual: boolean | null;
  /** Assembled into the notes field so qualify() can read the evidence. */
  notes: string;
  /** Everything that could not be established, for the reviewer. */
  missing: string[];
}

/**
 * Build a candidate from one public page.
 *
 * The notes string is deliberately shaped to match the format the rest of
 * the pipeline already reads — an ACTIVITY: clause and a MONETIZATION:
 * clause — so a discovered candidate flows through qualify() and
 * extractDetail() with no special-casing.
 */
export function buildCandidate(html: string, pageUrl: string): DiscoveredCandidate {
  const emails = extractEmails(html, pageUrl);
  const location = extractUsLocation(html);
  const activity = extractActivity(html);
  const monetization = extractMonetization(html);
  const socials = extractSocials(html);
  const ind = assessIndividual(html);

  const missing: string[] = [];
  if (emails.length === 0) missing.push("business email");
  if (!location) missing.push("US location");
  if (!activity) missing.push("activity evidence");
  if (!monetization) missing.push("monetization evidence");
  if (socials.length === 0) missing.push("social profile");
  if (ind === null) missing.push("individual-vs-company evidence");

  const parts = [`DISCOVERED by fetching ${pageUrl}.`];
  if (ind) parts.push(ind.individual ? `INDIVIDUAL: "${ind.evidence}".` : `TEAM LANGUAGE: "${ind.evidence}".`);
  if (activity) parts.push(`ACTIVITY: ${activity.kind} ${activity.year} — "${activity.evidence}".`);
  if (monetization) {
    parts.push(
      `MONETIZATION: ${monetization.evidence}${monetization.price ? ` at ${monetization.price}` : ""}.`
    );
  }
  if (location) parts.push(`LOCATION: ${location}, stated on the page.`);
  if (emails.length) parts.push(`CONTACT: ${emails[0]} published in plain text.`);
  if (socials.length) {
    parts.push(`SOCIALS: ${socials.map((s) => `${s.platform} @${s.handle}`).join(", ")}.`);
  }
  if (missing.length) parts.push(`NOT ESTABLISHED: ${missing.join(", ")}.`);

  return {
    profile_url: pageUrl,
    email: emails[0] ?? null,
    location,
    activity,
    monetization,
    socials,
    individual: ind ? ind.individual : null,
    notes: parts.join(" "),
    missing,
  };
}
