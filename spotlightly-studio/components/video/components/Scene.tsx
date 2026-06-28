import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {dissolve} from '../lib/animations';

// Wraps each scene with a soft dissolve and a barely-there push-in for cinematic life.
export const Scene: React.FC<{durationInFrames: number; children: React.ReactNode}> = ({
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = dissolve(frame, durationInFrames);
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.015]);
  return <AbsoluteFill style={{opacity, transform: `scale(${scale})`}}>{children}</AbsoluteFill>;
};
