/**
 * Tier definitions for Spotlightly's three creator tiers.
 *
 * The venue metaphor:
 * - Opening Act: ages 13-17, parental consent, SFW only
 * - Spotlight: ages 18+, default tier, SFW (G/PG/M)
 * - Backstage: ages 18+, opt-in adult content (R/X), separate identity
 *
 * Internal codes match these names. UI labels render from this file.
 */

export type TierCode = "opening_act" | "spotlight" | "backstage";

export type ContentRating = "G" | "PG" | "M" | "R" | "X";

export type PaymentProcessor = "stripe" | "ccbill";

export interface TierMeta {
  code: TierCode;
  label: string;
  shortLabel: string;
  ageRange: string;
  description: string;
  allowedRatings: ContentRating[];
  processor: PaymentProcessor;
  requiresParentalConsent: boolean;
  requiresAgeVerification: boolean;
  requires2257: boolean;
}

export const TIERS: Record<TierCode, TierMeta> = {
  opening_act: {
    code: "opening_act",
    label: "Opening Act",
    shortLabel: "Opening Act",
    ageRange: "13-17",
    description: "The teen lane. Safe, age-appropriate, full-featured for young creators building their first audience.",
    allowedRatings: ["G", "PG"],
    processor: "stripe",
    requiresParentalConsent: true,
    requiresAgeVerification: false,
    requires2257: false,
  },
  spotlight: {
    code: "spotlight",
    label: "Spotlight",
    shortLabel: "Spotlight",
    ageRange: "18+",
    description: "The main platform. Where careers are built. Full monetization with subscriptions, tips, locked posts, and live content.",
    allowedRatings: ["G", "PG", "M"],
    processor: "stripe",
    requiresParentalConsent: false,
    requiresAgeVerification: false,
    requires2257: false,
  },
  backstage: {
    code: "backstage",
    label: "Backstage",
    shortLabel: "Backstage",
    ageRange: "18+ verified",
    description: "Adult content, handled professionally. A separate public identity from your Spotlight presence, linked or hidden by your choice.",
    allowedRatings: ["R", "X"],
    processor: "ccbill",
    requiresParentalConsent: false,
    requiresAgeVerification: true,
    requires2257: true,
  },
};

export function tierLabel(code: TierCode | string): string {
  if (code in TIERS) return TIERS[code as TierCode].label;
  return code;
}

export function tierForRating(rating: ContentRating): TierCode {
  if (rating === "R" || rating === "X") return "backstage";
  return "spotlight";
}

/**
 * Map old creator_type values to new tier codes.
 * Used during the schema migration. Remove this once migration is complete.
 */
export const LEGACY_TYPE_MAP: Record<string, TierCode> = {
  young: "opening_act",
  sfw: "spotlight",
  adult: "backstage",
};