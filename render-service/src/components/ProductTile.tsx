import React from 'react';
import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';

export const ProductTile: React.FC<{title: string; price: string; image?: string; idx: number}> = ({
  title,
  price,
  image,
  idx,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - 6 - idx * 6, fps, config: {damping: 200}});
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [44, 0])}px) scale(${interpolate(s, [0, 1], [0.96, 1])})`,
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
          background: image ? 'transparent' : 'linear-gradient(135deg, #FFF6E2, #FFE8BD)',
        }}
      >
        {image ? (
          <Img src={asset(image) as string} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
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
