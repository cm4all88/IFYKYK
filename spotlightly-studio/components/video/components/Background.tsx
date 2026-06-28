import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

// The Spotlightly stage: warm white with a slow-breathing gold spotlight glow.
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const breathe = 0.5 + 0.5 * Math.sin(frame / 90);
  const glow = 0.06 + 0.05 * breathe;
  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg}}>
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
