import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, useVideoConfig} from 'remotion';
import {Background} from './components/Background';
import {SceneRouter} from './SceneRouter';
import {buildScenes} from './scenes';
import {asset} from './lib/assets';
import {VideoData} from './types';

export const MarketingVideo: React.FC<VideoData> = (data) => {
  const {durationInFrames} = useVideoConfig();
  const scenes = buildScenes(data);
  const vol = data.musicVolume ?? 0.6;
  let from = 0;
  return (
    <AbsoluteFill>
      <Background />
      {data.music ? (
        <Audio
          src={asset(data.music) as string}
          volume={(f) =>
            interpolate(f, [0, 30, durationInFrames - 45, durationInFrames], [0, vol, vol, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      ) : null}
      {scenes.map((s) => {
        const el = (
          <Sequence key={s.id} from={from} durationInFrames={s.durationInFrames} name={s.id} layout="none">
            <SceneRouter id={s.id} data={data} durationInFrames={s.durationInFrames} />
          </Sequence>
        );
        from += s.durationInFrames;
        return el;
      })}
    </AbsoluteFill>
  );
};
