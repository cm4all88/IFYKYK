import { VideoData, Personality, MediaAnalysis } from "@/components/video/types";
import { hookFor } from "@/components/video/hooks";
import { beatForScene, isStoryType, STORY_ARCS, type StoryBeat, type SceneId } from "@/components/video/scenes";

const firstName = (n?: string) => (n || "").trim().split(/\s+/)[0] || "this creator";

export const PERSONALITIES: { id: Personality; label: string }[] = [
  { id: "optimistic", label: "Optimistic" },
  { id: "funny", label: "Funny" },
  { id: "direct", label: "Direct" },
  { id: "educational", label: "Educational" },
  { id: "inspirational", label: "Inspirational" },
  { id: "reflective", label: "Reflective" },
  { id: "calm", label: "Calm" },
  { id: "energetic", label: "Energetic" },
];

// Three controlled voices keep quality high: punchy, reflective, warm. Each
// personality maps to one. (Real per-personality phrasing can deepen later.)
type Voice = "punchy" | "reflective" | "warm";
const voiceOf = (p?: Personality): Voice => {
  switch (p) {
    case "direct":
    case "energetic":
      return "punchy";
    case "reflective":
    case "calm":
      return "reflective";
    default:
      return "warm";
  }
};

// Beat narration, written to the role, never naming Spotlightly (the CTA does that).
// {first} is filled with the creator's first name. Gender neutral on purpose.
const BEAT_LINES: Record<StoryBeat, Record<Voice, string>> = {
  hook: { punchy: "", reflective: "", warm: "" }, // hook comes from the hook engine
  cta: { punchy: "", reflective: "", warm: "" }, // cta built separately
  intro: {
    punchy: "Meet {first}.",
    reflective: "This is {first}.",
    warm: "This is {first}.",
  },
  problem: {
    punchy: "Then it nearly fell apart.",
    reflective: "There was a point {first} almost let go.",
    warm: "But it almost slipped away.",
  },
  work: {
    punchy: "So {first} put in the work. No days off.",
    reflective: "Quietly, {first} just kept going.",
    warm: "So {first} kept showing up. Every single day.",
  },
  solution: {
    punchy: "Members are how {first} keeps going.",
    reflective: "And the ones who stayed made it possible.",
    warm: "The people who believe in {first} are how it stays alive.",
  },
  result: {
    punchy: "Now it's finally paying off.",
    reflective: "Looking back, every bit of it mattered.",
    warm: "And slowly, it started to work.",
  },
  question: {
    punchy: "Want to know what it actually takes?",
    reflective: "Ever stop and wonder what's behind it?",
    warm: "Ever wonder what it really takes?",
  },
  answer: {
    punchy: "Here's the part nobody shows you.",
    reflective: "This is the part {first} rarely talks about.",
    warm: "This is the part most people never see.",
  },
  proof: {
    punchy: "The proof is in the work.",
    reflective: "The work speaks for itself.",
    warm: "And the proof is right here.",
  },
  morning: {
    punchy: "Day starts before sunrise. Every time.",
    reflective: "The quiet hours, before anyone's awake.",
    warm: "It starts long before the sun's up.",
  },
  closing: {
    punchy: "The work keeps going after closing.",
    reflective: "Long after everyone leaves, {first} is still there.",
    warm: "And it doesn't stop when the doors close.",
  },
  reflection: {
    punchy: "Not every day is easy.",
    reflective: "Some days {first} wonders if it's worth it.",
    warm: "Some days are harder than they look.",
  },
  community: {
    punchy: "Her people are why {first} keeps going.",
    reflective: "It's the regulars who remind {first} why it started.",
    warm: "But the people who show up make it worth it.",
  },
  milestone: {
    punchy: "{first} is almost there.",
    reflective: "After all of it, {first} is nearly there.",
    warm: "And {first} is closer than ever.",
  },
  update: {
    punchy: "Quick update on where things are.",
    reflective: "A lot has changed lately.",
    warm: "Here's where things stand right now.",
  },
  offer: {
    punchy: "{first} built something for the real ones.",
    reflective: "For the people who've been here, {first} made something.",
    warm: "So {first} made something for the people who care most.",
  },
};

