/**
 * Tier definitions for Spotlightly's two creator tiers.
 *
 * The venue metaphor:
 * - Spotlight: ages 18+, default tier, SFW (G/PG/M)
 * - Backstage: ages 18+, opt-in adult content (R/X), separate public identity
 *
 * Internal codes match these names. UI labels render from this file.
 */

export type TierCode = "spotlight" | "backstage";

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
  requiresAgeVerification: boolean;
  requires2257: boolean;
}

export const TIERS: Record<TierCode, TierMeta> = {
  spotlight: {
    code: "spotlight",
    label: "Spotlight",
    shortLabel: "Spotlight",
    ageRange: "18+",
    description:
      "The main platform. Where careers are built. Full monetization with subscriptions, tips, locked posts, and live content.",
    allowedRatings: ["G", "PG", "M"],
    processor: "stripe",
    requiresAgeVerification: false,
    requires2257: false,
  },
  backstage: {
    code: "backstage",
    label: "Backstage",
    shortLabel: "Backstage",
    ageRange: "18+ verified",
    description:
      "Adult content, handled professionally. A separate public identity from your Spotlight presence, linked or hidden by your choice.",
    allowedRatings: ["R", "X"],
    processor: "ccbill",
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
