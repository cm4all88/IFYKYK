import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme} from '../theme';

// Persistent brand mark for the middle scenes.
export const Watermark: React.FC = () => (
  <AbsoluteFill
    style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 72, pointerEvents: 'none'}}
  >
    <div
      style={{
        fontFamily: theme.font.serif,
        fontSize: 40,
        color: theme.colors.ink,
        opacity: 0.5,
        letterSpacing: '-0.01em',
      }}
    >
      Spot<span style={{color: theme.colors.gold, opacity: 0.85}}>light</span>ly
    </div>
  </AbsoluteFill>
);
