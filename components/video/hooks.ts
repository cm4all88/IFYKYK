import {VideoData} from './types';

const firstName = (n?: string) => (n || '').trim().split(/\s+/)[0] || 'this creator';

// Fan-facing openers. For a creator running this reel to their OWN audience to win
// subscribers. They speak to the fan and make them want in.
const SUBS_HOOKS = (d: VideoData): string[] => {
  const f = firstName(d.creator?.name);
  return [
    `Get closer to ${f}.`,
    `There is a side of ${f} only members see.`,
    `Be more than a follower.`,
    `${f}'s inner circle is open.`,
    `Support the work. Get the good stuff.`,
    `This is where you get closer to ${f}.`,
  ];
};

// Platform openers. For pulling other creators onto Spotlightly.
const PLATFORM_HOOKS = [
  'Your followers should not stop at Instagram.',
  'What if your biggest fans had one place to support everything you make?',
  'The page every creator wishes they had.',
  'One page. Every way to support them.',
  'Stop renting your audience. Own the room.',
  'This is where followers become supporters.',
];

const hashOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

// Deterministic per creator, so a given creator always gets the same opener (until
// edited), but different creators vary. Pool depends on the reel's goal.
export const hookFor = (d: VideoData): string => {
  if (d.hookText && d.hookText.trim()) return d.hookText.trim();
  const key = d.creator?.handle || d.creator?.name || 'spotlightly';
  const pool = (d.goal ?? 'subs') === 'platform' ? PLATFORM_HOOKS : SUBS_HOOKS(d);
  return pool[hashOf(key) % pool.length];
};
