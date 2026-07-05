import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {easeInOut, overFrames} from '../lib/animations';
import {CampaignData} from '../types';

export const CampaignCard: React.FC<{campaign: CampaignData; durationInFrames: number}> = ({
  campaign,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - 6, fps, config: {damping: 200}});
  const pct = Math.max(0, Math.min(100, campaign.pct));
  const fill = interpolate(easeInOut(overFrames(frame, Math.min(durationInFrames, 75))), [0, 1], [0, pct]);
  const glow = 0.5 + 0.5 * Math.sin(frame / 16);
  // A brand-new campaign with no traction: showing "$0 raised . 0% . 0 backers" reads as
  // failure and works against the point of the reel. Show it as a beginning instead. No
  // fake numbers, just honest, aspirational framing.
  const rawRaised = parseFloat(String(campaign.raised).replace(/[^0-9.]/g, '')) || 0;
  const hasTraction = rawRaised > 0 || pct > 0 || (campaign.backers ?? 0) > 0;
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [44, 0])}px)`,
        width: 900,
        background: theme.colors.cardBg,
        border: `1px solid ${theme.colors.line}`,
        borderRadius: 40,
        padding: 56,
        boxShadow: `${theme.colors.shadow}, 0 0 ${44 + 26 * glow}px rgba(240,180,41,${0.16 + 0.16 * glow})`,
        display: 'flex',
        flexDirection: 'column',
        gap: 30,
      }}
    >
      <div style={{fontFamily: theme.font.serif, fontSize: 60, color: theme.colors.ink, lineHeight: 1.05}}>
        {campaign.title}
      </div>

      {hasTraction ? (
        <>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap'}}>
            <span style={{fontFamily: theme.font.sans, fontWeight: 800, fontSize: 64, color: theme.colors.ink}}>
              {campaign.raised}
            </span>
            <span style={{fontFamily: theme.font.sans, fontSize: 34, color: theme.colors.sub}}>
              raised of {campaign.goal}
            </span>
          </div>
          <div style={{height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden'}}>
            <div
              style={{
                height: '100%',
                width: `${fill}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${theme.colors.gold}, ${theme.colors.goldDeep})`,
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: theme.font.sans,
              fontSize: 32,
              color: theme.colors.sub,
            }}
          >
            <span>{Math.round(fill)}% funded</span>
            {campaign.backers != null ? <span>{campaign.backers} backers</span> : null}
          </div>
        </>
      ) : (
        <>
          <div style={{fontFamily: theme.font.sans, fontWeight: 700, fontSize: 40, color: theme.colors.gold}}>
            Just getting started
          </div>
          <div style={{fontFamily: theme.font.sans, fontSize: 34, color: theme.colors.sub, lineHeight: 1.35}}>
            Chasing {campaign.goal}. Be one of the first to back it.
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${theme.colors.gold}, rgba(240,180,41,0))`,
              opacity: 0.6 + 0.4 * glow,
            }}
          />
        </>
      )}
    </div>
  );
};
