import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {SafeImg} from './SafeImg';
import {easeInOut, exitFade, overFrames} from '../lib/animations';

// A full-bleed lifestyle photo from the creator's own posts, with a slow Ken Burns
// move and an optional small kicker. These cut between the interface scenes so the
// creator's real content tells the story.
export const PhotoBeat: React.FC<{src: string; durationInFrames: number; seed?: number; kicker?: string}> = ({
  src,
  durationInFrames,
  seed = 0,
  kicker,
}) => {
  const frame = useCurrentFrame();
  const t = easeInOut(overFrames(frame, durationInFrames));
  const zoomIn = seed % 2 === 0;
  const scale = interpolate(t, [0, 1], zoomIn ? [1.04, 1.16] : [1.16, 1.04]);
  const px = interpolate(t, [0, 1], seed % 2 === 0 ? [46, 54] : [54, 46]);
  const fade = Math.min(
    interpolate(frame, [0, 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    exitFade(frame, durationInFrames)
  );
  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg, opacity: fade}}>
      <AbsoluteFill style={{transform: `scale(${scale})`}}>
        <SafeImg src={src} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${px}% 50%`}} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(10,10,12,0.10) 0%, rgba(10,10,12,0) 30%, rgba(10,10,12,0.55) 100%)',
        }}
      />
      {kicker ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', padding: '0 80px 150px'}}>
          <div
            style={{
              fontFamily: theme.font.sans,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              background: 'rgba(15,16,20,0.5)',
              padding: '12px 24px',
              borderRadius: 999,
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            {kicker}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
