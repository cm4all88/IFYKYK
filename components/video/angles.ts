import { VideoData } from "@/components/video/types";
import { hookFor, type Angle } from "@/components/video/hooks";
import type { SceneId } from "@/components/video/scenes";

const firstName = (n?: string) => (n || "").trim().split(/\s+/)[0] || "this creator";
const handleNoAt = (h?: string) => (h || "").replace(/^@/, "");
const priceNum = (p?: string) => {
  const n = Number(String(p ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const lowPrice = (d: VideoData): number | null => {
  const ns = (d.memberships ?? []).map((m) => priceNum(m.price)).filter((n): n is number => n != null);
  return ns.length ? Math.min(...ns) : null;
};
const fromPrice = (d: VideoData) => {
  const low = lowPrice(d);
  return low != null ? ` From $${low} a month.` : "";
};

export const ANGLE_LABELS: Record<Angle, string> = {
  launch: "Launch reel",
  membership: "Why Join reel",
  campaign: "Support Me reel",
  marketplace: "Marketplace reel",
  merch: "Merch reel",
  storyTime: "Story Time reel",
  behindScenes: "Behind the Scenes reel",
  dayInLife: "Day in the Life reel",
  whyJoin: "Why Join reel",
  supportMe: "Support Me reel",
  weeklyHighlight: "Weekly Highlight reel",
};

type LineFn = (d: VideoData) => string;

// Per-angle overrides for the narrative-bearing scenes only. Scenes not listed fall
// back to the default story lines in the studio. The hook always comes from the hook
// engine. No feature lists, no "subscribe for $5"; every line carries the story.
export const ANGLE_SCRIPTS: Partial<Record<Angle, Partial<Record<SceneId, LineFn>>>> = {
  behindScenes: {
    photo1: () => "The part that happens after the doors close.",
    photo2: () => "The cleanup, the prep, the stuff nobody films.",
    photo3: () => "All of it. Every single day.",
    memberships: (d) => `Her members get to see it.${fromPrice(d)}`,
  },
  dayInLife: {
    photo1: () => "It starts hours before anyone shows up.",
    photo2: () => "And it doesn't stop when they leave.",
    photo3: () => "One full day, start to finish.",
    memberships: (d) => `Members ride along for all of it.${fromPrice(d)}`,
  },
  storyTime: {
    intro: (d) => `Okay, so. This is ${firstName(d.creator.name)}.`,
    profile: () => "And this is the part of the story nobody tells.",
    photo1: () => "It almost didn't work out.",
    photo2: () => "More than once.",
    memberships: (d) => `The people who stuck around get the rest.${fromPrice(d)}`,
  },
  whyJoin: {
    profile: () => "You already follow along.",
    photo1: () => "But the posts are just the surface.",
    memberships: (d) => `Members get the whole thing.${fromPrice(d)}`,
  },
  supportMe: {
    photo1: (d) => `${firstName(d.creator.name)} built this from nothing.`,
    photo2: () => "And there's still a long way to go.",
    cta: (d) => {
      const h = handleNoAt(d.creator.handle);
      return `Be one of the people who made it happen.${h ? ` Find ${firstName(d.creator.name)} at ${h}.` : ""}`;
    },
  },
  weeklyHighlight: {
    intro: () => "Here's the week, in case you missed it.",
    photo1: () => "The moments people kept coming back to.",
    posts: () => "The posts everyone was talking about.",
    photo2: () => "And a few you had to be there for.",
  },
};

// Returns the angle override for a scene, if one exists.
export const angleLine = (angle: Angle, id: SceneId, d: VideoData): string | null => {
  const fn = ANGLE_SCRIPTS[angle]?.[id];
  return fn ? fn(d) : null;
};

// The social caption a creator pastes when posting this reel.
export const captionFor = (d: VideoData, angle: Angle): string => {
  const hook = hookFor({ ...d, videoType: angle, hookText: undefined });
  const h = handleNoAt(d.creator.handle);
  const bodies: Partial<Record<Angle, string>> = {
    behindScenes: "Everyone sees the finished version. Almost nobody sees the rest.",
    dayInLife: "Start to finish, the whole day. Most of it never makes the feed.",
    storyTime: "The part of the story I don't usually tell.",
    whyJoin: "Following is the easy part. This is everything else.",
    supportMe: "Built from nothing, still building. You can be part of it.",
    weeklyHighlight: "Everything you missed this week, in one place.",
  };
  const body = bodies[angle] ?? "The part most people never get to see.";
  return `${hook}\n\n${body}\n\nThe rest lives on Spotlightly.${h ? ` Find me at ${h}.` : ""}`;
};

// A hashtag set tuned to the angle. One word each (no hyphens), commercial-safe.
export const hashtagsFor = (d: VideoData, angle: Angle): string[] => {
  const base = ["#creator", "#smallbusiness", "#contentcreator", "#supportsmallcreators", "#creatoreconomy"];
  const byAngle: Partial<Record<Angle, string[]>> = {
    behindScenes: ["#behindthescenes", "#bts", "#realtalk"],
    dayInLife: ["#dayinthelife", "#routine", "#worklife"],
    storyTime: ["#storytime", "#myjourney", "#realstory"],
    whyJoin: ["#membership", "#community", "#insiders"],
    supportMe: ["#supportlocal", "#fundraiser", "#believeinme"],
    weeklyHighlight: ["#weeklyrecap", "#highlights", "#thisweek"],
    marketplace: ["#shopsmall", "#digitalproducts", "#smallshop"],
    merch: ["#merch", "#shopmysmallbusiness", "#merchdrop"],
    campaign: ["#fundraiser", "#supportlocal", "#helpusgrow"],
    membership: ["#membership", "#community", "#insiders"],
    launch: ["#newdrop", "#nowlive", "#creatorpage"],
  };
  return [...(byAngle[angle] ?? []), ...base].slice(0, 10);
};
