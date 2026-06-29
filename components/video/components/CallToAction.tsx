import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {Logo} from './Logo';
import {VideoData} from '../types';

const firstNameOf = (n?: string) => (n || '').trim().split(/\s+/)[0] || '';

export const CallToAction: React.FC<{
  cta: VideoData['cta'];
  goal?: 'subs' | 'platform';
  creatorName?: string;
  entryPrice?: number;
  offer?: string;
}> = ({cta, goal = 'subs', creatorName, entryPrice, offer}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const head = spring({frame: frame - 10, fps, config: {damping: 200}});
  const tail = spring({frame: frame - 24, fps, config: {damping: 200}});
  const offerS = spring({frame: frame - 18, fps, config: {damping: 200}});
  const pulse = 1 + 0.022 * Math.sin(frame / 11);

  const isSubs = goal === 'subs';
  const first = firstNameOf(creatorName);
  // For a subscriber reel the close is a direct join ask; for a platform reel it
  // keeps the brand line.
  const headline = isSubs ? (first ? `Get closer to ${first}.` : 'Become a member.') : cta.headline;
  const sub = isSubs ? (entryPrice != null ? `Memberships from $${entryPrice} a month` : cta.sub) : cta.sub;

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, textAlign: 'center', padding: '0 70px'}}>
      <Logo size={92} />
      {offer ? (
        <div
          style={{
            opacity: offerS,
            transform: `translateY(${interpolate(offerS, [0, 1], [16, 0])}px)`,
            fontFamily: theme.font.sans,
            fontWeight: 700,
            fontSize: 34,
            letterSpacing: '0.02em',
            color: theme.colors.goldDeep,
            background: 'rgba(240,180,41,0.12)',
            border: `1px solid ${theme.colors.gold}`,
            padding: '12px 30px',
            borderRadius: 999,
          }}
        >
          {offer}
        </div>
      ) : null}
      <div
        style={{
          opacity: head,
          transform: `translateY(${interpolate(head, [0, 1], [40, 0])}px)`,
          fontFamily: theme.font.sans,
          fontWeight: 800,
          fontSize: 92,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          color: theme.colors.ink,
          maxWidth: 920,
        }}
      >
        {headline}
      </div>
      {sub ? (
        <div style={{opacity: tail, fontFamily: theme.font.serif, fontStyle: 'italic', fontSize: 46, color: theme.colors.sub}}>
          {sub}
        </div>
      ) : null}
      {cta.url ? (
        <div
          style={{
            opacity: tail,
            transform: `translateY(${interpolate(tail, [0, 1], [20, 0])}px) scale(${pulse})`,
            marginTop: 8,
            fontFamily: theme.font.sans,
            fontWeight: 700,
            fontSize: 40,
            color: '#fff',
            background: `linear-gradient(90deg, ${theme.colors.gold}, ${theme.colors.goldDeep})`,
            padding: '24px 54px',
            borderRadius: 999,
            boxShadow: theme.colors.shadow,
          }}
        >
          {cta.url}
        </div>
      ) : null}
    </div>
  );
};
