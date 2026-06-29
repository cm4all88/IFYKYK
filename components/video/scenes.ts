import type {CalculateMetadataFunction} from 'remotion';
import {VideoData} from './types';

export type SceneId =
  | 'hook'
  | 'intro'
  | 'photo1'
  | 'profile'
  | 'memberships'
  | 'campaign'
  | 'photo2'
  | 'posts'
  | 'marketplace'
  | 'merch'
  | 'cta';

// Per-scene length in frames at 30fps. Energetic pacing: nothing sits longer than
// it needs to. With narration on, these act as minimums and a scene grows to fit
// its spoken line.
export const SCENE_DURATIONS: Record<SceneId, number> = {
  hook: 80,
  intro: 78,
  photo1: 70,
  profile: 82,
  memberships: 95,
  campaign: 95,
  photo2: 70,
  posts: 90,
  marketplace: 95,
  merch: 95,
  cta: 88,
};

export interface PlannedScene {
  id: SceneId;
  durationInFrames: number;
}

// Frames added after a scene's narration line, so the picture holds a beat before
// it cuts to the next scene.
const SCENE_TAIL = 16;

// A scene's length: its base duration, or long enough to cover its own narration
// line plus a short breath, whichever is greater.
const sceneDuration = (id: SceneId, d: VideoData): number => {
  const base = SCENE_DURATIONS[id];
  const clip = d.narrationByScene?.[id];
  if (clip && clip.frames > 0) return Math.max(base, clip.frames + SCENE_TAIL);
  return base;
};

const order: SceneId[] = [
  'hook',
  'intro',
  'photo1',
  'profile',
  'memberships',
  'campaign',
  'photo2',
  'posts',
  'marketplace',
  'merch',
  'cta',
];

// A scene only appears if its data exists.
const isEnabled = (id: SceneId, d: VideoData): boolean => {
  switch (id) {
    case 'hook':
    case 'intro':
    case 'cta':
    case 'profile':
      return true;
    case 'photo1':
      return Boolean(d.feedScreenshots?.[0]);
    case 'photo2':
      return Boolean(d.feedScreenshots?.[1]);
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

// Scene sets per video type. Every type opens with a hook and a lifestyle beat,
// and ends on the call to action.
const TYPE_SCENES: Record<string, SceneId[]> = {
  launch: ['hook', 'intro', 'photo1', 'profile', 'memberships', 'campaign', 'photo2', 'posts', 'marketplace', 'merch', 'cta'],
  campaign: ['hook', 'intro', 'photo1', 'profile', 'campaign', 'cta'],
  membership: ['hook', 'intro', 'photo1', 'profile', 'memberships', 'cta'],
  marketplace: ['hook', 'intro', 'photo1', 'profile', 'marketplace', 'cta'],
  merch: ['hook', 'intro', 'photo1', 'profile', 'merch', 'cta'],
};

export const buildScenes = (d: VideoData): PlannedScene[] => {
  const allowed = TYPE_SCENES[d.videoType ?? 'launch'] ?? TYPE_SCENES.launch;
  return order
    .filter((id) => allowed.includes(id) && isEnabled(id, d))
    .map((id) => ({id, durationInFrames: sceneDuration(id, d)}));
};

export const calcMeta: CalculateMetadataFunction<VideoData> = ({props}) => {
  const scenes = buildScenes(props);
  const sceneSum = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  const voFrames = props.narrationDurationInFrames ?? 0;
  const tail = voFrames > 0 ? 18 : 0;
  const durationInFrames = Math.max(sceneSum, voFrames + tail) || sceneSum;
  return {durationInFrames, fps: 30, width: 1080, height: 1920};
};
