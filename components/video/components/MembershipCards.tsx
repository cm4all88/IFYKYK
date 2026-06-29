import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {Membership} from '../types';

export const MembershipCards: React.FC<{items: Membership[]}> = ({items}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 30, width: 900}}>
      {items.slice(0, 3).map((m, i) => {
        const s = spring({frame: frame - 6 - i * 7, fps, config: {damping: 200}});
        const glow = 0.5 + 0.5 * Math.sin(frame / 18);
        const featuredShadow = m.featured
          ? `${theme.colors.shadow}, 0 0 ${36 + 24 * glow}px rgba(240,180,41,${0.14 + 0.14 * glow})`
          : theme.colors.shadow;
        return (
          <div
            key={i}
            style={{
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [44, 0])}px) scale(${interpolate(s, [0, 1], [0.94, 1])})`,
              background: theme.colors.cardBg,
              border: `1px solid ${m.featured ? theme.colors.gold : theme.colors.line}`,
              borderRadius: 32,
              padding: '40px 44px',
              boxShadow: featuredShadow,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 30,
            }}
          >
            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              <div style={{fontFamily: theme.font.serif, fontSize: 52, color: theme.colors.ink}}>
                {m.name}
              </div>
              {m.perks?.length ? (
                <div style={{fontFamily: theme.font.sans, fontSize: 30, color: theme.colors.sub, lineHeight: 1.4}}>
                  {m.perks.slice(0, 3).join('   .   ')}
                </div>
              ) : null}
            </div>
            <div style={{textAlign: 'right', whiteSpace: 'nowrap'}}>
              <span style={{fontFamily: theme.font.sans, fontWeight: 800, fontSize: 56, color: theme.colors.ink}}>
                {m.price}
              </span>
              <span style={{fontFamily: theme.font.sans, fontSize: 30, color: theme.colors.sub}}>
                {' '}/{m.cadence ?? 'mo'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
