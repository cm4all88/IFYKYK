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
  | "merch";

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
  videoType?: VideoType; // which scene set to show (default "launch" = all)
};
