import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';

// Animated Spotlightly wordmark: rises gently into place. Kept clean (no swipe)
// so branding stays subtle and the type reads.
export const Logo: React.FC<{size?: number; delay?: number; tone?: 'dark' | 'light'}> = ({
  size = 120,
  delay = 0,
  tone = 'dark',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 200, mass: 0.9}});
  const y = interpolate(s, [0, 1], [26, 0]);
  const baseColor = tone === 'light' ? '#FFFFFF' : theme.colors.ink;
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${y}px)`,
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
    </div>
  );
};
