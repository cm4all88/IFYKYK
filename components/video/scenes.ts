import type {CalculateMetadataFunction} from 'remotion';
import {VideoData} from './types';

export type SceneId =
  | 'intro'
  | 'profile'
  | 'memberships'
  | 'campaign'
  | 'posts'
  | 'marketplace'
  | 'merch'
  | 'cta';

// Per-scene length in frames at 30fps. Tune freely; total runtime is the sum of
// whichever scenes are enabled by the data.
export const SCENE_DURATIONS: Record<SceneId, number> = {
  intro: 95,
  profile: 165,
  memberships: 135,
  campaign: 145,
  posts: 140,
  marketplace: 135,
  merch: 135,
  cta: 140,
};

export interface PlannedScene {
  id: SceneId;
  durationInFrames: number;
}

const order: SceneId[] = [
  'intro',
  'profile',
  'memberships',
  'campaign',
  'posts',
  'marketplace',
  'merch',
  'cta',
];

// A scene only appears if its data exists. This is what lets you reuse one
// composition for every creator: drop in different assets and the timeline adapts.
const isEnabled = (id: SceneId, d: VideoData): boolean => {
  switch (id) {
    case 'intro':
    case 'cta':
    case 'profile':
      return true;
    case 'memberships':
      return Boolean(d.memberships?.length);
    case 'campaign':
      return Boolean(d.campaign || d.campaignScreenshot);
    case 'posts':
      return Boolean(d.feedScreenshots?.length);
    case 'marketplace':
      return Boolean(d.marketplace?.length || d.marketplaceScreenshot);
    case 'merch':
      return Boolean(d.merch?.length || d.merchScreenshot);
    default:
      return false;
  }
};

// Scene sets per video type. Every type keeps intro + profile + cta as bookends.
const TYPE_SCENES: Record<string, SceneId[]> = {
  launch: ["intro", "profile", "memberships", "campaign", "posts", "marketplace", "merch", "cta"],
  campaign: ["intro", "profile", "campaign", "cta"],
  membership: ["intro", "profile", "memberships", "cta"],
  marketplace: ["intro", "profile", "marketplace", "cta"],
  merch: ["intro", "profile", "merch", "cta"],
};

export const buildScenes = (d: VideoData): PlannedScene[] => {
  const allowed = TYPE_SCENES[d.videoType ?? "launch"] ?? TYPE_SCENES.launch;
  return order
    .filter((id) => allowed.includes(id) && isEnabled(id, d))
    .map((id) => ({ id, durationInFrames: SCENE_DURATIONS[id] }));
};

export const calcMeta: CalculateMetadataFunction<VideoData> = ({props}) => {
  const scenes = buildScenes(props);
  const durationInFrames = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  return {durationInFrames, fps: 30, width: 1080, height: 1920};
};
