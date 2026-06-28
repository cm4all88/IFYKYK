import React from 'react';
import {AbsoluteFill} from 'remotion';
import {VideoData} from './types';
import {SceneId} from './scenes';
import {Scene} from './components/Scene';
import {ShowcaseScene} from './components/ShowcaseScene';
import {SceneTitle} from './components/SceneTitle';
import {Logo} from './components/Logo';
import {AnimatedScreenshot} from './components/AnimatedScreenshot';
import {CreatorHeader} from './components/CreatorHeader';
import {MembershipCards} from './components/MembershipCards';
import {CampaignCard} from './components/CampaignCard';
import {MarketplaceGrid} from './components/MarketplaceGrid';
import {MerchGrid} from './components/MerchGrid';
import {CallToAction} from './components/CallToAction';

// Maps each scene id to its content. Scenes prefer crisp native cards when
// structured data is present, and fall back to an animated screenshot otherwise.
export const SceneRouter: React.FC<{id: SceneId; data: VideoData; durationInFrames: number}> = ({
  id,
  data,
  durationInFrames,
}) => {
  switch (id) {
    case 'intro':
      return (
        <Scene durationInFrames={durationInFrames}>
          <AbsoluteFill
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 60,
              padding: '0 80px',
            }}
          >
            <Logo size={150} />
            <SceneTitle headline={data.intro.headline} delay={16} />
          </AbsoluteFill>
        </Scene>
      );

    case 'profile':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} kicker="The creator" headline={data.creator.name}>
          {data.profileScreenshot ? (
            <AnimatedScreenshot
              src={data.profileScreenshot}
              durationInFrames={durationInFrames}
              panFrom={[50, 1]}
              panTo={[50, 99]}
            />
          ) : (
            <CreatorHeader creator={data.creator} />
          )}
        </ShowcaseScene>
      );

    case 'memberships':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} kicker="Memberships" headline="Recurring support, their way">
          {data.memberships?.length ? (
            <MembershipCards items={data.memberships} />
          ) : data.profileScreenshot ? (
            <AnimatedScreenshot src={data.profileScreenshot} durationInFrames={durationInFrames} />
          ) : null}
        </ShowcaseScene>
      );

    case 'campaign':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} kicker="Campaign" headline="Fund the next big thing">
          {data.campaign ? (
            <CampaignCard campaign={data.campaign} durationInFrames={durationInFrames} />
          ) : data.campaignScreenshot ? (
            <AnimatedScreenshot src={data.campaignScreenshot} durationInFrames={durationInFrames} fit="contain" />
          ) : null}
        </ShowcaseScene>
      );

    case 'posts':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} kicker="Exclusive posts" headline="Content for the inner circle">
          {data.feedScreenshots?.length ? (
            <AnimatedScreenshot
              src={data.feedScreenshots[0]}
              durationInFrames={durationInFrames}
              panFrom={[50, 2]}
              panTo={[50, 98]}
            />
          ) : null}
        </ShowcaseScene>
      );

    case 'marketplace':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} kicker="Marketplace" headline="Sell beyond the subscription">
          {data.marketplace?.length ? (
            <MarketplaceGrid items={data.marketplace} />
          ) : data.marketplaceScreenshot ? (
            <AnimatedScreenshot src={data.marketplaceScreenshot} durationInFrames={durationInFrames} />
          ) : null}
        </ShowcaseScene>
      );

    case 'merch':
      return (
        <ShowcaseScene durationInFrames={durationInFrames} kicker="Merch" headline="Their brand, in the real world">
          {data.merch?.length ? (
            <MerchGrid items={data.merch} />
          ) : data.merchScreenshot ? (
            <AnimatedScreenshot src={data.merchScreenshot} durationInFrames={durationInFrames} />
          ) : null}
        </ShowcaseScene>
      );

    case 'cta':
      return (
        <Scene durationInFrames={durationInFrames}>
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
            <CallToAction cta={data.cta} />
          </AbsoluteFill>
        </Scene>
      );

    default:
      return null;
  }
};
