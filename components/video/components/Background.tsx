import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';
import {SafeImg} from './SafeImg';

// The Spotlightly stage. When the creator has a cover image, it can live behind
// everything (blurred, drifting, under a warm scrim) so the whole video feels
// like their world. How strongly it shows is controlled by `intensity`:
//   0   = plain cream stage (the classic look)
//   0.4 = subtle ambient texture (default)
//   1   = the cover reads clearly behind the scenes
export const Background: React.FC<{cover?: string; intensity?: number}> = ({cover, intensity}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const i = Math.max(0, Math.min(1, intensity ?? 0.4));
  const showCover = Boolean(cover) && i > 0.02;

  const breathe = 0.5 + 0.5 * Math.sin(frame / 90);
  const glow = 0.06 + 0.05 * breathe;

  // More intensity = lighter scrim and a crisper (less blurred) image.
  const scrim = 0.95 - 0.23 * i; // 0.95 -> 0.72
  const blur = 12 - 5 * i; // 12px -> 7px (cheap; scrim hides detail)
  const zoom = interpolate(frame, [0, durationInFrames], [1.12, 1.22]);
  const drift = interpolate(frame, [0, durationInFrames], [-2, 2]);

  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg}}>
      {showCover ? (
        <>
          <AbsoluteFill>
            <SafeImg
              src={asset(cover) as string}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: `blur(${blur}px) saturate(1.05)`,
                transform: `scale(${zoom}) translateX(${drift}%)`,
              }}
            />
          </AbsoluteFill>
          {/* Warm scrim so foreground text and white cards stay readable. */}
          <AbsoluteFill style={{backgroundColor: `rgba(16,17,20,${scrim})`}} />
        </>
      ) : null}
      <AbsoluteFill
        style={{
          background: `radial-gradient(58% 36% at 50% 6%, rgba(240,180,41,${glow}) 0%, rgba(240,180,41,0) 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(42% 30% at 86% 92%, rgba(240,180,41,0.035) 0%, rgba(240,180,41,0) 70%)',
        }}
      />
    </AbsoluteFill>
  );
};
