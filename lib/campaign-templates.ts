// ──────────────────────────────────────────────────────────────────
// Campaign templates — the guided-builder brain.
// One source of truth for: what a creator can raise money for, the five
// pre-built tiers each category ships with, the plain-language meaning of
// every reward type, and the category-aware reward suggestions the builder
// offers as one-tap chips. The goal: pick a category, get a complete,
// good-quality campaign in seconds, and learn what a good campaign looks
// like by seeing one.
//
// Copy rule: no em-dashes or hyphens anywhere in creator-facing strings.
// ──────────────────────────────────────────────────────────────────
import type { RewardType, TierReward } from "@/lib/campaign-rewards";

// Plain-language definition of each reward type, shown as helper text in the
// builder so the typed menu is never a mystery.
export const REWARD_EXPLAIN: Record<RewardType, string> = {
  update: "Exclusive campaign updates only your backers see.",
  recognition: "Public acknowledgment and supporter status.",
  content: "Exclusive posts, photos, videos, journals, or livestreams.",
  physical: "A real item you will ship or provide.",
  discount: "A coupon code for products, merch, or services.",
};

export interface TemplateTier {
  amount: number;
  title: string;
  description: string;
  rewards: TierReward[];
}

export interface CampaignCategory {
  id: string;
  label: string;
  emoji: string;
  // A short prompt of what this kind of campaign is, shown under the label.
  blurb: string;
  // Suggested funding goal, a sensible starting number the creator can change.
  goal: number;
  // A ready title and description so the page is never blank.
  titleIdea: string;
  descriptionIdea: string;
  // Five pre-built tiers, lowest to highest.
  tiers: TemplateTier[];
  // Category-aware reward ideas, offered as one-tap chips, grouped by type
  // in the UI via REWARD_TYPES order.
  rewardSuggestions: TierReward[];
}

const r = (type: RewardType, label: string): TierReward => ({ type, label });

