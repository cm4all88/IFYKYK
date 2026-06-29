import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, useVideoConfig} from 'remotion';
import {Background} from './components/Background';
import {SceneRouter} from './SceneRouter';
import {buildScenes} from './scenes';
import {asset} from './lib/assets';
import {Captions} from './components/Captions';
import {VideoData} from './types';

export const MarketingVideo: React.FC<VideoData> = (data) => {
  const {durationInFrames} = useVideoConfig();
  const scenes = buildScenes(data);
  const sceneSum = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  const hasSceneVo = Boolean(data.narrationByScene && Object.keys(data.narrationByScene).length);
  const hasVo = Boolean(data.narration) || hasSceneVo;

  // If a single voiceover runs longer than the scenes, hold the last scene so the
  // visuals cover the whole narration. (Per-scene narration already fits each scene.)
  const tailPad = Math.max(0, durationInFrames - sceneSum);
  const planned = scenes.map((s, i) =>
    i === scenes.length - 1 ? {...s, durationInFrames: s.durationInFrames + tailPad} : s
  );

  // Duck the music under the voice when narration is present.
  const baseVol = data.musicVolume ?? 0.6;
  const musicVol = hasVo ? baseVol * 0.28 : baseVol;

  let from = 0;
  return (
    <AbsoluteFill>
      <Background cover={data.creator.cover} intensity={data.bgIntensity} />
      {data.music ? (
        <Audio
          src={asset(data.music) as string}
          volume={(f) =>
            interpolate(f, [0, 30, durationInFrames - 45, durationInFrames], [0, musicVol, musicVol, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      ) : null}
      {data.narration ? (
        <Audio
          src={asset(data.narration) as string}
          volume={(f) =>
            interpolate(f, [0, 8, durationInFrames - 10, durationInFrames], [0, 1, 1, 0.9], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      ) : null}
      {planned.map((s) => {
        const clip = data.narrationByScene?.[s.id];
        const cap = s.id !== 'intro' && s.id !== 'cta' ? data.captionsByScene?.[s.id] : undefined;
        const el = (
          <Sequence key={s.id} from={from} durationInFrames={s.durationInFrames} name={s.id} layout="none">
            <SceneRouter id={s.id} data={data} durationInFrames={s.durationInFrames} />
            {clip ? <Audio src={asset(clip.src) as string} /> : null}
            {cap ? <Captions words={cap.words} /> : null}
          </Sequence>
        );
        from += s.durationInFrames;
        return el;
      })}
    </AbsoluteFill>
  );
};
