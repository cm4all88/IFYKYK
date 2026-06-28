import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';

// Animated Spotlightly wordmark: rises in, with a single soft light sweep across it.
export const Logo: React.FC<{size?: number; delay?: number; tone?: 'dark' | 'light'}> = ({
  size = 120,
  delay = 0,
  tone = 'dark',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 200, mass: 0.9}});
  const y = interpolate(s, [0, 1], [26, 0]);
  const sweep = interpolate(frame - delay, [12, 50], [-30, 130], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const baseColor = tone === 'light' ? '#FFFFFF' : theme.colors.ink;
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${y}px)`,
        position: 'relative',
        fontFamily: theme.font.serif,
        fontSize: size,
        fontWeight: 400,
        color: baseColor,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        textShadow: tone === 'light' ? '0 2px 30px rgba(0,0,0,0.45)' : 'none',
      }}
    >
      <span>Spot</span>
      <span style={{color: theme.colors.gold}}>light</span>
      <span>ly</span>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(100deg, transparent ${sweep - 14}%, rgba(255,255,255,0.9) ${sweep}%, transparent ${sweep + 14}%)`,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
