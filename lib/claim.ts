// ──────────────────────────────────────────────────────────────────
// lib/claim.ts
// Rules for concierge claim links, kept pure so they can be tested without
// a database and shared by the claim route, the claim page, and the admin
// screen that issues codes.
//
// A claim code is a bearer secret: whoever holds it sets the email and
// password on a pre-created account. Three properties matter.
//
//   Format  — codes are exactly the 32 lowercase hex characters produced by
//             crypto.randomUUID() with dashes stripped. Checking the shape
//             before touching the database means /claim/<junk> can never be
//             used as an unauthenticated service-role database probe.
//   Expiry  — a link that leaks a year later should be worthless. NULL means
//             "no expiry" so links issued before this existed keep working.
//   Single-use — enforced in the database, not here. See app/api/claim/route.ts.
// ──────────────────────────────────────────────────────────────────

/** Codes are `crypto.randomUUID()` with dashes removed: 32 lowercase hex chars. */
export const CLAIM_CODE_RE = /^[0-9a-f]{32}$/;

/** How long a newly issued claim link stays valid. */
export const CLAIM_TTL_DAYS = 14;

export function isValidClaimCodeFormat(code: unknown): code is string {
  return typeof code === "string" && CLAIM_CODE_RE.test(code);
}

/** Generate a claim code. Uses the platform CSPRNG. */
export function generateClaimCode(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

/** The expiry stamp for a code issued at `now`. */
export function claimExpiryFrom(now: Date = new Date()): string {
  return new Date(now.getTime() + CLAIM_TTL_DAYS * 86_400_000).toISOString();
}

/**
 * Has this claim link expired?
 * NULL / undefined / unparseable → not expired. Legacy links predate the
 * column entirely and must keep working; an unparseable value should never
 * lock a real creator out of an account we asked them to claim.
 */
export function isClaimExpired(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

/**
 * Is this a page an admin prepared that nobody has claimed yet?
 *
 * Such a page describes a real person who has not agreed to be on Spotlightly.
 * `published` only hides a page from Explore — the page itself stays reachable
 * by direct link — so this is the signal for `noindex` and for any
 * "not yet claimed" treatment in the UI.
 */
export function isUnclaimedPreview(
  p: { published?: boolean | null; claimed_at?: string | null } | null | undefined
): boolean {
  if (!p) return false;
  return p.published === false && !p.claimed_at;
}

/** The synthetic address `createCreator` assigns when an admin supplies none. */
export const CONCIERGE_EMAIL_RE = /^concierge_.+@spotlightly\.app$/i;

/**
 * Should the "Welcome to Spotlightly — your stage is ready" email be
 * suppressed for this newly created auth user?
 *
 * Yes when the account was created by an admin preparing a page rather than by
 * somebody signing up. That person has consented to nothing, so a welcome
 * email would be unapproved outreach. They receive a real, approved invitation
 * at claim time instead.
 */
export function shouldSuppressWelcomeEmail(input: {
  email?: string | null;
  claim_code?: string | null;
  claimed_at?: string | null;
}): boolean {
  if (input.claim_code && !input.claimed_at) return true;
  return CONCIERGE_EMAIL_RE.test(String(input.email ?? ""));
}

export type ClaimRejection = "malformed" | "not_found" | "already_claimed" | "expired";

/**
 * Why a claim attempt should be refused, or null if it may proceed.
 * Split out from the route so every branch is directly testable.
 */
export function claimRejection(
  code: unknown,
  profile: { claimed_at?: string | null; claim_expires_at?: string | null } | null | undefined,
  now: Date = new Date()
): ClaimRejection | null {
  if (!isValidClaimCodeFormat(code)) return "malformed";
  if (!profile) return "not_found";
  if (profile.claimed_at) return "already_claimed";
  if (isClaimExpired(profile.claim_expires_at, now)) return "expired";
  return null;
}
