import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

export type CaptionWord = {text: string; from: number; to: number};

// Group words into short on-screen lines. Bigger than before (6 words / 34 chars) so
// lines swap less often and don't flash.
const chunkWords = (words: CaptionWord[], maxWords = 6, maxChars = 34): CaptionWord[][] => {
  const chunks: CaptionWord[][] = [];
  let cur: CaptionWord[] = [];
  let chars = 0;
  for (const w of words) {
    if (cur.length && (cur.length >= maxWords || chars + w.text.length + 1 > maxChars)) {
      chunks.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(w);
    chars += w.text.length + 1;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
};

// Word-timed captions on a dark pill. Each line holds from its first word until the
// next line begins, and fades in and out so it never hard-cuts. The spoken word lifts
// and turns gold.
export const Captions: React.FC<{words: CaptionWord[]}> = ({words}) => {
  const frame = useCurrentFrame();
  if (!words || !words.length) return null;

  const chunks = chunkWords(words);
  if (!chunks.length) return null;

  // On-screen time range per line: its first word until the next line's first word,
  // with a short tail on the last line.
  const ranges = chunks.map((c, i) => {
    const start = c[0].from;
    const next = chunks[i + 1];
    const end = next ? next[0].from : c[c.length - 1].to + 14;
    return {start, end};
  });

  if (frame < ranges[0].start - 2) return null;

  let idx = ranges.findIndex((r) => frame >= r.start && frame < r.end);
  if (idx < 0) {
    if (frame >= ranges[ranges.length - 1].end) return null; // past the last line
    idx = 0;
  }
  const {start, end} = ranges[idx];
  const chunk = chunks[idx];

  // Soft fade in/out, scaled down for short lines so they never flicker.
  const span = Math.max(1, end - start);
  const fade = Math.min(6, Math.floor(span * 0.3));
  const opacity = Math.min(
    interpolate(frame, [start, start + fade], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    interpolate(frame, [end - fade, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
  );

  // Active (currently spoken) word within this line.
  let active = -1;
  for (let i = 0; i < chunk.length; i++) if (frame >= chunk[i].from) active = i;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '13%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 70px',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: 900,
          background: 'rgba(12,13,16,0.86)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          padding: '20px 32px',
          boxShadow: '0 22px 55px rgba(0,0,0,0.5)',
        }}
      >
        {chunk.map((w, i) => {
          const isActive = active >= 0 && i === active;
          return (
            <span
              key={i}
              style={{
                fontFamily: theme.font.sans,
                fontWeight: 700,
                fontSize: 56,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                color: isActive ? theme.colors.gold : '#FFFFFF',
                transform: isActive ? 'translateY(-2px)' : 'none',
                textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                transition: 'none',
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
