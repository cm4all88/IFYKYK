import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';
import {SafeImg} from './SafeImg';

// Shows up to six real public-post images as floating cards: their feed at a
// glance. The layout adapts to how many images the creator actually has.
export const PostsGrid: React.FC<{images: string[]}> = ({images}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const imgs = images.slice(0, 6);
  const count = imgs.length;

  const single = count === 1;
  const cols = single ? 1 : 2;
  const width = single ? 760 : 960;
  // Square tiles for small sets, taller portrait tiles when there are 5 to 6.
  const ratio = single ? '4 / 5' : count > 4 ? '4 / 5' : '1 / 1';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 26,
        width,
      }}
    >
      {imgs.map((src, i) => {
        const s = spring({frame: frame - 6 - i * 6, fps, config: {damping: 200}});
        return (
          <div
            key={i}
            style={{
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px) scale(${interpolate(s, [0, 1], [0.95, 1])})`,
              aspectRatio: ratio,
              borderRadius: 28,
              overflow: 'hidden',
              boxShadow: theme.colors.shadow,
              border: `1px solid ${theme.colors.line}`,
              background: theme.colors.cardBg,
            }}
          >
            <SafeImg src={asset(src) as string} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          </div>
        );
      })}
    </div>
  );
};