export const CAMPAIGN_CATEGORIES: CampaignCategory[] = [
  {
    id: "travel",
    label: "Travel / Adventure",
    emoji: "✈️",
    blurb: "A trip, a tour, an adventure you want your people along for.",
    goal: 3500,
    titleIdea: "Chasing the road",
    descriptionIdea: "I am heading out on a trip I have been dreaming about, and I want to bring you with me the whole way.",
    tiers: [
      { amount: 10, title: "Postcard Crew", description: "You are on the journey with me from day one.", rewards: [r("update", "Backer updates from the road"), r("recognition", "Name on the supporter wall")] },
      { amount: 25, title: "Travel Companion", description: "You see the trip the way I see it.", rewards: [r("update", "Backer updates from the road"), r("recognition", "Name on the supporter wall"), r("content", "Behind the scenes photos")] },
      { amount: 50, title: "Front Row Traveler", description: "The full, unfiltered travel story.", rewards: [r("update", "Backer updates from the road"), r("content", "Behind the scenes photos"), r("content", "Exclusive travel journal")] },
      { amount: 100, title: "Trailblazer", description: "You helped make the whole trip happen.", rewards: [r("recognition", "Founding backer status"), r("content", "Exclusive travel journal"), r("content", "Live streams from the road")] },
      { amount: 250, title: "Expedition Patron", description: "The closest seat to the adventure.", rewards: [r("recognition", "Founding backer status"), r("content", "Live streams from the road"), r("physical", "A postcard mailed to you")] },
    ],
    rewardSuggestions: [
      r("update", "Backer updates from the road"),
      r("recognition", "Name on the supporter wall"),
      r("recognition", "Founding backer status"),
      r("content", "Behind the scenes photos"),
      r("content", "Exclusive travel journal"),
      r("content", "Live streams from the road"),
      r("physical", "A postcard mailed to you"),
      r("physical", "A small souvenir from the trip"),
    ],
  },
  {
    id: "music",
    label: "Concert or Festival",
    emoji: "🎵",
    blurb: "A show, a tour, a festival run, or a live music moment.",
    goal: 5000,
    titleIdea: "Take the stage",
    descriptionIdea: "I am putting everything into this run of shows, and I want you in the room with me for all of it.",
    tiers: [
      { amount: 10, title: "Soundcheck", description: "You are in before the doors open.", rewards: [r("update", "Backer updates from the tour"), r("recognition", "Name on the supporter wall")] },
      { amount: 25, title: "General Admission", description: "The show, the way fans wish they could see it.", rewards: [r("update", "Backer updates from the tour"), r("content", "Concert coverage and clips")] },
      { amount: 50, title: "Backstage", description: "Everything fans never get to see.", rewards: [r("content", "Concert coverage and clips"), r("content", "Behind the scenes from rehearsals"), r("content", "Early access to new songs")] },
      { amount: 100, title: "Front Row", description: "You helped put me on that stage.", rewards: [r("recognition", "Founding backer status"), r("content", "Early access to new songs"), r("physical", "A signed poster")] },
      { amount: 250, title: "Headliner Patron", description: "The biggest seat in the house.", rewards: [r("recognition", "Founding backer status"), r("physical", "A signed poster"), r("discount", "Merch discount for a year")] },
    ],
    rewardSuggestions: [
      r("update", "Backer updates from the tour"),
      r("recognition", "Name on the supporter wall"),
      r("recognition", "Founding backer status"),
      r("content", "Concert coverage and clips"),
      r("content", "Behind the scenes from rehearsals"),
      r("content", "Early access to new songs"),
      r("physical", "A signed poster"),
      r("discount", "Merch discount for a year"),
    ],
  },
  {
    id: "creative",
    label: "Creative Project",
    emoji: "🎨",
    blurb: "A film, a book, a game, an album, a body of work you are making.",
    goal: 4000,
    titleIdea: "Make the thing",
    descriptionIdea: "I am finally building the project I have been planning for a long time, and your support is what gets it made.",
    tiers: [
      { amount: 10, title: "Believer", description: "You believed in this before it existed.", rewards: [r("update", "Backer updates as it comes together"), r("recognition", "Name in the credits")] },
      { amount: 25, title: "Insider", description: "You see how the work actually gets made.", rewards: [r("update", "Backer updates as it comes together"), r("content", "Process posts and work in progress")] },
      { amount: 50, title: "Collaborator", description: "The full making of, start to finish.", rewards: [r("content", "Process posts and work in progress"), r("content", "Exclusive behind the work content"), r("content", "Early look at the finished piece")] },
      { amount: 100, title: "Producer", description: "You helped fund the work itself.", rewards: [r("recognition", "Founding backer status"), r("content", "Early look at the finished piece"), r("physical", "A copy of the finished work")] },
      { amount: 250, title: "Patron", description: "Named alongside the work, always.", rewards: [r("recognition", "Founding backer status"), r("physical", "A copy of the finished work"), r("recognition", "Special thanks in every release")] },
    ],
    rewardSuggestions: [
      r("update", "Backer updates as it comes together"),
      r("recognition", "Name in the credits"),
      r("recognition", "Founding backer status"),
      r("content", "Process posts and work in progress"),
      r("content", "Early look at the finished piece"),
      r("physical", "A copy of the finished work"),
      r("discount", "Discount on future work"),
    ],
  },
  {
    id: "art-supplies",
    label: "Art Supplies",
    emoji: "🖌️",
    blurb: "The materials, the tools, the stock you need to keep creating.",
    goal: 1200,
    titleIdea: "Stock the studio",
    descriptionIdea: "I want to keep making work without running out of the materials it takes, and you help me keep the studio full.",
    tiers: [
      { amount: 10, title: "Sketch Crew", description: "You keep the pencils moving.", rewards: [r("update", "Backer updates from the studio"), r("recognition", "Name on the supporter wall")] },
      { amount: 25, title: "Studio Friend", description: "You see what the new supplies become.", rewards: [r("update", "Backer updates from the studio"), r("content", "Work in progress photos")] },
      { amount: 50, title: "Patron of the Palette", description: "Closer to the work than anyone.", rewards: [r("content", "Work in progress photos"), r("content", "Studio process videos"), r("recognition", "Founding backer status")] },
      { amount: 100, title: "Collector", description: "You helped restock the whole studio.", rewards: [r("recognition", "Founding backer status"), r("content", "Studio process videos"), r("physical", "A small original piece")] },
      { amount: 250, title: "Benefactor", description: "The studio runs because of you.", rewards: [r("physical", "A small original piece"), r("discount", "Discount on commissions"), r("recognition", "Named patron of the studio")] },
    ],
    rewardSuggestions: [
      r("update", "Backer updates from the studio"),
      r("recognition", "Name on the supporter wall"),
      r("content", "Work in progress photos"),
      r("content", "Studio process videos"),
      r("physical", "A small original piece"),
      r("discount", "Discount on commissions"),
    ],
  },
  {
    id: "classroom",
    label: "Classroom / Teacher",
    emoji: "🍎",
    blurb: "Supplies, a project, or an experience for your students.",
    goal: 1500,
    titleIdea: "For my classroom",
    descriptionIdea: "My students deserve more than the budget allows, and your support goes straight to what they need to learn and thrive.",
    tiers: [
      { amount: 10, title: "Classroom Friend", description: "You help fill the supply shelf.", rewards: [r("update", "Updates on how it helps the class"), r("recognition", "Name on the supporter wall")] },
      { amount: 25, title: "Helping Hand", description: "You see the difference it makes.", rewards: [r("update", "Updates on how it helps the class"), r("content", "Photos from the classroom")] },
      { amount: 50, title: "Mentor", description: "Part of the classroom story.", rewards: [r("content", "Photos from the classroom"), r("content", "A thank you from the students"), r("recognition", "Founding supporter status")] },
      { amount: 100, title: "Champion", description: "You funded a real project for the kids.", rewards: [r("recognition", "Founding supporter status"), r("content", "A thank you from the students"), r("recognition", "Named on the classroom wall")] },
      { amount: 250, title: "Patron of Learning", description: "A lasting part of this classroom.", rewards: [r("recognition", "Named on the classroom wall"), r("content", "End of year recap from the class")] },
    ],
    rewardSuggestions: [
      r("update", "Updates on how it helps the class"),
      r("recognition", "Name on the supporter wall"),
      r("content", "Photos from the classroom"),
      r("content", "A thank you from the students"),
      r("recognition", "Named on the classroom wall"),
    ],
  },
  {
    id: "equipment",
    label: "New Equipment",
    emoji: "🎬",
    blurb: "Gear, a camera, an instrument, a rig that levels up your work.",
    goal: 2500,
    titleIdea: "Level up the setup",
    descriptionIdea: "The right gear changes what I can make for you, and your support is what puts it in my hands.",
    tiers: [
      { amount: 10, title: "Early Supporter", description: "You backed the upgrade first.", rewards: [r("update", "Updates as the new gear arrives"), r("recognition", "Name on the supporter wall")] },
      { amount: 25, title: "Upgrade Crew", description: "You see what the new gear unlocks.", rewards: [r("update", "Updates as the new gear arrives"), r("content", "First content made with the new gear")] },
      { amount: 50, title: "Power User", description: "Behind the scenes of the new setup.", rewards: [r("content", "First content made with the new gear"), r("content", "Behind the scenes of the setup"), r("recognition", "Founding backer status")] },
      { amount: 100, title: "Co-Producer", description: "You helped buy the gear itself.", rewards: [r("recognition", "Founding backer status"), r("content", "Behind the scenes of the setup"), r("content", "Early access to everything I make next")] },
      { amount: 250, title: "Studio Patron", description: "Named on everything the gear creates.", rewards: [r("content", "Early access to everything I make next"), r("recognition", "Special thanks in future work")] },
    ],
    rewardSuggestions: [
      r("update", "Updates as the new gear arrives"),
      r("recognition", "Name on the supporter wall"),
      r("content", "First content made with the new gear"),
      r("content", "Behind the scenes of the setup"),
      r("content", "Early access to everything I make next"),
    ],
  },
  {
    id: "medical",
    label: "Medical / Life Event",
    emoji: "❤️",
    blurb: "A health journey or a life event where your community can help.",
    goal: 6000,
    titleIdea: "Through this together",
    descriptionIdea: "I am going through something big, and the people who follow my work have always felt like family. Your support means more than I can say.",
    tiers: [
      { amount: 10, title: "By My Side", description: "You are here for the journey.", rewards: [r("update", "Honest updates along the way"), r("recognition", "Name on the supporter wall")] },
      { amount: 25, title: "In My Corner", description: "Close to the real story.", rewards: [r("update", "Honest updates along the way"), r("recognition", "Heartfelt thank you")] },
      { amount: 50, title: "Lifeline", description: "Part of the support that carries me.", rewards: [r("update", "Honest updates along the way"), r("recognition", "Heartfelt thank you"), r("recognition", "Founding supporter status")] },
      { amount: 100, title: "Guardian", description: "You helped lift a real weight.", rewards: [r("recognition", "Founding supporter status"), r("recognition", "A personal note from me")] },
      { amount: 250, title: "Angel", description: "I will never forget this.", rewards: [r("recognition", "A personal note from me"), r("update", "First to hear the good news")] },
    ],
    rewardSuggestions: [
      r("update", "Honest updates along the way"),
      r("recognition", "Name on the supporter wall"),
      r("recognition", "Heartfelt thank you"),
      r("recognition", "A personal note from me"),
    ],
  },
  {
    id: "moving",
    label: "Moving / Relocation",
    emoji: "📦",
    blurb: "A move, a relocation, a fresh start in a new place.",
    goal: 3000,
    titleIdea: "The next chapter",
    descriptionIdea: "I am moving toward something new, and your support helps me land on my feet and keep creating from the next place.",
    tiers: [
      { amount: 10, title: "Send Off Crew", description: "You are part of the send off.", rewards: [r("update", "Updates through the move"), r("recognition", "Name on the supporter wall")] },
      { amount: 25, title: "Moving Companion", description: "You follow the whole transition.", rewards: [r("update", "Updates through the move"), r("content", "The story of the move")] },
      { amount: 50, title: "New Beginnings", description: "Close to the fresh start.", rewards: [r("content", "The story of the move"), r("content", "First look at the new place"), r("recognition", "Founding supporter status")] },
      { amount: 100, title: "Foundation", description: "You helped me get settled.", rewards: [r("recognition", "Founding supporter status"), r("content", "First look at the new place")] },
      { amount: 250, title: "Cornerstone", description: "A part of the next chapter.", rewards: [r("recognition", "Named in the next chapter"), r("content", "First content from the new home")] },
    ],
    rewardSuggestions: [
      r("update", "Updates through the move"),
      r("recognition", "Name on the supporter wall"),
      r("content", "The story of the move"),
      r("content", "First look at the new place"),
    ],
  },
  {
    id: "education",
    label: "Education",
    emoji: "🎓",
    blurb: "A course, a degree, a certification, learning that moves you forward.",
    goal: 4000,
    titleIdea: "Invest in what is next",
    descriptionIdea: "I am putting in the work to learn something that will change what I can do, and your support helps me get there.",
    tiers: [
      { amount: 10, title: "Study Group", description: "You are part of the journey.", rewards: [r("update", "Updates as I learn"), r("recognition", "Name on the supporter wall")] },
      { amount: 25, title: "Classmate", description: "You see what I am learning.", rewards: [r("update", "Updates as I learn"), r("content", "What I am learning, shared with you")] },
      { amount: 50, title: "Tutor's Circle", description: "The full learning story.", rewards: [r("content", "What I am learning, shared with you"), r("content", "Early access to what I create from it"), r("recognition", "Founding supporter status")] },
      { amount: 100, title: "Scholar's Patron", description: "You helped fund the path itself.", rewards: [r("recognition", "Founding supporter status"), r("content", "Early access to what I create from it")] },
      { amount: 250, title: "Benefactor", description: "Named in the work this makes possible.", rewards: [r("recognition", "Special thanks in future work"), r("content", "First to see what I build with it")] },
    ],
    rewardSuggestions: [
      r("update", "Updates as I learn"),
      r("recognition", "Name on the supporter wall"),
      r("content", "What I am learning, shared with you"),
      r("content", "Early access to what I create from it"),
    ],
  },
  {
    id: "other",
    label: "Other",
    emoji: "⭐",
    blurb: "Something else entirely. Start from a flexible set of tiers.",
    goal: 2500,
    titleIdea: "Back the next thing",
    descriptionIdea: "I am raising money for something that matters to me, and I want my community to be part of it.",
    tiers: [
      { amount: 10, title: "Supporter", description: "You are in from the start.", rewards: [r("update", "Backer updates"), r("recognition", "Name on the supporter wall")] },
      { amount: 25, title: "Insider", description: "You get the closer view.", rewards: [r("update", "Backer updates"), r("content", "Exclusive behind the scenes content")] },
      { amount: 50, title: "Backer", description: "The full story, up close.", rewards: [r("content", "Exclusive behind the scenes content"), r("content", "Early access content"), r("recognition", "Founding backer status")] },
      { amount: 100, title: "Champion", description: "You helped make it happen.", rewards: [r("recognition", "Founding backer status"), r("content", "Early access content")] },
      { amount: 250, title: "Patron", description: "The closest seat there is.", rewards: [r("recognition", "Special thanks"), r("content", "First access to everything")] },
    ],
    rewardSuggestions: [
      r("update", "Backer updates"),
      r("recognition", "Name on the supporter wall"),
      r("recognition", "Founding backer status"),
      r("content", "Exclusive behind the scenes content"),
      r("content", "Early access content"),
      r("physical", "A thank you gift"),
      r("discount", "A discount code"),
    ],
  },
];

export function categoryById(id: string | null | undefined): CampaignCategory | null {
  if (!id) return null;
  return CAMPAIGN_CATEGORIES.find((c) => c.id === id) ?? null;
}

// Reward suggestions for a category, falling back to the flexible "other" set
// so the per-campaign tier builder always has something useful to offer.
export function suggestionsFor(id: string | null | undefined): TierReward[] {
  return (categoryById(id) ?? categoryById("other"))!.rewardSuggestions;
}
