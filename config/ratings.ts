export const CONTENT_RATINGS = [
  {
    id: "G",
    label: "G — General",
    color: "#2a8a50",
    description: "Safe for all ages",
    examples: "Hair tutorials, cooking, fitness, education",
    paymentProcessor: "stripe",
    ageGate: false,
  },
  {
    id: "PG",
    label: "PG — Parental Guidance",
    color: "#1858c0",
    description: "Mild content — fine for teens",
    examples: "Dance, comedy, lifestyle, music",
    paymentProcessor: "stripe",
    ageGate: false,
  },
  {
    id: "M",
    label: "M — Mature",
    color: "#c87010",
    description: "Mature themes, not explicit",
    examples: "Relationship advice, adult humor",
    paymentProcessor: "stripe",
    ageGate: false,
  },
  {
    id: "R",
    label: "R — Restricted",
    color: "#c04010",
    description: "Requires age gate (18+)",
    examples: "Nudity, explicit language",
    paymentProcessor: "ccbill",
    ageGate: true,
    requiresVeriff: true,
  },
  {
    id: "X",
    label: "X — Explicit",
    color: "#8a2040",
    description: "Explicit adult content",
    examples: "Explicit adult content",
    paymentProcessor: "ccbill",
    ageGate: true,
    requiresVeriff: true,
    requires2257: true,
  },
] as const;

export type ContentRating = (typeof CONTENT_RATINGS)[number]["id"];

export function getRating(id: ContentRating) {
  return CONTENT_RATINGS.find(r => r.id === id);
}

export function requiresCCBill(rating: ContentRating) {
  return rating === "R" || rating === "X";
}

export function isAdultContent(rating: ContentRating) {
  return rating === "R" || rating === "X";
}
