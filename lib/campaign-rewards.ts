// Reward types a creator can attach to a campaign tier.
// The platform only needs to know the TYPE — the creator writes her own label.
// "physical" and "discount" are real-world promises, so a backing on a tier that
// includes one generates a backer code the creator looks up (or scans) when the
// backer redeems at their own counter. The platform records the pledge; the
// creator owns fulfillment.

export type RewardType = "update" | "recognition" | "content" | "physical" | "discount";

export interface TierReward {
  type: RewardType;
  label: string;
}

export const REWARD_TYPES: {
  type: RewardType;
  name: string;
  needsCode: boolean;
  hint: string; // a coffee-shop example, shown as a suggestion in the builder
}[] = [
  { type: "update", name: "Backer updates", needsCode: false, hint: "Progress posts as the build comes together" },
  { type: "recognition", name: "Recognition", needsCode: false, hint: "Name in the founding supporters list" },
  { type: "content", name: "Content access", needsCode: false, hint: "The build journey posts, behind the counter" },
  { type: "physical", name: "Physical perk", needsCode: true, hint: "A free drink at opening" },
  { type: "discount", name: "Discount perk", needsCode: true, hint: "25% off for a year, name on the wall" },
];

const NEEDS_CODE = new Set<RewardType>(["physical", "discount"]);

export function tierNeedsCode(rewards: TierReward[] | null | undefined): boolean {
  return Array.isArray(rewards) && rewards.some((r) => r && NEEDS_CODE.has(r.type));
}

export function rewardTypeName(type: RewardType): string {
  return REWARD_TYPES.find((r) => r.type === type)?.name ?? type;
}

// Human-friendly, unambiguous backer code: SL-XXXXXX (no 0/O/1/I/L).
// Validated against the stored donation row at redemption, so a non-crypto
// random source is fine here.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generateBackerCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `SL-${out}`;
}
