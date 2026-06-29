import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {VideoData} from './types';
import {SceneId} from './scenes';
import {Scene} from './components/Scene';
import {ShowcaseScene} from './components/ShowcaseScene';
import {SceneTitle} from './components/SceneTitle';
import {Logo} from './components/Logo';
import {AnimatedScreenshot} from './components/AnimatedScreenshot';
import {PhoneMockup} from './components/PhoneMockup';
import {CreatorHeader} from './components/CreatorHeader';
import {MembershipCards} from './components/MembershipCards';
import {CampaignCard} from './components/CampaignCard';
import {MarketplaceGrid} from './components/MarketplaceGrid';
import {MerchGrid} from './components/MerchGrid';
import {PostsGrid} from './components/PostsGrid';
import {CallToAction} from './components/CallToAction';
import {HeroIntro} from './components/HeroIntro';
import {HookScene} from './components/HookScene';
import {PhotoBeat} from './components/PhotoBeat';
import {exitFade} from './lib/animations';

// Simple fade-only wrapper for full-bleed scenes, which manage their own motion
// (a slide would reveal the edges of a full-frame image).
const FadeScene: React.FC<{durationInFrames: number; children: React.ReactNode}> = ({durationInFrames, children}) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    interpolate(frame, [0, 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    exitFade(frame, durationInFrames)
  );
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

export const SceneRouter: React.FC<{id: SceneId; data: VideoData; durationInFrames: number; index?: number}> = ({
  id,
  data,
  durationInFrames,
  index = 0,
}) => {
  const seed = index;
  switch (id) {
    case 'hook':
      return <HookScene data={data} durationInFrames={durationInFrames} />;

    case 'photo1':
      return data.feedScreenshots?.[0] ? (
        <PhotoBeat src={data.feedScreenshots[0]} durationInFrames={durationInFrames} seed={seed} />
      ) : null;

    case 'photo2':
      return data.feedScreenshots?.[1] ? (
        <PhotoBeat src={data.feedScreenshots[1]} durationInFrames={durationInFrames} seed={seed} />
      ) : null;

    case 'photo3':
      return data.feedScreenshots?.[2] ? (
        <PhotoBeat src={data.feedScreenshots[2]} durationInFrames={durationInFrames} seed={seed} />
      ) : null;

    case 'intro':
      return data.creator.cover || data.creator.avatar ? (
        <FadeScene durationInFrames={durationInFrames}>
          <HeroIntro creator={data.creator} headline={data.intro.headline} durationInFrames={durationInFrames} />
        </FadeScene>
      ) : (
        <Scene durationInFrames={durationInFrames} seed={seed}>
          <AbsoluteFill
            style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 60, padding: '0 80px'}}
          >
            <Logo size={150} />
            <SceneTitle headline={data.intro.headline} delay={16} />
          </AbsoluteFill>
        </Scene>
      );

    case 'profile':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} seed={seed} kicker="The creator" headline={data.creator.name}>
          {data.profileScreenshot ? (
            <PhoneMockup src={data.profileScreenshot} durationInFrames={durationInFrames} seed={seed} />
          ) : (
            <CreatorHeader creator={data.creator} showCover={false} />
          )}
        </ShowcaseScene>
      );

    case 'memberships':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} seed={seed} kicker="Memberships" headline="Recurring support, their way">
          {data.memberships?.length ? (
            <MembershipCards items={data.memberships} />
          ) : data.profileScreenshot ? (
            <PhoneMockup src={data.profileScreenshot} durationInFrames={durationInFrames} seed={seed} />
          ) : null}
        </ShowcaseScene>
      );

    case 'campaign':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} seed={seed} kicker="Campaign" headline="Fund the next big thing">
          {data.campaign ? (
            <CampaignCard campaign={data.campaign} durationInFrames={durationInFrames} />
          ) : data.campaignScreenshot ? (
            <PhoneMockup src={data.campaignScreenshot} durationInFrames={durationInFrames} seed={seed} />
          ) : null}
        </ShowcaseScene>
      );

    case 'posts':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} seed={seed} kicker="Exclusive posts" headline="Content for the inner circle">
          {data.feedScreenshots?.length ? (
            data.feedScreenshots.length > 1 ? (
              <PostsGrid images={data.feedScreenshots} />
            ) : (
              <AnimatedScreenshot src={data.feedScreenshots[0]} durationInFrames={durationInFrames} panFrom={[50, 2]} panTo={[50, 98]} />
            )
          ) : null}
        </ShowcaseScene>
      );

    case 'marketplace':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} seed={seed} kicker="Marketplace" headline="Sell beyond the subscription">
          {data.marketplace?.length ? (
            <MarketplaceGrid items={data.marketplace} />
          ) : data.marketplaceScreenshot ? (
            <PhoneMockup src={data.marketplaceScreenshot} durationInFrames={durationInFrames} seed={seed} />
          ) : null}
        </ShowcaseScene>
      );

    case 'merch':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} seed={seed} kicker="Merch" headline="Their brand, in the real world">
          {data.merch?.length ? (
            <MerchGrid items={data.merch} />
          ) : data.merchScreenshot ? (
            <PhoneMockup src={data.merchScreenshot} durationInFrames={durationInFrames} seed={seed} />
          ) : null}
        </ShowcaseScene>
      );

    case 'cta': {
      const prices = (data.memberships ?? [])
        .map((m) => Number(String(m.price).replace(/[^0-9.]/g, '')))
        .filter((n) => Number.isFinite(n) && n > 0);
      const entryPrice = prices.length ? Math.min(...prices) : undefined;
      return (
        <Scene durationInFrames={durationInFrames} seed={seed}>
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
            <CallToAction
              cta={data.cta}
              goal={data.goal ?? 'subs'}
              creatorName={data.creator.name}
              entryPrice={entryPrice}
              offer={data.offer}
            />
          </AbsoluteFill>
        </Scene>
      );
    }

    default:
      return null;
  }
};
