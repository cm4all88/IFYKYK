import React from 'react';
import {AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';
import {exitFade} from '../lib/animations';
import type {VideoClip} from '../types';

// A creator's own short clip (a reel or TikTok), stitched in full bleed, muted, with
// a slow push and an overlay label like "How she made this". The clip's own audio is
// dropped so the music and voiceover stay in control.
export const ClipScene: React.FC<{clip: VideoClip; durationInFrames: number}> = ({clip, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const opacity = Math.min(
    interpolate(frame, [0, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    exitFade(frame, durationInFrames)
  );
  const scale = 1 + 0.05 * (frame / Math.max(1, durationInFrames)); // slow push in
  const labelIn = interpolate(frame, [7, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{opacity, background: '#000'}}>
      <AbsoluteFill style={{transform: `scale(${scale})`}}>
        <OffthreadVideo
          src={asset(clip.url) as string}
          muted
          startFrom={Math.max(0, Math.round((clip.trimStart ?? 0) * fps))}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </AbsoluteFill>

      {/* legibility gradient behind the label */}
      <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 34%)'}} />

      {clip.label ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 150,
            display: 'flex',
            justifyContent: 'center',
            opacity: labelIn,
            transform: `translateY(${(1 - labelIn) * 22}px)`,
          }}
        >
          <div
            style={{
              background: theme.colors.gold,
              color: theme.colors.ink,
              fontFamily: theme.font.sans,
              fontWeight: 600,
              fontSize: 40,
              letterSpacing: '-0.01em',
              padding: '18px 34px',
              borderRadius: 999,
              boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
              maxWidth: '82%',
              textAlign: 'center',
              lineHeight: 1.15,
            }}
          >
            {clip.label}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
