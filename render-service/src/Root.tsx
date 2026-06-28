import React from 'react';
import {Composition} from 'remotion';
import {MarketingVideo} from './MarketingVideo';
import {sampleData} from './data/sample';
import {calcMeta} from './scenes';
import {VideoData} from './types';

// One composition, fully data driven. Swap props (a JSON file) to make a new
// video without touching any code. See README for batch rendering.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MarketingVideo"
      component={MarketingVideo}
      durationInFrames={1000}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={sampleData as VideoData}
      calculateMetadata={calcMeta}
    />
  );
};
