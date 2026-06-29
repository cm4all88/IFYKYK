import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {camera, enterIn, exitFade} from '../lib/animations';

// Wraps each scene with a clean entrance (rise / slide / scale-blur, cycled by
// seed), continuous camera motion so nothing is ever static, and a quick fade out
// at the tail so cuts read as transitions.
export const Scene: React.FC<{durationInFrames: number; seed?: number; children: React.ReactNode}> = ({
  durationInFrames,
  seed = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cam = camera(frame, durationInFrames, seed);
  const ent = enterIn(frame, fps, seed);
  const opacity = Math.min(ent.opacity, exitFade(frame, durationInFrames));
  const blur = ent.blur > 0.4 ? `blur(${ent.blur}px)` : undefined;
  return (
    <AbsoluteFill style={{transform: cam.transform}}>
      <AbsoluteFill style={{opacity, transform: ent.transform, filter: blur}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
