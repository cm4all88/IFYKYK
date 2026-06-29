import React from 'react';
import {useCurrentFrame} from 'remotion';
import {theme} from '../theme';

export type CaptionWord = {text: string; from: number; to: number};

// Group words into short on-screen chunks (a few words at a time, the short-form
// caption look) so the line stays readable instead of wrapping into a paragraph.
const chunkWords = (words: CaptionWord[], maxWords = 4, maxChars = 24): CaptionWord[][] => {
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

// Word-timed captions on a dark pill, so they read over the light stage or any
// cover image. The currently spoken word lifts and turns gold.
export const Captions: React.FC<{words: CaptionWord[]}> = ({words}) => {
  const frame = useCurrentFrame();
  if (!words || !words.length) return null;
  if (frame < words[0].from - 2) return null;

  // Index of the most recently started word.
  let active = -1;
  for (let i = 0; i < words.length; i++) {
    if (frame >= words[i].from) active = i;
  }

  const chunks = chunkWords(words);
  // Which chunk holds the active word, and the active word's index within it.
  let count = 0;
  let activeChunk = 0;
  let activeInChunk = 0;
  for (let c = 0; c < chunks.length; c++) {
    const len = chunks[c].length;
    if (active < count + len || c === chunks.length - 1) {
      activeChunk = c;
      activeInChunk = Math.max(0, active - count);
      break;
    }
    count += len;
  }
  const chunk = chunks[activeChunk] ?? chunks[0];

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
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: 880,
          background: 'rgba(15,16,20,0.82)',
          borderRadius: 22,
          padding: '18px 30px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        {chunk.map((w, i) => {
          const isActive = active >= 0 && i === activeInChunk;
          return (
            <span
              key={i}
              style={{
                fontFamily: theme.font.sans,
                fontWeight: 800,
                fontSize: 56,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                color: isActive ? theme.colors.gold : '#FFFFFF',
                transform: isActive ? 'translateY(-2px)' : 'none',
                textShadow: '0 2px 10px rgba(0,0,0,0.45)',
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
