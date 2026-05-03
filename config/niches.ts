export type CreatorType = "sfw" | "adult" | "young";

export interface Niche {
  id: string;
  label: string;
  emoji: string;
  creator_type: CreatorType;
  keywords: string[];
  default_rating: "G" | "PG" | "M" | "R" | "X";
}

export const NICHES: Niche[] = [
  // Beauty & Style
  { id: "hair", label: "Hair Stylist", emoji: "💇", creator_type: "sfw", default_rating: "G", keywords: ["hair", "hairstylist", "stylist", "color", "colorist", "barber", "haircut", "blowout", "extensions"] },
  { id: "makeup", label: "Makeup Artist", emoji: "💄", creator_type: "sfw", default_rating: "G", keywords: ["makeup", "mua", "beauty", "cosmetics", "lashes", "brows"] },
  { id: "nails", label: "Nail Artist", emoji: "💅", creator_type: "sfw", default_rating: "G", keywords: ["nails", "manicure", "nail tech", "gel", "acrylic"] },
  { id: "tattoo", label: "Tattoo Artist", emoji: "🖋️", creator_type: "sfw", default_rating: "M", keywords: ["tattoo", "tattoos", "ink", "tattoo artist"] },
  { id: "piercing", label: "Piercer", emoji: "💎", creator_type: "sfw", default_rating: "M", keywords: ["piercing", "piercer", "body mod"] },
  { id: "fashion", label: "Fashion / Style", emoji: "👗", creator_type: "sfw", default_rating: "G", keywords: ["fashion", "outfit", "style", "ootd", "thrift", "modeling"] },

  // Fitness & Wellness
  { id: "fitness", label: "Fitness Coach", emoji: "💪", creator_type: "sfw", default_rating: "G", keywords: ["fitness", "trainer", "personal trainer", "workout", "lifting", "bodybuilding", "crossfit"] },
  { id: "yoga", label: "Yoga Instructor", emoji: "🧘", creator_type: "sfw", default_rating: "G", keywords: ["yoga", "yogi", "meditation", "pilates"] },
  { id: "running", label: "Runner / Endurance", emoji: "🏃", creator_type: "sfw", default_rating: "G", keywords: ["running", "runner", "marathon", "endurance", "cycling", "triathlon"] },
  { id: "wellness", label: "Wellness / Holistic", emoji: "🌿", creator_type: "sfw", default_rating: "G", keywords: ["wellness", "holistic", "herbalist", "mindfulness", "breathwork"] },
  { id: "nutrition", label: "Nutrition / Diet", emoji: "🥗", creator_type: "sfw", default_rating: "G", keywords: ["nutrition", "nutritionist", "diet", "macros", "meal plan"] },

  // Food & Drink
  { id: "chef", label: "Chef / Cook", emoji: "👨‍🍳", creator_type: "sfw", default_rating: "G", keywords: ["chef", "cook", "cooking", "recipe", "recipes", "home cook", "kitchen"] },
  { id: "baker", label: "Baker / Pastry", emoji: "🍰", creator_type: "sfw", default_rating: "G", keywords: ["baker", "baking", "bake", "pastry", "cake", "bread", "sourdough"] },
  { id: "bartender", label: "Bartender / Mixologist", emoji: "🍹", creator_type: "sfw", default_rating: "PG", keywords: ["bartender", "bartending", "mixology", "mixologist", "cocktails", "cocktail"] },
  { id: "barista", label: "Barista / Coffee", emoji: "☕", creator_type: "sfw", default_rating: "G", keywords: ["barista", "coffee", "espresso", "latte art"] },

  // Music & Performance
  { id: "musician", label: "Musician", emoji: "🎵", creator_type: "sfw", default_rating: "PG", keywords: ["musician", "music", "singer", "songwriter", "guitarist", "drummer", "producer", "rapper", "vocalist"] },
  { id: "dj", label: "DJ", emoji: "🎧", creator_type: "sfw", default_rating: "PG", keywords: ["dj", "deejay", "turntable", "mixing"] },
  { id: "dancer", label: "Dancer", emoji: "💃", creator_type: "sfw", default_rating: "PG", keywords: ["dance", "dancer", "choreographer", "ballet", "hip hop dance", "salsa"] },
  { id: "comedian", label: "Comedian", emoji: "🎤", creator_type: "sfw", default_rating: "M", keywords: ["comedian", "comedy", "standup", "stand-up", "improv"] },
  { id: "actor", label: "Actor / Performer", emoji: "🎭", creator_type: "sfw", default_rating: "PG", keywords: ["actor", "actress", "acting", "theater", "voice acting"] },

  // Visual & Creative
  { id: "photographer", label: "Photographer", emoji: "📸", creator_type: "sfw", default_rating: "PG", keywords: ["photographer", "photography", "photo", "portrait", "wedding photographer"] },
  { id: "videographer", label: "Videographer / Filmmaker", emoji: "🎬", creator_type: "sfw", default_rating: "PG", keywords: ["videographer", "filmmaker", "filmmaking", "cinematographer", "video"] },
  { id: "artist", label: "Visual Artist", emoji: "🎨", creator_type: "sfw", default_rating: "PG", keywords: ["artist", "painter", "painting", "illustrator", "illustration", "drawing", "sculptor"] },
  { id: "designer", label: "Designer", emoji: "✏️", creator_type: "sfw", default_rating: "G", keywords: ["designer", "graphic design", "ui designer", "ux", "product designer", "interior designer"] },
  { id: "writer", label: "Writer / Author", emoji: "✍️", creator_type: "sfw", default_rating: "PG", keywords: ["writer", "author", "novelist", "poet", "screenwriter", "journalist", "blogger"] },

  // Skilled Trades & Craft
  { id: "woodworker", label: "Woodworker / Maker", emoji: "🪵", creator_type: "sfw", default_rating: "G", keywords: ["woodworker", "woodworking", "carpenter", "maker", "craftsman", "furniture"] },
  { id: "metalworker", label: "Metalworker / Welder", emoji: "🔧", creator_type: "sfw", default_rating: "PG", keywords: ["welder", "welding", "metalwork", "blacksmith", "fabricator"] },
  { id: "mechanic", label: "Mechanic / Auto", emoji: "🔩", creator_type: "sfw", default_rating: "PG", keywords: ["mechanic", "auto", "cars", "automotive", "car detailing"] },
  { id: "builder", label: "Contractor / Builder", emoji: "🏗️", creator_type: "sfw", default_rating: "PG", keywords: ["contractor", "builder", "construction", "remodel", "renovation"] },

  // Outdoors & Lifestyle
  { id: "outdoor", label: "Outdoor / Adventure", emoji: "🏔️", creator_type: "sfw", default_rating: "PG", keywords: ["outdoor", "hiking", "climbing", "skiing", "snowboarding", "surfing", "kayak", "camping"] },
  { id: "fishing", label: "Fishing / Hunting", emoji: "🎣", creator_type: "sfw", default_rating: "PG", keywords: ["fishing", "fisherman", "angler", "hunting", "hunter"] },
  { id: "gardening", label: "Gardener / Plant", emoji: "🌱", creator_type: "sfw", default_rating: "G", keywords: ["gardening", "gardener", "plants", "homestead", "permaculture", "farming"] },
  { id: "pets", label: "Pet / Animal", emoji: "🐕", creator_type: "sfw", default_rating: "G", keywords: ["pet", "dog", "cat", "dog trainer", "animal", "horse", "equestrian"] },
  { id: "travel", label: "Travel", emoji: "✈️", creator_type: "sfw", default_rating: "PG", keywords: ["travel", "traveler", "nomad", "backpacker", "vanlife"] },

  // Education & Knowledge
  { id: "educator", label: "Teacher / Educator", emoji: "📚", creator_type: "sfw", default_rating: "G", keywords: ["teacher", "educator", "tutor", "professor", "language teacher"] },
  { id: "coach", label: "Life / Career Coach", emoji: "🌟", creator_type: "sfw", default_rating: "G", keywords: ["coach", "life coach", "career coach", "executive coach"] },
  { id: "business", label: "Business / Entrepreneur", emoji: "💼", creator_type: "sfw", default_rating: "G", keywords: ["entrepreneur", "founder", "business", "startup", "marketing", "consulting"] },
  { id: "finance", label: "Finance / Investing", emoji: "📈", creator_type: "sfw", default_rating: "PG", keywords: ["finance", "investing", "stocks", "crypto", "real estate", "wealth"] },

  // Tech & Gaming
  { id: "developer", label: "Developer / Programmer", emoji: "💻", creator_type: "sfw", default_rating: "G", keywords: ["developer", "programmer", "coder", "software engineer", "engineer"] },
  { id: "gamer", label: "Gamer / Streamer", emoji: "🎮", creator_type: "sfw", default_rating: "M", keywords: ["gamer", "streamer", "twitch", "gaming", "esports", "speedrun"] },

  // Adult content (own bucket)
  { id: "adult_general", label: "Adult Creator", emoji: "🔞", creator_type: "adult", default_rating: "X", keywords: ["adult", "nsfw", "onlyfans", "explicit", "porn", "fansly", "lewd", "spicy"] },
  { id: "cam", label: "Cam / Live Performer", emoji: "📹", creator_type: "adult", default_rating: "X", keywords: ["camgirl", "camboy", "cam", "camming", "live performer"] },
  { id: "asmr_adult", label: "Adult ASMR", emoji: "👂", creator_type: "adult", default_rating: "X", keywords: ["asmr nsfw", "spicy asmr"] },

  // SFW ASMR / sleep separately
  { id: "asmr", label: "ASMR Creator", emoji: "🌙", creator_type: "sfw", default_rating: "PG", keywords: ["asmr", "sleep", "tingles", "whisper"] },
];

/**
 * Find matching niches by free-text input. Returns top 5 by relevance.
 */
export function findNiches(input: string): Niche[] {
  const q = input.trim().toLowerCase();
  if (q.length < 2) return [];

  const scored = NICHES.map((n) => {
    let score = 0;
    if (n.label.toLowerCase().includes(q)) score += 10;
    if (n.id.toLowerCase().includes(q)) score += 8;
    for (const kw of n.keywords) {
      if (kw === q) score += 15;
      else if (kw.startsWith(q)) score += 6;
      else if (kw.includes(q)) score += 3;
    }
    return { niche: n, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map((s) => s.niche);
}

/**
 * Resolve creator_type from a list of niches. Adult overrides everything.
 */
export function resolveCreatorType(niches: Niche[]): CreatorType {
  if (niches.some((n) => n.creator_type === "adult")) return "adult";
  if (niches.some((n) => n.creator_type === "young")) return "young";
  return "sfw";
}