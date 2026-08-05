// ──────────────────────────────────────────────────────────────────────────────
// lib/creator-public.ts
//
// The single definition of what is publicly visible about a creator.
//
// Why this file exists: `creator_profiles` carried a policy
// `"Creators are publicly readable" FOR SELECT TO public USING (true)`, which
// exposed EVERY column to anyone holding the anon key — the key that ships in
// the browser bundle. That included `claim_code`, a bearer credential: whoever
// reads one can set the email and password on that creator's account. Seven
// live unclaimed codes were readable at the time of the 2026-08-05 audit.
//
// The fix is a curated projection. Migration 064 creates the SQL view
// `public.creator_public` from exactly PUBLIC_CREATOR_COLUMNS below, revokes
// direct table access from anon, and leaves the base table readable only by its
// owner. Every anonymous read in the application goes through the view.
//
// INVARIANTS
//   1. PUBLIC_CREATOR_COLUMNS and the view definition in 064 must agree. The
//      test suite asserts the list contains nothing from FORBIDDEN_COLUMNS.
//   2. Never `select("*")` against creator_profiles from a browser or anon
//      context. Use CREATOR_PUBLIC_VIEW and name your columns.
//   3. Adding a column to creator_profiles does NOT make it public. It has to
//      be added here and to the view, deliberately.
// ──────────────────────────────────────────────────────────────────────────────

/** The PostgREST/SQL relation that anonymous callers may read. */
export const CREATOR_PUBLIC_VIEW = "creator_public" as const;

/**
 * Columns safe to expose to an unauthenticated visitor.
 * Everything here is already rendered on a public creator page.
 */
export const PUBLIC_CREATOR_COLUMNS = [
  "id",
  "handle",
  "display_name",
  "bio",
  "avatar_url",
  "cover_url",
  "bg_url",
  "location",
  "location_city",
  "location_country",
  "niche",
  "tags",
  "kind",
  "creator_type",
  "subscription_price",
  "published",
  "is_active",
  "founded",
  "veriff_verified",
  "stripe_onboarded",
  "linked",
  "offers_services",
  "booking_url",
  "booking_label",
  "wishlist_url",
  "social_links",
  "free_tier_name",
  "free_tier_blurb",
  "free_tier_perks",
  "first_month_offer_pct",
  "medal_count_total",
  "medal_points_total",
  "onboarding_completed_at",
  "created_at",
  "updated_at",
] as const;

/**
 * Columns that must never appear in a public projection.
 *
 * `claim_code` / `claim_expires_at` / `claimed_at` are claim credentials and
 * claim state. `date_of_birth`, `parental_consent_at` and `graduated_at` are
 * age-and-consent compliance data. The `first_*` / `last_*` set is visitor
 * tracking, including raw IP addresses. `shipping_*` is a home address. The
 * Stripe and CCBill identifiers are payment routing. `user_id` is the internal
 * auth id and no public surface needs it (verified: the public creator page,
 * explore, search, sitemap and recommendations consume none of it).
 */
export const FORBIDDEN_PUBLIC_COLUMNS = [
  "claim_code",
  "claim_expires_at",
  "claimed_at",
  "date_of_birth",
  "parental_consent_at",
  "graduated_at",
  "first_ip",
  "last_ip",
  "first_user_agent",
  "last_user_agent",
  "first_city",
  "first_country",
  "first_region",
  "first_seen_at",
  "last_city",
  "last_country",
  "last_region",
  "last_seen_at",
  "shipping_name",
  "shipping_address",
  "shipping_city",
  "shipping_state",
  "shipping_zip",
  "shipping_country",
  "stripe_account_id",
  "ccbill_account_number",
  "ccbill_sub_account",
  "blocked_regions",
  "deleted_at",
  "search_vector",
  "user_id",
] as const;

/** Comma-separated select list for the common public page read. */
export const PUBLIC_CREATOR_SELECT = PUBLIC_CREATOR_COLUMNS.join(", ");

/** The narrower list the discovery surfaces (explore, search, recommendations) need. */
export const PUBLIC_CREATOR_CARD_SELECT =
  "id, handle, display_name, bio, avatar_url, subscription_price, tags, location_city, location_country";

/**
 * True when `column` may be exposed to an anonymous caller.
 * Used by the test suite to police the projection.
 */
export function isPublicCreatorColumn(column: string): boolean {
  return (PUBLIC_CREATOR_COLUMNS as readonly string[]).includes(column);
}
