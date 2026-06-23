// ──────────────────────────────────────────────────────────────────
// Subscription tier templates — the guided builder for recurring tiers.
// A creator picks the kind of work they make and gets a complete three
// tier ladder (entry, middle, top) with names, prices, and perks they
// can edit. The same "see a good one to learn what good looks like"
// idea as the campaign builder, applied to monthly subscriptions.
//
// Copy rule: no em-dashes or hyphens in creator-facing strings.
// ──────────────────────────────────────────────────────────────────

export interface TemplateSubTier {
  name: string;
  price_monthly: number;
  price_yearly: number | null; // null = monthly only
  description: string;
  perks: string[];
}

export interface TierNiche {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  tiers: TemplateSubTier[];
}

// 2 months free is the house default for yearly (monthly x 10).
const yr = (m: number) => Math.round(m * 10 * 100) / 100;
const t = (name: string, m: number, description: string, perks: string[], yearly = true): TemplateSubTier => ({
  name, price_monthly: m, price_yearly: yearly ? yr(m) : null, description, perks,
});

export const TIER_NICHES: TierNiche[] = [
  {
    id: "musician", label: "Musician", emoji: "🎸",
    blurb: "Songs, sets, and the story behind the music.",
    tiers: [
      t("🎧 Fan", 5, "For the people who just want in.", ["Members only updates", "Early demos before anyone else", "Name in the supporter list"]),
      t("🌟 Superfan", 15, "The full studio access pass.", ["Everything in Fan", "Behind the scenes from the studio", "Exclusive acoustic versions", "Monthly members only livestream"]),
      t("🎤 Backstage", 50, "As close to the music as it gets.", ["Everything in Superfan", "First listen to every new song", "A monthly video shout out", "Vote on what I record next"]),
    ],
  },
  {
    id: "artist", label: "Visual Artist", emoji: "🎨",
    blurb: "Illustration, painting, design, the work and the process.",
    tiers: [
      t("✏️ Sketchbook", 5, "A look inside the sketchbook.", ["Members only updates", "Work in progress shots", "Name in the supporter list"]),
      t("🎨 Studio", 15, "How the work actually gets made.", ["Everything in Sketchbook", "Full process videos", "High resolution downloads", "Monthly wallpaper pack"]),
      t("🖼️ Patron", 50, "The closest seat to the easel.", ["Everything in Studio", "Monthly mini commission slot", "Early access to print drops", "Vote on what I make next"]),
    ],
  },
  {
    id: "fitness", label: "Fitness / Wellness", emoji: "💪",
    blurb: "Training, routines, and the journey alongside you.",
    tiers: [
      t("🔥 Warmup", 8, "Get moving with me.", ["Members only updates", "Weekly workout of the week", "Form tips and check ins"]),
      t("💪 In Training", 20, "The full program.", ["Everything in Warmup", "Full workout library", "Meal and recovery guides", "Monthly members only live session"]),
      t("🏆 Inner Circle", 60, "Coaching level access.", ["Everything in In Training", "Monthly personal check in", "Custom plan adjustments", "Priority answers to your questions"]),
    ],
  },
  {
    id: "writer", label: "Writer / Podcaster", emoji: "🎙️",
    blurb: "Essays, stories, episodes, and the conversation around them.",
    tiers: [
      t("📖 Reader", 5, "For people who want more.", ["Members only posts", "Early access to new pieces", "Name in the supporter list"]),
      t("✍️ Member", 12, "The full archive and then some.", ["Everything in Reader", "Full back catalog", "Bonus episodes and outtakes", "Monthly members only thread"]),
      t("🎙️ Inner Circle", 35, "A seat at the table.", ["Everything in Member", "Ad free everything", "Monthly live Q and A", "Vote on future topics"]),
    ],
  },
  {
    id: "educator", label: "Educator / Coach", emoji: "📚",
    blurb: "Lessons, tutorials, and guidance for people learning from you.",
    tiers: [
      t("📓 Student", 8, "Keep learning with me.", ["Members only lessons", "Downloadable resources", "Community access"]),
      t("📚 Apprentice", 25, "The full curriculum.", ["Everything in Student", "Full course library", "Monthly group office hours", "Templates and worksheets"]),
      t("🎓 Mentee", 75, "Direct guidance.", ["Everything in Apprentice", "Monthly one on one call", "Personal feedback on your work", "Priority answers"]),
    ],
  },
  {
    id: "streamer", label: "Gamer / Streamer", emoji: "🎮",
    blurb: "Streams, clips, and the community around your channel.",
    tiers: [
      t("🎮 Member", 5, "Join the squad.", ["Members only chat", "Sub badge and emotes", "Name in the supporter list"]),
      t("⭐ VIP", 12, "Front of the line.", ["Everything in Member", "Priority in viewer games", "Members only streams", "Behind the scenes clips"]),
      t("👑 Legend", 40, "Top of the leaderboard.", ["Everything in VIP", "Monthly play session with me", "Your name in the credits", "Vote on what I play next"]),
    ],
  },
  {
    id: "lifestyle", label: "Lifestyle / Vlogger", emoji: "📸",
    blurb: "Daily life, vlogs, and the moments that do not make the main feed.",
    tiers: [
      t("📸 Insider", 6, "See the real day to day.", ["Members only posts", "Unfiltered photo dumps", "Name in the supporter list"]),
      t("💛 Close Friend", 18, "The close friends list.", ["Everything in Insider", "Behind the scenes vlogs", "Monthly members only livestream", "Early access to everything"]),
      t("🌟 Inner Circle", 45, "The closest circle.", ["Everything in Close Friend", "Monthly personal video update", "Direct requests for content", "First to see everything"]),
    ],
  },
  {
    id: "general", label: "General", emoji: "⭐",
    blurb: "A flexible three tier ladder that works for any creator.",
    tiers: [
      t("⭐ Supporter", 5, "For people who want to support the work.", ["Members only updates", "Early access content", "Name in the supporter list"]),
      t("🌟 Superfan", 15, "The full members experience.", ["Everything in Supporter", "Exclusive behind the scenes content", "Monthly members only livestream", "Priority replies"]),
      t("👑 VIP", 40, "The closest access there is.", ["Everything in Superfan", "Monthly personal shout out", "A say in what I make next", "First access to everything"]),
    ],
  },
];

export function tierNicheById(id: string | null | undefined): TierNiche | null {
  if (!id) return null;
  return TIER_NICHES.find((n) => n.id === id) ?? null;
}