const fill = (s: string, d: VideoData) => s.replace(/\{first\}/g, firstName(d.creator?.name));

const ctaLine = (d: VideoData): string => {
  if ((d.goal ?? "subs") === "platform")
    return `Follow along and get closer than ever. Find ${firstName(d.creator?.name)} on Spotlightly.`;
  return `Become a member and get closer than ever. Find ${firstName(d.creator?.name)} on Spotlightly.`;
};

// The narration line for a scene inside a story type, written to its beat and voiced
// by the creator's personality. Returns "" if there's no line for this scene.
export const storyScriptLine = (type: string, scene: SceneId, d: VideoData): string => {
  if (!isStoryType(type)) return "";
  const beat = beatForScene(type, scene);
  if (!beat) return "";
  if (beat === "hook") return hookFor({ ...d, videoType: type as VideoData["videoType"] });
  if (beat === "cta") return ctaLine(d);
  const line = BEAT_LINES[beat]?.[voiceOf(d.personality)];
  return line ? fill(line, d) : "";
};

// Which emotional tones suit each beat. Used to break ties between images that both
// claim a beat.
const BEAT_TONES: Partial<Record<StoryBeat, string[]>> = {
  problem: ["stress", "frustrated", "tired", "hard_work"],
  work: ["hard_work", "focused", "tired"],
  result: ["proud", "grateful", "joyful", "excited"],
  morning: ["calm", "focused", "tired"],
  closing: ["tired", "calm", "hard_work"],
  reflection: ["calm", "hopeful", "tired", "grateful"],
  community: ["joyful", "grateful", "proud"],
  milestone: ["proud", "excited", "grateful"],
  solution: ["hopeful", "grateful", "proud"],
  proof: ["proud", "focused"],
  offer: ["excited", "proud"],
  update: ["focused", "hopeful"],
  answer: ["hard_work", "focused"],
  intro: ["calm", "hopeful"],
};

const toneBonus = (beat: StoryBeat, tone?: string): number =>
  tone && BEAT_TONES[beat]?.includes(tone) ? 14 : 0;

// Reorders feedScreenshots so the photo scenes (photo1/2/3) get the images that best
// match their story beats, by tags, tone, and confidence, never repeating an image.
// Falls back to the original order when there is no analysis, so it can never break a
// render.
export const assignStoryPhotos = (type: string, d: VideoData): string[] | undefined => {
  const shots = d.feedScreenshots;
  if (!shots || !shots.length || !isStoryType(type)) return shots;
  const analysis = d.mediaAnalysis;
  if (!analysis || analysis.length !== shots.length || !analysis.some(Boolean)) return shots; // fallback: position

  const arc = STORY_ARCS[type];
  const slots: SceneId[] = ["photo1", "photo2", "photo3"];
  const want: Partial<Record<SceneId, StoryBeat>> = {};
  for (const b of arc) if (slots.includes(b.scene)) want[b.scene] = b.beat;

  const used = new Set<number>();
  const pickIdx = (beat: StoryBeat): number => {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < shots.length; i++) {
      if (used.has(i)) continue;
      const a = analysis[i] as MediaAnalysis | null;
      let sc = -1; // unanalyzed images are a last resort
      if (a) {
        sc = 0;
        if (a.story_beats?.includes(beat)) sc += 60;
        sc += toneBonus(beat, a.emotional_tone);
        sc += (a.confidence_score ?? 0.5) * 20;
      }
      if (sc > bestScore) {
        bestScore = sc;
        best = i;
      }
    }
    return best;
  };

  const order: number[] = [];
  for (const sc of slots) {
    const beat = want[sc];
    if (!beat) continue;
    const idx = pickIdx(beat);
    if (idx >= 0) {
      used.add(idx);
      order.push(idx);
    }
  }
  for (let i = 0; i < shots.length; i++) if (!used.has(i)) order.push(i);
  return order.map((i) => shots[i]);
};
