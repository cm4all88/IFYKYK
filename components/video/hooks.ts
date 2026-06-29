import {VideoData} from './types';

const firstName = (n?: string) => (n || '').trim().split(/\s+/)[0] || 'this creator';

export type Angle =
  | 'launch'
  | 'campaign'
  | 'membership'
  | 'marketplace'
  | 'merch'
  | 'storyTime'
  | 'behindScenes'
  | 'dayInLife'
  | 'whyJoin'
  | 'supportMe'
  | 'weeklyHighlight';

interface Hook {
  text: string; // may contain {first}
  angles?: Angle[]; // affinity; absent = fits any angle
}

// Story-first openers. Narrator-safe (third person / universal), curiosity-led,
// no feature words. {first} is replaced with the creator's first name.
const HOOKS: Hook[] = [
  {text: 'Nobody sees this part.'},
  {text: 'Everyone sees the highlights.'},
  {text: 'They never see what happens after.'},
  {text: "The hard part isn't what you think."},
  {text: 'Most people only see the finished version.'},
  {text: "There's a part {first} has never shown anyone."},
  {text: 'Behind every post is a day you never see.'},
  {text: 'You see the result. Not the work.', angles: ['behindScenes', 'dayInLife']},
  {text: 'This is the part nobody posts.', angles: ['behindScenes']},
  {text: "The work doesn't stop when the doors close.", angles: ['behindScenes']},
  {text: 'It starts before sunrise.', angles: ['dayInLife']},
  {text: 'Hours before anyone shows up.', angles: ['dayInLife']},
  {text: 'So this happened today.', angles: ['storyTime']},
  {text: '{first} almost walked away from all of it.', angles: ['storyTime', 'supportMe']},
  {text: 'Following is easy. This is the rest.', angles: ['whyJoin', 'membership']},
  {text: 'Followers see the posts. Members see everything.', angles: ['whyJoin', 'membership']},
  {text: 'This is where the real ones go.', angles: ['whyJoin', 'membership']},
  {text: "{first} can't do it alone.", angles: ['supportMe', 'campaign']},
  {text: 'Every big thing needs a few believers.', angles: ['supportMe', 'campaign']},
  {text: "Here's what you missed this week.", angles: ['weeklyHighlight']},
];

const STRONG_OPENERS = ['nobody', 'everyone', 'this', 'they', 'what', 'most', 'the', 'here', 'so', 'following', 'behind'];
const FEATURE_WORDS = /\b(subscribe|membership|exclusive|unlock|platform|sign up|link in bio|discount)\b/i;
const CURIOSITY = /\b(nobody|never|no one|secret|hidden|don'?t see|what you|the part|behind|missed|this happened)\b/i;
const EMOTION = /\b(almost|quit|walk(ed)? away|hard|real|truth|honest|alone|believers|sunrise|before anyone)\b/i;

const hashOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

// Heuristic 0..100. Rewards curiosity, emotion, brevity, a strong first word, and
// natural speech; punishes feature/ad language.
export const scoreHook = (text: string): number => {
  const t = text.trim();
  const words = t.split(/\s+/);
  const first = (words[0] || '').toLowerCase().replace(/[^a-z']/g, '');
  let s = 30;
  if (CURIOSITY.test(t)) s += 24;
  if (EMOTION.test(t)) s += 18;
  if (STRONG_OPENERS.includes(first)) s += 12;
  if (words.length <= 7) s += 14;
  else if (words.length <= 10) s += 6;
  else s -= 8;
  if (/'(t|s|re|ll|ve|m)\b/.test(t)) s += 6; // contraction = conversational
  if (t.endsWith('...')) s += 5;
  if (FEATURE_WORDS.test(t)) s -= 30;
  return Math.max(0, Math.min(100, s));
};

const fill = (text: string, d: VideoData) => text.replace(/\{first\}/g, firstName(d.creator?.name));

const angleOf = (d: VideoData): Angle => (d.videoType as Angle) ?? 'launch';

// Top N hooks for this creator and angle, already scored and personalized.
export const hooksFor = (d: VideoData, n = 3): {text: string; score: number}[] => {
  const angle = angleOf(d);
  const key = d.creator?.handle || d.creator?.name || 'spotlightly';
  const jitter = hashOf(key) % 4;
  const eligible = HOOKS.filter((h) => !h.angles || h.angles.includes(angle));
  const pool = eligible.length ? eligible : HOOKS;
  return pool
    .map((h, i) => ({text: fill(h.text, d), score: Math.min(100, scoreHook(h.text) + ((i + jitter) % 3))}))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
};

// The single chosen opener (used on screen and as the spoken first line).
export const hookFor = (d: VideoData): string => {
  if (d.hookText && d.hookText.trim()) return d.hookText.trim();
  const top = hooksFor(d, 1)[0];
  return top ? top.text : 'Nobody sees this part.';
};
