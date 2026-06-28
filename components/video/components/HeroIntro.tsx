import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';
import {SafeImg} from './SafeImg';
import {Logo} from './Logo';
import {VideoData} from '../types';

// The sticky opener: the creator's own image fills the frame (their cover, or
// their portrait if there is no cover), slowly pushing in, with the wordmark,
// their name, and the headline reading in white over a cinematic gradient.
export const HeroIntro: React.FC<{
  creator: VideoData['creator'];
  headline: string;
  durationInFrames: number;
}> = ({creator, headline, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const image = creator.cover || creator.avatar;

  const zoom = interpolate(frame, [0, durationInFrames], [1.08, 1.18]);
  const nameS = spring({frame: frame - 24, fps, config: {damping: 200}});
  const headS = spring({frame: frame - 38, fps, config: {damping: 200}});

  return (
    <AbsoluteFill>
      <AbsoluteFill>
        <SafeImg
          src={asset(image) as string}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${zoom})`,
          }}
        />
      </AbsoluteFill>

      {/* Cinematic legibility gradient: dark at the bottom where the type sits. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(12,12,14,0.30) 0%, rgba(12,12,14,0.05) 32%, rgba(12,12,14,0.45) 72%, rgba(12,12,14,0.86) 100%)',
        }}
      />
      {/* A soft gold spotlight kiss from the top. */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(50% 32% at 50% 4%, rgba(240,180,41,0.22) 0%, rgba(240,180,41,0) 70%)',
        }}
      />

      <AbsoluteFill
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 90px 150px',
          textAlign: 'center',
          gap: 26,
        }}
      >
        <Logo size={104} tone="light" />
        <div
          style={{
            opacity: nameS,
            transform: `translateY(${interpolate(nameS, [0, 1], [30, 0])}px)`,
            fontFamily: theme.font.serif,
            fontSize: 96,
            color: '#FFFFFF',
            lineHeight: 1.02,
            textShadow: '0 2px 40px rgba(0,0,0,0.55)',
          }}
        >
          {creator.name}
        </div>
        {creator.handle ? (
          <div
            style={{
              opacity: nameS,
              fontFamily: theme.font.sans,
              fontSize: 38,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.82)',
              letterSpacing: '0.01em',
              textShadow: '0 2px 24px rgba(0,0,0,0.5)',
            }}
          >
            {creator.handle}
          </div>
        ) : null}
        <div
          style={{
            opacity: headS,
            transform: `translateY(${interpolate(headS, [0, 1], [26, 0])}px)`,
            fontFamily: theme.font.sans,
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            color: '#FFFFFF',
            maxWidth: 880,
            marginTop: 8,
            textShadow: '0 2px 30px rgba(0,0,0,0.5)',
          }}
        >
          {headline}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
