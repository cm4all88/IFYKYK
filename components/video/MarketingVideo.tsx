import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Background} from './components/Background';
import {SceneRouter} from './SceneRouter';
import {buildScenes} from './scenes';
import {asset} from './lib/assets';
import {Captions} from './components/Captions';
import {VideoData} from './types';

// A subtle scale pop on each downbeat so the whole frame breathes with the music.
// Energy raises the amplitude in louder sections, so fast parts move more than quiet
// ones. Kept small on purpose: it should be felt, not seen.
const beatBreathe = (frame: number, data: VideoData): number => {
  const dbs = data.beats?.downbeatFrames;
  if (!dbs || !dbs.length) return 1;
  let last = -1;
  for (let i = 0; i < dbs.length; i++) {
    if (dbs[i] <= frame) last = dbs[i];
    else break;
  }
  if (last < 0) return 1;
  const t = frame - last;
  if (t > 9) return 1;
  const energy = data.beats?.energy;
  const hop = data.beats?.energyHopFrames || 15;
  const e = energy && energy.length ? energy[Math.min(energy.length - 1, Math.floor(frame / hop))] : 0.6;
  const amp = 0.006 + 0.01 * e; // 0.6% to 1.6% depending on loudness
  return 1 + amp * Math.exp(-t / 3.5);
};

export const MarketingVideo: React.FC<VideoData> = (data) => {
  const {durationInFrames} = useVideoConfig();
  const frame = useCurrentFrame();
  const breathe = beatBreathe(frame, data);
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
      <AbsoluteFill style={{transform: `scale(${breathe})`, transformOrigin: 'center center'}}>
        {planned.map((s, i) => {
          const clip = data.narrationByScene?.[s.id];
          const noCaption = s.id === 'intro' || s.id === 'cta' || s.id === 'hook';
          const cap = noCaption ? undefined : data.captionsByScene?.[s.id];
          const el = (
            <Sequence key={s.id} from={from} durationInFrames={s.durationInFrames} name={s.id} layout="none">
              <SceneRouter id={s.id} data={data} durationInFrames={s.durationInFrames} index={i} />
              {clip ? <Audio src={asset(clip.src) as string} /> : null}
              {cap ? <Captions words={cap.words} /> : null}
            </Sequence>
          );
          from += s.durationInFrames;
          return el;
        })}
      </AbsoluteFill>
      {data.captionsGlobal?.words?.length ? <Captions words={data.captionsGlobal.words} /> : null}
    </AbsoluteFill>
  );
};
