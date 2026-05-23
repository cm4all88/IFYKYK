// ──────────────────────────────────────────────────────────────────
// lib/categories.ts
// Predefined creator categories — used across signup, profile setup,
// explore filters, and the recommendation engine.
// ──────────────────────────────────────────────────────────────────

export const CREATOR_CATEGORIES = [
  { id: "fitness",    label: "Fitness & Health",   emoji: "💪" },
  { id: "music",      label: "Music & Audio",       emoji: "🎵" },
  { id: "art",        label: "Art & Illustration",  emoji: "🎨" },
  { id: "photography",label: "Photography",          emoji: "📷" },
  { id: "gaming",     label: "Gaming",               emoji: "🎮" },
  { id: "cooking",    label: "Cooking & Food",       emoji: "🍳" },
  { id: "comedy",     label: "Comedy",               emoji: "😂" },
  { id: "fashion",    label: "Fashion & Style",      emoji: "👗" },
  { id: "writing",    label: "Writing & Stories",    emoji: "✍️" },
  { id: "finance",    label: "Finance & Business",   emoji: "💰" },
  { id: "beauty",     label: "Beauty & Makeup",      emoji: "💄" },
  { id: "sports",     label: "Sports",               emoji: "⚽" },
  { id: "tech",       label: "Tech & Science",       emoji: "💻" },
  { id: "lifestyle",  label: "Lifestyle",            emoji: "✨" },
  { id: "travel",     label: "Travel",               emoji: "✈️" },
  { id: "podcasting", label: "Podcasting",           emoji: "🎙️" },
  { id: "education",  label: "Education",            emoji: "📚" },
  { id: "wellness",   label: "Wellness & Mindset",   emoji: "🧘" },
  { id: "diy",        label: "DIY & Crafts",         emoji: "🔨" },
  { id: "services",   label: "Services & Bookings",  emoji: "📅" },
  { id: "adult",      label: "Adult Content",        emoji: "🔞" },
] as const;

export type CategoryId = typeof CREATOR_CATEGORIES[number]["id"];

export function getCategoryLabel(id: string): string {
  return CREATOR_CATEGORIES.find(c => c.id === id)?.label ?? id;
}

export function getCategoryEmoji(id: string): string {
  return CREATOR_CATEGORIES.find(c => c.id === id)?.emoji ?? "✦";
}
