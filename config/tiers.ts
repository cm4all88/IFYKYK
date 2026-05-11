export const CREATOR_TIERS = [
  { id: "starter",  name: "Starter",  price: 29,   maxSubs: 100,   description: "Getting started" },
  { id: "growth",   name: "Growth",   price: 99,   maxSubs: 500,   description: "Building momentum" },
  { id: "pro",      name: "Pro",      price: 249,  maxSubs: 1000,  description: "Professional creator" },
  { id: "elite",    name: "Elite",    price: 499,  maxSubs: 2500,  description: "Established creator" },
  { id: "premier",  name: "Premier",  price: 999,  maxSubs: 5000,  description: "Major creator" },
  { id: "icon",     name: "Icon",     price: 1999, maxSubs: 10000, description: "Icon status" },
  { id: "legend",   name: "Legend",   price: 3499, maxSubs: null,  description: "Unlimited" },
] as const;

export type TierId = (typeof CREATOR_TIERS)[number]["id"];

export function getTierForSubCount(subCount: number) {
  return (
    CREATOR_TIERS.find((t) => t.maxSubs === null || subCount <= t.maxSubs) ??
    CREATOR_TIERS[CREATOR_TIERS.length - 1]
  );
}

export function getAnnualPrice(tierId: TierId) {
  const tier = CREATOR_TIERS.find((t) => t.id === tierId);
  if (!tier) return 0;
  return tier.price * 10; // 2 months free = 10 months price
}
