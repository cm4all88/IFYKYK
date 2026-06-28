import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {Logo} from './Logo';
import {VideoData} from '../types';

export const CallToAction: React.FC<{cta: VideoData['cta']}> = ({cta}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const head = spring({frame: frame - 10, fps, config: {damping: 200}});
  const tail = spring({frame: frame - 24, fps, config: {damping: 200}});
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 46,
        textAlign: 'center',
        padding: '0 70px',
      }}
    >
      <Logo size={92} />
      <div
        style={{
          opacity: head,
          transform: `translateY(${interpolate(head, [0, 1], [40, 0])}px)`,
          fontFamily: theme.font.sans,
          fontWeight: 800,
          fontSize: 92,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          color: theme.colors.ink,
          maxWidth: 920,
        }}
      >
        {cta.headline}
      </div>
      {cta.sub ? (
        <div
          style={{
            opacity: tail,
            fontFamily: theme.font.serif,
            fontStyle: 'italic',
            fontSize: 46,
            color: theme.colors.sub,
          }}
        >
          {cta.sub}
        </div>
      ) : null}
      {cta.url ? (
        <div
          style={{
            opacity: tail,
            transform: `translateY(${interpolate(tail, [0, 1], [20, 0])}px)`,
            marginTop: 8,
            fontFamily: theme.font.sans,
            fontWeight: 700,
            fontSize: 40,
            color: '#fff',
            background: `linear-gradient(90deg, ${theme.colors.gold}, ${theme.colors.goldDeep})`,
            padding: '24px 54px',
            borderRadius: 999,
            boxShadow: theme.colors.shadow,
          }}
        >
          {cta.url}
        </div>
      ) : null}
    </div>
  );
};
