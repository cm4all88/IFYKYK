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
  | 'photo3'
  | 'posts'
  | 'marketplace'
  | 'merch'
  | 'cta';

// Per-scene length in frames at 30fps. Energetic pacing: nothing sits longer than
// it needs to. With narration on, these act as minimums and a scene grows to fit
// its spoken line.
export const SCENE_DURATIONS: Record<SceneId, number> = {
  hook: 72,
  intro: 52,
  profile: 70,
  photo1: 60,
  memberships: 80,
  campaign: 80,
  posts: 70,
  photo2: 60,
  photo3: 60,
  marketplace: 80,
  merch: 80,
  cta: 86,
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
    case 'photo3':
      return Boolean(d.feedScreenshots?.[2]);
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

// Scene sets per product-focus / angle type.
const BASE_TYPE_SCENES: Record<string, SceneId[]> = {
  launch: ['hook', 'intro', 'profile', 'photo1', 'memberships', 'campaign', 'posts', 'photo2', 'marketplace', 'merch', 'cta'],
  campaign: ['hook', 'intro', 'profile', 'photo1', 'campaign', 'cta'],
  membership: ['hook', 'intro', 'profile', 'photo1', 'memberships', 'cta'],
  marketplace: ['hook', 'intro', 'profile', 'photo1', 'marketplace', 'cta'],
  merch: ['hook', 'intro', 'profile', 'photo1', 'merch', 'cta'],
  // Story angles: heavier on the creator's own photos, lighter on UI.
  storyTime: ['hook', 'intro', 'profile', 'photo1', 'photo2', 'memberships', 'photo3', 'cta'],
  behindScenes: ['hook', 'photo1', 'profile', 'photo2', 'memberships', 'photo3', 'cta'],
  dayInLife: ['hook', 'photo1', 'photo2', 'profile', 'photo3', 'memberships', 'cta'],
  whyJoin: ['hook', 'intro', 'profile', 'photo1', 'memberships', 'cta'],
  supportMe: ['hook', 'photo1', 'profile', 'photo2', 'campaign', 'cta'],
  weeklyHighlight: ['hook', 'intro', 'photo1', 'posts', 'photo2', 'memberships', 'cta'],
};

// Story Engine: a story type is a narrative arc, an ordered list of beats, each
// bound to a scene. The arc decides the sequence; the narration is written to each
// beat's role (built in the studio's story engine). One source of truth shared with
// the renderer.
export type StoryBeat =
  | 'hook' | 'intro' | 'problem' | 'work' | 'solution' | 'result' | 'question'
  | 'answer' | 'proof' | 'morning' | 'closing' | 'reflection' | 'community'
  | 'milestone' | 'update' | 'offer' | 'cta';

export const STORY_ARCS: Record<string, {scene: SceneId; beat: StoryBeat}[]> = {
  struggle: [
    {scene: 'hook', beat: 'hook'}, {scene: 'photo1', beat: 'problem'}, {scene: 'photo2', beat: 'work'},
    {scene: 'memberships', beat: 'solution'}, {scene: 'photo3', beat: 'result'}, {scene: 'cta', beat: 'cta'},
  ],
  breakthrough: [
    {scene: 'hook', beat: 'hook'}, {scene: 'photo1', beat: 'problem'}, {scene: 'photo2', beat: 'work'},
    {scene: 'profile', beat: 'proof'}, {scene: 'memberships', beat: 'result'}, {scene: 'cta', beat: 'cta'},
  ],
  lesson: [
    {scene: 'hook', beat: 'hook'}, {scene: 'intro', beat: 'question'}, {scene: 'photo1', beat: 'work'},
    {scene: 'photo2', beat: 'answer'}, {scene: 'memberships', beat: 'solution'}, {scene: 'cta', beat: 'cta'},
  ],
  normalDay: [
    {scene: 'hook', beat: 'hook'}, {scene: 'photo1', beat: 'morning'}, {scene: 'photo2', beat: 'work'},
    {scene: 'photo3', beat: 'closing'}, {scene: 'profile', beat: 'reflection'}, {scene: 'cta', beat: 'cta'},
  ],
  challenge: [
    {scene: 'hook', beat: 'hook'}, {scene: 'photo1', beat: 'problem'}, {scene: 'photo2', beat: 'work'},
    {scene: 'photo3', beat: 'result'}, {scene: 'memberships', beat: 'solution'}, {scene: 'cta', beat: 'cta'},
  ],
  customerStory: [
    {scene: 'hook', beat: 'hook'}, {scene: 'photo1', beat: 'community'}, {scene: 'photo2', beat: 'work'},
    {scene: 'memberships', beat: 'result'}, {scene: 'cta', beat: 'cta'},
  ],
  milestone: [
    {scene: 'hook', beat: 'hook'}, {scene: 'photo1', beat: 'reflection'}, {scene: 'photo2', beat: 'work'},
    {scene: 'memberships', beat: 'milestone'}, {scene: 'photo3', beat: 'proof'}, {scene: 'cta', beat: 'cta'},
  ],
  productLaunch: [
    {scene: 'hook', beat: 'hook'}, {scene: 'profile', beat: 'intro'}, {scene: 'photo1', beat: 'work'},
    {scene: 'marketplace', beat: 'offer'}, {scene: 'photo2', beat: 'proof'}, {scene: 'cta', beat: 'cta'},
  ],
  reflection: [
    {scene: 'hook', beat: 'hook'}, {scene: 'photo1', beat: 'reflection'}, {scene: 'photo2', beat: 'work'},
    {scene: 'profile', beat: 'closing'}, {scene: 'cta', beat: 'cta'},
  ],
  supporterStory: [
    {scene: 'hook', beat: 'hook'}, {scene: 'photo1', beat: 'community'}, {scene: 'photo2', beat: 'problem'},
    {scene: 'memberships', beat: 'solution'}, {scene: 'cta', beat: 'cta'},
  ],
  businessUpdate: [
    {scene: 'hook', beat: 'hook'}, {scene: 'intro', beat: 'update'}, {scene: 'photo1', beat: 'work'},
    {scene: 'memberships', beat: 'milestone'}, {scene: 'cta', beat: 'cta'},
  ],
};

export const isStoryType = (t?: string): boolean => Boolean(t && STORY_ARCS[t]);

// The narrative beat assigned to a scene within a story type (or null).
export const beatForScene = (type: string, scene: SceneId): StoryBeat | null => {
  const arc = STORY_ARCS[type];
  if (!arc) return null;
  return arc.find((b) => b.scene === scene)?.beat ?? null;
};

const STORY_TYPE_SCENES: Record<string, SceneId[]> = Object.fromEntries(
  Object.entries(STORY_ARCS).map(([k, arc]) => [k, arc.map((b) => b.scene)])
);

const TYPE_SCENES: Record<string, SceneId[]> = {...BASE_TYPE_SCENES, ...STORY_TYPE_SCENES};

// Smallest grid frame at or after target (and at least minOut). Falls back to target
// once the grid runs out, i.e. past the end of the music.
const snapUp = (target: number, grid: number[], minOut: number): number => {
  const floor = Math.max(target, minOut);
  for (const g of grid) if (g >= floor) return g;
  return target;
};

export const buildScenes = (d: VideoData): PlannedScene[] => {
  // The type's own scene list defines the sequence (story arcs depend on order).
  const allowed = TYPE_SCENES[d.videoType ?? 'launch'] ?? TYPE_SCENES.launch;
  const ids = allowed.filter((id) => isEnabled(id, d));

  const grid = d.beats?.downbeatFrames?.length ? d.beats.downbeatFrames : null;
  if (!grid) {
    // No music analysis: original fixed / voiceover-fit timing.
    return ids.map((id) => ({id, durationInFrames: sceneDuration(id, d)}));
  }

  // Beat-driven: each scene holds at least its narration (the floor so the voice always
  // fits), then the cut lands on the next downbeat. Pacing follows the music: a faster
  // tempo gives shorter bars and faster cuts, a slower tempo holds scenes longer.
  const endFrame = d.beats?.endFrame ?? 0;
  const out: PlannedScene[] = [];
  let cursor = 0;
  ids.forEach((id, i) => {
    const clip = d.narrationByScene?.[id];
    const voFloor = clip && clip.frames > 0 ? clip.frames + SCENE_TAIL : 0;
    const floor = cursor + Math.max(voFloor, 24); // the voice, or ~0.8s minimum
    let end = snapUp(floor, grid, cursor + 18); // next downbeat, scene never under ~0.6s
    if (i === ids.length - 1 && endFrame > cursor) {
      // Final scene (CTA): hold to the music's natural ending.
      end = Math.max(end, endFrame);
    }
    out.push({id, durationInFrames: Math.max(1, end - cursor)});
    cursor = end;
  });
  return out;
};

export const calcMeta: CalculateMetadataFunction<VideoData> = ({props}) => {
  const scenes = buildScenes(props);
  const sceneSum = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  const voFrames = props.narrationDurationInFrames ?? 0;
  const tail = voFrames > 0 ? 18 : 0;
  const durationInFrames = Math.max(sceneSum, voFrames + tail) || sceneSum;
  return {durationInFrames, fps: 30, width: 1080, height: 1920};
};
