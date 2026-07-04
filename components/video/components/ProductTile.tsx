import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';
import {SafeImg} from './SafeImg';

export const ProductTile: React.FC<{title: string; price: string; image?: string; idx: number; fan?: boolean}> = ({
  title,
  price,
  image,
  idx,
  fan = false,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - 6 - idx * 6, fps, config: {damping: 200}});
  // Merch "fans" into place: each tile rotates in from a slight offset angle.
  const fanAngle = fan ? interpolate(s, [0, 1], [(idx % 2 === 0 ? -1 : 1) * (5 + idx * 1.5), 0]) : 0;
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [44, 0])}px) scale(${interpolate(s, [0, 1], [0.96, 1])}) rotate(${fanAngle}deg)`,
        transformOrigin: 'bottom center',
        background: theme.colors.cardBg,
        border: `1px solid ${theme.colors.line}`,
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: theme.colors.shadowSoft,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          aspectRatio: '1 / 1',
          overflow: 'hidden',
          background: image ? 'transparent' : 'linear-gradient(135deg, rgba(242,184,75,0.18), rgba(242,184,75,0.05))',
        }}
      >
        {image ? (
          <SafeImg src={asset(image) as string} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.font.serif,
              fontSize: 40,
              color: theme.colors.goldDeep,
            }}
          >
            Spot<span style={{color: theme.colors.gold}}>light</span>ly
          </div>
        )}
      </div>
      <div
        style={{
          padding: '22px 26px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: theme.font.sans,
            fontWeight: 600,
            fontSize: 30,
            color: theme.colors.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: theme.font.sans,
            fontWeight: 800,
            fontSize: 32,
            color: theme.colors.goldDeep,
            whiteSpace: 'nowrap',
          }}
        >
          {price}
        </span>
      </div>
    </div>
  );
};
