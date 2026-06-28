import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';

export const SceneTitle: React.FC<{
  kicker?: string;
  headline?: string;
  sub?: string;
  delay?: number;
}> = ({kicker, headline, sub, delay = 4}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 200}});
  const y = interpolate(s, [0, 1], [34, 0]);
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${y}px)`,
        textAlign: 'center',
        maxWidth: 900,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        alignItems: 'center',
      }}
    >
      {kicker ? (
        <div
          style={{
            fontFamily: theme.font.sans,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: theme.colors.gold,
          }}
        >
          {kicker}
        </div>
      ) : null}
      {headline ? (
        <div
          style={{
            fontFamily: theme.font.sans,
            fontSize: 78,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.04,
            color: theme.colors.ink,
          }}
        >
          {headline}
        </div>
      ) : null}
      {sub ? (
        <div
          style={{
            fontFamily: theme.font.serif,
            fontStyle: 'italic',
            fontSize: 42,
            color: theme.colors.sub,
            lineHeight: 1.3,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
