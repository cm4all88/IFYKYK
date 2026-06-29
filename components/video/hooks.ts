import {VideoData} from './types';

// Scroll-stopping openers. The first two seconds decide everything, so the reel
// leads with one of these before the creator is ever shown.
const HOOKS = [
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

// Deterministic per creator, so a given creator always gets the same opener
// (until edited), but different creators vary.
export const hookFor = (d: VideoData): string => {
  if (d.hookText && d.hookText.trim()) return d.hookText.trim();
  const key = d.creator?.handle || d.creator?.name || 'spotlightly';
  return HOOKS[hashOf(key) % HOOKS.length];
};
