import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Scene} from './Scene';
import {SceneTitle} from './SceneTitle';
import {Watermark} from './Watermark';

// Standard layout for the highlight scenes: title up top, the visual centered below.
export const ShowcaseScene: React.FC<{
  durationInFrames: number;
  seed?: number;
  kicker?: string;
  headline?: string;
  sub?: string;
  children: React.ReactNode;
}> = ({durationInFrames, seed = 0, kicker, headline, sub, children}) => (
  <Scene durationInFrames={durationInFrames} seed={seed}>
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '150px 80px 120px',
      }}
    >
      <SceneTitle kicker={kicker} headline={headline} sub={sub} />
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 70,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
    <Watermark />
  </Scene>
);
