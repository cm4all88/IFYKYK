import {VideoData, MediaAnalysis} from './types';

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
  aspirational?: boolean; // sells the future / being early; good for new creators
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
  // Aspirational / viral: sell the future and being early. These carry a new creator
  // whose page is still light, and they land as viral openers for anyone.
  {text: 'This is day one.', aspirational: true},
  {text: "You're early. That's the whole point.", aspirational: true},
  {text: 'Remember this face.', aspirational: true},
  {text: "One day you'll say you were here first.", aspirational: true},
  {text: 'This is the start of something.', aspirational: true},
  {text: 'Get in before everyone else does.', aspirational: true},
  {text: 'The ones who show up early never regret it.', aspirational: true},
  {text: 'Something is starting here.', aspirational: true},
  {text: 'Be one of the first.', aspirational: true},
  {text: 'You found this at the right time.', aspirational: true},
  {text: 'Watch what happens next.', aspirational: true},
  {text: "Save this. You'll want to remember where it started.", aspirational: true},
  {text: 'Not everyone gets to be early.', aspirational: true},
  {text: 'The beginning is the best part to catch.', aspirational: true},
];

// Niche-aware openers. Only used when we can name what the creator actually does,
// from their analyzed photos or what they sell. {niche} is a short noun phrase like
// "making coffee" or "trailer repairs". These make the hook fit this creator instead
// of anyone.
const NICHE_HOOKS: string[] = [
  'The part of {niche} nobody posts.',
  'This is what {niche} really looks like.',
  '{niche}. The part you never see.',
  'Everyone sees {niche}. Not the rest.',
];

// A short phrase for what this creator does: the most common photo category (weighted
// by confidence), else the first thing they sell. Undefined when we can't tell.
const nicheOf = (d: VideoData): string | undefined => {
  const rows = (d.mediaAnalysis?.filter(Boolean) as MediaAnalysis[] | undefined) ?? [];
  if (rows.length) {
    const tally: Record<string, number> = {};
    for (const m of rows) {
      const c = (m.primary_category || '').trim().toLowerCase();
      if (!c || c.length > 34) continue;
      tally[c] = (tally[c] || 0) + (m.confidence_score ?? 0.5);
    }
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 0.8) return best[0];
  }
  const sell = d.marketplace?.[0]?.title || d.merch?.[0]?.name;
  if (sell && sell.length <= 34) return sell.toLowerCase();
  return undefined;
};

const STRONG_OPENERS = ['nobody', 'everyone', 'this', 'they', 'what', 'most', 'the', 'here', 'so', 'following', 'behind', 'you', 'remember', 'watch', 'get', 'save', 'be', 'something', 'not', 'one'];
const FEATURE_WORDS = /\b(subscribe|membership|exclusive|unlock|platform|sign up|link in bio|discount)\b/i;
const CURIOSITY = /\b(nobody|never|no one|secret|hidden|don'?t see|what you|the part|behind|missed|this happened|early|first|day one|beginning|starts?|remember|watch|before everyone)\b/i;
const EMOTION = /\b(almost|quit|walk(ed)? away|hard|real|truth|honest|alone|believers|sunrise|before anyone|never regret|right time|one day|here first)\b/i;

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

const fill = (text: string, d: VideoData, niche?: string) =>
  text.replace(/\{first\}/g, firstName(d.creator?.name)).replace(/\{niche\}/g, niche ?? '');

const angleOf = (d: VideoData): Angle => (d.videoType as Angle) ?? 'launch';

// A creator is "new" when their page is still light: few posts, no campaign traction.
// For these, we sell the future instead of reaching for thin content.
const isNewCreator = (d: VideoData): boolean => {
  const posts = d.feedScreenshots?.length ?? 0;
  const raised = parseFloat(String(d.campaign?.raised ?? "").replace(/[^0-9.]/g, "")) || 0;
  const backers = d.campaign?.backers ?? 0;
  return Boolean(d.creator?.founding) || (posts < 3 && raised < 1 && backers < 2);
};

// Top N hooks for this creator and angle, already scored and personalized. New creators
// get aspirational, get-in-early openers pushed to the top and skip niche hooks (which
// only look good when there is real content to name).
// Grind / "behind the work" clichés. Right for a maker or a shop, wrong for a travel
// or lifestyle creator, so they only surface on behind-the-scenes style angles.
const GRIND = /(nobody sees|never see what|hard part|finished version|behind every post|\bthe work\b|before sunrise|anyone shows up|nobody posts|result\. not)/i;

// Openers built from THIS creator's real material (their campaign / what they're doing).
// The most relevant openers there are, so they rank at the very top.
const subjectHooks = (d: VideoData): string[] => {
  const out: string[] = [];
  const first = firstName(d.creator?.name);
  const camp = (d.campaign?.title || '').trim().replace(/[.\s]+$/, '');
  if (camp && camp.length >= 4 && camp.length <= 52) {
    out.push(`${camp}.`);
    out.push(`This is the one ${first} has been dreaming about.`);
    out.push(`${camp}. It starts now.`);
  }
  return out;
};

export const hooksFor = (d: VideoData, n = 3): {text: string; score: number}[] => {
  const angle = angleOf(d);
  const key = d.creator?.handle || d.creator?.name || 'spotlightly';
  const jitter = hashOf(key) % 4;
  const isNew = isNewCreator(d);
  const grindOk = angle === 'behindScenes' || angle === 'dayInLife' || angle === 'storyTime';

  // Most relevant: straight from the creator's campaign / subject.
  const subject = subjectHooks(d).map((t, i) => ({text: fill(t, d), score: 100 - i}));

  const niche = isNew ? undefined : nicheOf(d);
  const nicheScored = niche
    ? NICHE_HOOKS.map((t, i) => ({
        text: fill(t, d, niche),
        score: Math.min(99, scoreHook(t.replace(/\{niche\}/g, niche)) + 10 + ((i + jitter) % 2)),
      }))
    : [];

  // Generic pool, minus grind clichés unless the angle actually calls for them.
  const eligible = HOOKS.filter((h) => (!h.angles || h.angles.includes(angle)) && (grindOk || !GRIND.test(h.text)));
  const pool = eligible.length ? eligible : HOOKS.filter((h) => grindOk || !GRIND.test(h.text));
  const generic = pool.map((h, i) => ({
    text: fill(h.text, d),
    score: Math.min(98, scoreHook(h.text) + ((i + jitter) % 3) + (h.aspirational ? (isNew ? 22 : 6) : 0)),
  }));

  return [...subject, ...nicheScored, ...generic]
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
};

// The single chosen opener (used on screen and as the spoken first line).
export const hookFor = (d: VideoData): string => {
  if (d.hookText && d.hookText.trim()) return d.hookText.trim();
  const top = hooksFor(d, 1)[0];
  return top ? top.text : 'Nobody sees this part.';
};
