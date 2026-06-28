'use client';

import React from 'react';
import {Player} from '@remotion/player';
import {MarketingVideo} from './video/MarketingVideo';
import {buildScenes} from './video/scenes';
import type {VideoData} from './video/types';

// Previews the marketing video live in the browser. Runs entirely client-side,
// so it works from any computer with no server render.
export default function StudioPlayer({data}: {data: VideoData}) {
  const duration = Math.max(1, buildScenes(data).reduce((a, s) => a + s.durationInFrames, 0));
  return (
    <Player
      component={MarketingVideo as React.FC<Record<string, unknown>>}
      inputProps={data as unknown as Record<string, unknown>}
      durationInFrames={duration}
      fps={30}
      compositionWidth={1080}
      compositionHeight={1920}
      style={{
        width: '100%',
        aspectRatio: '1080 / 1920',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 24px 70px rgba(23,24,27,0.22)',
        background: '#FBFAF7',
      }}
      controls
      loop
    />
  );
}
