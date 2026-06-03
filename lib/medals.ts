// Medals — a single cheap recognition currency. Fans buy packs (money is 100%
// Spotlightly's), hold a balance, and spend one medal to crown a standout post.
// Medals never convert back to cash for anyone, so there's nothing to redeem.

export const POINTS_PER_MEDAL = 1; // leaderboard weight per medal
export const MEDAL_EMOJI = "🏅";

export interface MedalPack {
  id: string;
  medals: number;
  price: number; // USD, charged once
}

// Slight bonus as packs grow — effective ~$0.27–0.42 per medal.
export const MEDAL_PACKS: MedalPack[] = [
  { id: "pack_5", medals: 12, price: 5 },
  { id: "pack_10", medals: 30, price: 10 },
  { id: "pack_20", medals: 75, price: 20 },
];

export function getPack(id: string): MedalPack | undefined {
  return MEDAL_PACKS.find((p) => p.id === id);
}
