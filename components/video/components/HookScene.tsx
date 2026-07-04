import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {SafeImg} from './SafeImg';
import {camera, exitFade} from '../lib/animations';
import {VideoData} from '../types';
import {hookFor} from '../hooks';

// The opener. A bold hook reads in word by word over a dark, slowly drifting frame
// (the creator's cover, dimmed) before the creator is ever revealed.
export const HookScene: React.FC<{data: VideoData; durationInFrames: number}> = ({data, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const text = hookFor(data);
  const words = text.split(/\s+/).filter(Boolean);
  const cam = camera(frame, durationInFrames, 1);
  const fade = exitFade(frame, durationInFrames);
  const bg = data.creator.cover || data.creator.avatar;

  return (
    <AbsoluteFill style={{backgroundColor: '#0C0C0E', opacity: fade}}>
      <AbsoluteFill style={{transform: cam.transform}}>
        {bg ? <SafeImg src={bg} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : null}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(10,10,12,0.62) 0%, rgba(10,10,12,0.40) 40%, rgba(10,10,12,0.78) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(48% 30% at 50% 8%, rgba(240,180,41,0.22) 0%, rgba(240,180,41,0) 70%)',
        }}
      />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '0 90px'}}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '6px 22px',
            maxWidth: 900,
            textAlign: 'center',
          }}
        >
          {words.map((w, i) => {
            // Whole line eases in together (no word-by-word popping, which flashes).
            const s = spring({frame: frame - 6, fps, config: {damping: 200, mass: 0.9}});
            return (
              <span
                key={i}
                style={{
                  opacity: s,
                  transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`,
                  fontFamily: theme.font.sans,
                  fontWeight: 800,
                  fontSize: 86,
                  lineHeight: 1.05,
                  letterSpacing: '-0.03em',
                  color: '#FFFFFF',
                  textShadow: '0 3px 30px rgba(0,0,0,0.6)',
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
