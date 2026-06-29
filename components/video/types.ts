// The single source of truth for a video. Everything is data: change this
// (or a JSON file passed via --props) and you get a different video, no code edits.

export interface Membership {
  name: string;
  price: string;        // already formatted, e.g. "$15"
  cadence?: string;     // "mo" | "yr" (default "mo")
  perks?: string[];
  featured?: boolean;
}

export interface CampaignData {
  title: string;
  raised: string;       // formatted, e.g. "$1,500"
  goal: string;         // formatted, e.g. "$2,000"
  pct: number;          // 0..100, drives the animated progress bar
  backers?: number;
}

export interface ShopItem {
  title: string;
  price: string;        // formatted
  image?: string;       // path under public/ (optional; falls back to a branded tile)
}

export interface MerchItem {
  name: string;
  price: string;        // formatted
  image?: string;
}

export type VideoType =
  | "launch"
  | "campaign"
  | "membership"
  | "marketplace"
  | "merch"
  | "storyTime"
  | "behindScenes"
  | "dayInLife"
  | "whyJoin"
  | "supportMe"
  | "weeklyHighlight"
  | "struggle"
  | "breakthrough"
  | "lesson"
  | "normalDay"
  | "challenge"
  | "customerStory"
  | "milestone"
  | "productLaunch"
  | "reflection"
  | "supporterStory"
  | "businessUpdate";

export type Personality =
  | "optimistic"
  | "funny"
  | "direct"
  | "educational"
  | "inspirational"
  | "reflective"
  | "calm"
  | "energetic";

export interface MediaAnalysis {
  url?: string;                  // raw media url (reference key)
  primary_category?: string;     // e.g. "trailer repairs"
  secondary_categories?: string[];
  emotional_tone?: string;       // e.g. "hard_work", "proud", "stress"
  story_beats?: string[];        // beats this image fits: problem, work, result, ...
  visual_summary?: string;
  recommended_use?: string;
  confidence_score?: number;     // 0..1
}

export interface BeatTimeline {
  bpm: number;
  beatFrames: number[];
  downbeatFrames: number[];
  phraseFrames: number[];
  energy: number[];
  energyHopFrames: number;
  endFrame: number;
  durationFrames: number;
}

export type VideoData = {
  creator: {
    name: string;
    handle: string;     // include the @ if you want it shown
    avatar?: string;
    cover?: string;     // cover_url banner, shown behind the profile header
    tagline?: string;
    founding?: boolean;
  };
  intro: {
    headline: string;
    kicker?: string;
  };
  cta: {
    headline: string;
    sub?: string;
    url?: string;
  };

  // Screenshots (paths under public/). Any scene whose data is absent is skipped,
  // and the total runtime shrinks automatically.
  profileScreenshot?: string;
  feedScreenshots?: string[];
  // Music beat timeline, attached by the render service when sync-to-music is on.
  // Drives scene cut points and motion. Absent in studio preview (analysis happens at
  // render time), so preview uses fixed timing and the final render is beat-synced.
  beats?: BeatTimeline;
  // Per-image narrative analysis, aligned by index to feedScreenshots. null where an
  // image has not been analyzed yet. Used by the Story Engine to match image to beat.
  mediaAnalysis?: (MediaAnalysis | null)[];
  campaignScreenshot?: string;
  marketplaceScreenshot?: string;
  merchScreenshot?: string;

  // Structured data renders crisp native animated cards (preferred over screenshots).
  memberships?: Membership[];
  campaign?: CampaignData;
  marketplace?: ShopItem[];
  merch?: MerchItem[];

  music?: string;       // path under public/
  musicVolume?: number; // 0..1, default 0.6
  bgIntensity?: number; // 0..1, how strongly the cover shows as the background (0 = plain stage)
  narration?: string;   // url of a single voiceover track, baked in by the render service
  narrationDurationInFrames?: number; // length of that track, used to fit the video to the voice
  // Per-scene voiceover: each scene holds exactly as long as its own line, and that
  // line's audio plays during it. Keyed by scene id. Built by the render service.
  narrationByScene?: Record<string, {src: string; frames: number}>;
  // Per-scene word-timed captions (frames relative to the scene start), for the
  // synced on-screen text. Built by the render service from ElevenLabs timestamps.
  captionsByScene?: Record<string, {words: {text: string; from: number; to: number}[]}>;
  hookText?: string;     // the opening hook line, shown on screen and spoken first
  goal?: 'subs' | 'platform'; // 'subs' = win the creator subscribers (fan-facing),
                              // 'platform' = bring creators to Spotlightly
  offer?: string;        // optional incentive shown on the closing card (e.g. "First week free")
  personality?: Personality; // the creator's persistent voice, flavors story narration
  videoType?: VideoType; // which scene set to show (default "launch" = all)
};
