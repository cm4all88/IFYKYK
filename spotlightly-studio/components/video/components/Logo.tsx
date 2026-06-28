import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';

// Animated Spotlightly wordmark: rises in, with a single soft light sweep across it.
export const Logo: React.FC<{size?: number; delay?: number}> = ({size = 120, delay = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 200, mass: 0.9}});
  const y = interpolate(s, [0, 1], [26, 0]);
  const sweep = interpolate(frame - delay, [12, 50], [-30, 130], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${y}px)`,
        position: 'relative',
        fontFamily: theme.font.serif,
        fontSize: size,
        fontWeight: 400,
        color: theme.colors.ink,
        letterSpacing: '-0.02em',
        lineHeight: 1,
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
