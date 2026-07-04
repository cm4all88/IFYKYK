import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';
import {SafeImg} from './SafeImg';
import {easeInOut, overFrames} from '../lib/animations';

// A modern phone showing the creator page, always in motion: scales in, floats,
// and tilts in 3D so the page reads as living content, not a flat screenshot. The
// screenshot pans vertically inside the screen like a slow scroll.
export const PhoneMockup: React.FC<{src: string; durationInFrames: number; seed?: number}> = ({
  src,
  durationInFrames,
  seed = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const enter = spring({frame: frame - 4, fps, config: {damping: 200, mass: 0.7}});
  const t = easeInOut(overFrames(frame, durationInFrames));

  const scaleIn = interpolate(enter, [0, 1], [0.9, 1]);
  const float = Math.sin(frame / 46) * 10;
  // Gentle 3D tilt that drifts across the scene; direction alternates by seed.
  const dir = seed % 2 === 0 ? 1 : -1;
  const rotY = interpolate(t, [0, 1], [7 * dir, -5 * dir]);
  const rotX = Math.sin(frame / 60) * 2.2;
  // Slow vertical "scroll" of the page inside the screen, bounded so a short page
  // never reveals black at the bottom.
  const scrollY = interpolate(t, [0, 1], [1, 20]);

  const W = 560;
  const H = 1180;

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', perspective: 1400}}>
      <div
        style={{
          width: W,
          height: H,
          transform: `translateY(${float}px) scale(${scaleIn}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transformStyle: 'preserve-3d',
          borderRadius: 78,
          background: 'linear-gradient(160deg, #2A2B30 0%, #131418 60%, #060608 100%)',
          padding: 16,
          boxShadow: '0 60px 120px rgba(0,0,0,0.45), 0 8px 30px rgba(0,0,0,0.35)',
          opacity: enter,
        }}
      >
        <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 64, overflow: 'hidden', background: '#000'}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: '128%', transform: `translateY(-${scrollY}%)`}}>
            <SafeImg src={asset(src) as string} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block'}} />
          </div>
          {/* Dynamic island */}
          <div
            style={{
              position: 'absolute',
              top: 26,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 150,
              height: 38,
              borderRadius: 999,
              background: '#000',
            }}
          />
          {/* Soft screen glare (transparent white, never the grey-fringe keyword) */}
          <AbsoluteFill
            style={{
              background: 'linear-gradient(125deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
