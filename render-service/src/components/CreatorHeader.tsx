import React from 'react';
import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';
import {VideoData} from '../types';

export const CreatorHeader: React.FC<{creator: VideoData['creator']; delay?: number}> = ({
  creator,
  delay = 4,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 200}});
  const y = interpolate(s, [0, 1], [40, 0]);
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${y}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        textAlign: 'center',
      }}
    >
      {creator.avatar ? (
        <Img
          src={asset(creator.avatar) as string}
          style={{
            width: 240,
            height: 240,
            borderRadius: '50%',
            objectFit: 'cover',
            boxShadow: theme.colors.shadow,
            border: `4px solid ${theme.colors.cardBg}`,
          }}
        />
      ) : null}
      {creator.founding ? (
        <div
          style={{
            fontFamily: theme.font.sans,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: theme.colors.goldDeep,
            background: 'rgba(240,180,41,0.12)',
            border: `1px solid rgba(240,180,41,0.4)`,
            padding: '10px 22px',
            borderRadius: 999,
          }}
        >
          Founding creator
        </div>
      ) : null}
      <div style={{fontFamily: theme.font.serif, fontSize: 92, color: theme.colors.ink, lineHeight: 1}}>
        {creator.name}
      </div>
      <div style={{fontFamily: theme.font.sans, fontSize: 40, color: theme.colors.sub}}>
        {creator.handle}
      </div>
      {creator.tagline ? (
        <div
          style={{
            fontFamily: theme.font.serif,
            fontStyle: 'italic',
            fontSize: 40,
            color: theme.colors.sub,
            maxWidth: 760,
            lineHeight: 1.35,
            marginTop: 6,
          }}
        >
          {creator.tagline}
        </div>
      ) : null}
    </div>
  );
};
