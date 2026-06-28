import React from 'react';
import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';

// Shows up to four real post images as floating cards (a feed at a glance).
export const PostsGrid: React.FC<{images: string[]}> = ({images}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const imgs = images.slice(0, 4);
  const single = imgs.length <= 1;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: single ? '1fr' : '1fr 1fr',
        gap: 24,
        width: single ? 640 : 860,
      }}
    >
      {imgs.map((src, i) => {
        const s = spring({frame: frame - 6 - i * 7, fps, config: {damping: 200}});
        return (
          <div
            key={i}
            style={{
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [44, 0])}px) scale(${interpolate(s, [0, 1], [0.96, 1])})`,
              aspectRatio: '1 / 1',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: theme.colors.shadow,
              border: `1px solid ${theme.colors.line}`,
              background: theme.colors.cardBg,
            }}
          >
            <Img src={asset(src) as string} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          </div>
        );
      })}
    </div>
  );
};
