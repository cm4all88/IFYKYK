import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

export type CaptionWord = {text: string; from: number; to: number};

// Group words into whole sentences so a complete thought stays on screen and holds,
// instead of fragments flashing by. Long sentences are split at a soft cap.
const sentences = (words: CaptionWord[]): CaptionWord[][] => {
  const out: CaptionWord[][] = [];
  let cur: CaptionWord[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?]$/.test((w.text || '').trim()) || cur.length >= 12) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
};

// Captions for silent viewing. One full sentence at a time, held for as long as it is
// spoken, fading in and out. The word being spoken lifts to gold. The text itself never
// swaps mid-phrase, so nothing flashes.
export const Captions: React.FC<{words: CaptionWord[]}> = ({words}) => {
  const frame = useCurrentFrame();
  if (!words || !words.length) return null;

  const groups = sentences(words);
  if (!groups.length) return null;

  const ranges = groups.map((g, i) => {
    const start = g[0].from;
    const next = groups[i + 1];
    const end = next ? next[0].from : g[g.length - 1].to + 16;
    return {start, end};
  });

  if (frame < ranges[0].start - 2) return null;
  let idx = ranges.findIndex((r) => frame >= r.start && frame < r.end);
  if (idx < 0) {
    if (frame >= ranges[ranges.length - 1].end) return null;
    idx = 0;
  }
  const {start, end} = ranges[idx];
  const group = groups[idx];

  const span = Math.max(1, end - start);
  const fade = Math.min(8, Math.floor(span * 0.18));
  const opacity = Math.min(
    interpolate(frame, [start, start + fade], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    interpolate(frame, [end - fade, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
  );

  let active = -1;
  for (let i = 0; i < group.length; i++) if (frame >= group[i].from) active = i;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '13%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 64px',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: 940,
          background: 'rgba(12,13,16,0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 26,
          padding: '24px 36px',
          boxShadow: '0 22px 55px rgba(0,0,0,0.5)',
        }}
      >
        {group.map((w, i) => (
          <span
            key={i}
            style={{
              fontFamily: theme.font.sans,
              fontWeight: 700,
              fontSize: 52,
              lineHeight: 1.16,
              letterSpacing: '-0.02em',
              color: i === active ? theme.colors.gold : '#FFFFFF',
              textShadow: '0 2px 12px rgba(0,0,0,0.55)',
            }}
          >
            {w.text}
          </span>
        ))}
      </div>
    </div>
  );
};
