import { createClient } from "@/lib/supabase-server";
import { isCreatorProfileLocked } from "@/lib/billing";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import CreatorFooter from "@/components/CreatorFooter";
import SuccessBanner from "./SuccessBanner";
import CampaignDonateButton from "./CampaignDonateButton";
import WishlistItemCard from "./WishlistItemCard";
import DigitalProductCard from "./DigitalProductCard";
import TiersSection from "./TiersSection";
import ReferralTracker from "./ReferralTracker";
import TierPicker from "./TierPicker";
import MessageButton from "./MessageButton";
import TipButton from "./TipButton";
import UnlockButton from "./UnlockButton";
import SuperTipButton from "./SuperTipButton";
import CommentSection from "./CommentSection";
import LiveStreamView from "@/components/LiveStreamView";
import CreatorStageClient from "./CreatorStageClient";
import AudienceRail from "./AudienceRail";
import CreatorMerch from "./CreatorMerch";
import GiftSubscriptionButton from "./GiftSubscriptionButton";
import SocialAddbacks from "./SocialAddbacks";
import CreatorMarketplace from "./CreatorMarketplace";
import SocialPostCard from "@/components/SocialPostCard";
import type { Metadata } from "next";

type AnyProfile = Record<string, any>;
type AnyChannel = Record<string, any>;
type AnyPost = Record<string, any>;

async function fetchEverything(handle: string) {
  const supabase = await createClient();

  const { data: spotlight } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("kind", "spotlight")
    .eq("handle", handle)
    .maybeSingle();

  if (!spotlight) return null;

  let backstageHandle: string | null = null;
  if (spotlight.linked) {
    const { data: backstage } = await supabase
      .from("creator_profiles")
      .select("handle, linked")
      .eq("user_id", spotlight.user_id)
      .eq("kind", "backstage")
      .maybeSingle();
    if (backstage?.linked) backstageHandle = backstage.handle as string;
  }

  const [{ data: channels }, { data: posts }] = await Promise.all([
    supabase
      .from("channels")
      .select("*")
      .eq("creator_profile_id", spotlight.id)
      .order("sort_order", { ascending: true, nullsFirst: false }),
    supabase
      .from("posts")
      .select("*")
      .eq("creator_profile_id", spotlight.id)
      .eq("status", "live").or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Fetch wishlist items (unpurchased)
  const { data: wishlistItems } = await (supabase as any)
    .from("wishlist_items")
    .select("*")
    .eq("creator_profile_id", spotlight.id)
    .eq("is_purchased", false)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: subscriptionTiers } = await (supabase as any)
    .from("subscription_tiers")
    .select("id, name, description, price_monthly, price_yearly, perks, color, sort_order")
    .eq("creator_profile_id", spotlight.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: digitalProducts } = await (supabase as any)
    .from("digital_products")
    .select("id, title, description, price, category, thumbnail_url, preview_description, total_sales")
    .eq("creator_profile_id", spotlight.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(12);

  // Fetch active campaigns
  const { data: socialPosts } = await (supabase as any)
    .from("social_posts")
    .select("*")
    .eq("creator_id", spotlight.id)
    .order("pinned", { ascending: false })
    .order("original_posted_at", { ascending: false, nullsFirst: false });

  const { data: campaigns } = await (supabase as any)
    .from("campaigns")
    .select("*, donations:campaign_donations(amount)")
    .eq("creator_profile_id", spotlight.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const campaignsWithProgress = (campaigns ?? []).map((c: any) => ({
    ...c,
    raised: (c.donations ?? []).reduce((sum: number, d: any) => sum + Number(d.amount), 0),
  }));

  // Check if current viewer is subscribed and which posts they've unlocked
  const { data: { user } } = await supabase.auth.getUser();
  let isSubscribed = false;
  let unlockedPostIds: Set<string> = new Set();
  let hasEarlyAccess = false;
  let viewerTierId: string | null = null;
  let likedPostIds: Set<string> = new Set();

  if (user) {
    const [{ data: sub }, { data: unlocks }, { data: earlyPass }] = await Promise.all([
      (supabase as any)
        .from("subscriptions")
        .select("id, tier_id")
        .eq("fan_user_id", user.id)
        .eq("creator_profile_id", spotlight.id)
        .eq("status", "active")
        .maybeSingle(),
      (supabase as any)
        .from("post_unlocks")
        .select("post_id")
        .eq("fan_user_id", user.id),
      (supabase as any)
        .from("early_access_passes")
        .select("id")
        .eq("fan_user_id", user.id)
        .eq("creator_profile_id", spotlight.id)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    isSubscribed = !!sub;
    viewerTierId = sub?.tier_id ?? null;
    unlockedPostIds = new Set((unlocks ?? []).map((u: any) => u.post_id));
    hasEarlyAccess = !!earlyPass;

    const postIds = (posts ?? []).map((p: any) => p.id);
    if (postIds.length) {
      const { data: myLikes } = await (supabase as any)
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);
      likedPostIds = new Set((myLikes ?? []).map((l: any) => l.post_id));
    }
  }

  // Check if creator is currently live
  const { data: liveStream } = await (supabase as any)
    .from("live_streams")
    .select("*")
    .eq("creator_profile_id", spotlight.id)
    .eq("status", "live")
    .maybeSingle();

  // Recent super tips (last 5, for Top Supporter display)
  const { data: superTips } = await (supabase as any)
    .from("super_tips")
    .select("fan_display_name, message, amount_usd, badge_expires_at")
    .eq("creator_profile_id", spotlight.id)
    .gt("badge_expires_at", new Date().toISOString())
    .order("amount_usd", { ascending: false })
    .limit(5);

  return {
    spotlight: spotlight as AnyProfile,
    backstageHandle,
    channels: (channels ?? []) as AnyChannel[],
    posts: (posts ?? []) as AnyPost[],
    isSubscribed,
    hasEarlyAccess,
    unlockedPostIds: Array.from(unlockedPostIds),
    likedPostIds: Array.from(likedPostIds),
    viewerUserId: user?.id ?? null,
    viewerTierId,
    campaigns: campaignsWithProgress,
    wishlistItems: wishlistItems ?? [],
    digitalProducts: digitalProducts ?? [],
    subscriptionTiers: subscriptionTiers ?? [],
    liveStream: liveStream ?? null,
    superTips: superTips ?? [],
    socialPosts: socialPosts ?? [],
  };
}

export async function generateMetadata(props: {
  params: Promise<{ creator: string }>;
}): Promise<Metadata> {
  const { creator } = await props.params;
  const data = await fetchEverything(creator);
  if (!data) return { title: "Not found · Spotlightly" };
  const name = data.spotlight.display_name ?? data.spotlight.handle;
  return {
    title: `${name} · Spotlightly`,
    description: data.spotlight.bio ?? `Follow ${name} on Spotlightly`,
    openGraph: {
      title: name,
      description: data.spotlight.bio ?? "",
      images: data.spotlight.cover_url ? [data.spotlight.cover_url] : [],
    },
  };
}

export default async function CreatorPage(props: {
  params: Promise<{ creator: string }>;
}) {
  const { creator } = await props.params;
  const data = await fetchEverything(creator);
  if (!data) notFound();

  const { spotlight, backstageHandle, channels, posts, isSubscribed, campaigns, wishlistItems, digitalProducts, subscriptionTiers, liveStream, socialPosts } = data;
  const displayName = spotlight.display_name ?? spotlight.handle;

  // Tier-gating: map each tier to its rank (sort_order). A post locked to a tier
  // is visible to subscribers at that rank or higher.
  const tierRanks: Record<string, number> = {};
  (subscriptionTiers ?? []).forEach((t: any) => { tierRanks[t.id] = t.sort_order ?? 0; });
  const viewerTierRank = data.viewerTierId != null ? (tierRanks[data.viewerTierId] ?? null) : null;

  return (
    <>
      <SiteHeader />
      <SuccessBanner />
      <ReferralTracker creatorHandle={spotlight.handle} />
      <main className="cp">
        <div className="cp-shell">

          {/* ── LEFT — the audience member's own lineup, always present ── */}
          <aside className="cp-rail cp-rail--left">
            <AudienceRail currentHandle={spotlight.handle} />
          </aside>

          {/* ── CENTER — the stage: who they are, and their work ── */}
          <div className="cp-center">
            <CreatorStageClient
              posts={posts as any}
              isSubscribed={isSubscribed}
              hasEarlyAccess={data.hasEarlyAccess}
              unlockedPostIds={data.unlockedPostIds ?? []}
              likedPostIds={data.likedPostIds ?? []}
              viewerUserId={data.viewerUserId}
              displayName={displayName}
              handle={spotlight.handle}
              bio={spotlight.bio ?? null}
              avatarUrl={spotlight.avatar_url ?? null}
              coverUrl={spotlight.cover_url ?? null}
              bgUrl={(spotlight as any).bg_url ?? null}
              creatorProfileId={spotlight.id}
              subscriptionPrice={spotlight.subscription_price ? Number(spotlight.subscription_price) : null}
              backstageHandle={backstageHandle}
              bookingUrl={(spotlight as any).booking_url ?? null}
              bookingLabel={(spotlight as any).booking_label ?? null}
              viewerTierRank={viewerTierRank}
              tierRanks={tierRanks}
              medalPoints={Number((spotlight as any).medal_points_total ?? 0)}
              medalCount={Number((spotlight as any).medal_count_total ?? 0)}
            >
              <></>
            </CreatorStageClient>

            {liveStream && (
              <div className="cp-live-banner">
                <LiveStreamView
                  streamId={liveStream.bunny_stream_id}
                  playbackUrl={liveStream.playback_url}
                  isCreator={false}
                  creatorHandle={spotlight.handle}
                  isBackstage={false}
                  embedded
                />
              </div>
            )}

            {socialPosts.length > 0 && (
              <section className="cp-center-section">
                <span className="cp-rail-kicker">From around the web</span>
                <div className="cp-social-grid">
                  {socialPosts.map((sp: any) => (
                    <SocialPostCard key={sp.id} post={sp} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT — everything this creator offers, scoped to their page ── */}
          <aside className="cp-rail cp-rail--right" id="cp-support">

            {/* Support — sticky so it stays in reach while reading the feed */}
            <div className="cp-support-block">
              <span className="cp-rail-kicker">Support {displayName}</span>
              <div className="cp-support-actions">
                <SubscribeButton creatorProfileId={spotlight.id} />
                <SuperTipButton creatorProfileId={spotlight.id} handle={spotlight.handle} />
                <TipButton creatorProfileId={spotlight.id} />
                <GiftSubscriptionButton creatorProfileId={spotlight.id} handle={spotlight.handle} />
                <MessageButton creatorProfileId={spotlight.id} handle={spotlight.handle} />
                {(spotlight as any).booking_url && (
                  <a href={(spotlight as any).booking_url} target="_blank" rel="noopener noreferrer" className="btn btn--secondary btn--small cp-rail-btn">
                    📅 {(spotlight as any).booking_label || "Book"}
                  </a>
                )}
              </div>
            </div>

            <CreatorMerch creatorProfileId={spotlight.id} handle={spotlight.handle} />

            {digitalProducts.length > 0 && (
              <div className="cp-rail-section">
                <span className="cp-rail-kicker">Digital products</span>
                <div className="cp-rail-grid">
                  {digitalProducts.map((pr: any) => (
                    <DigitalProductCard key={pr.id} product={pr} creatorProfileId={spotlight.id} />
                  ))}
                </div>
              </div>
            )}

            <CreatorMarketplace creatorProfileId={spotlight.id} displayName={displayName} isSubscribed={isSubscribed} />

            <SocialAddbacks creatorProfileId={spotlight.id} displayName={displayName} />

            {campaigns.length > 0 && (
              <div className="cp-rail-section">
                <span className="cp-rail-kicker">Campaigns</span>
                <div className="cp-campaign-list">
                  {campaigns.map((c: any) => {
                    const goal = Number(c.goal_amount) || 0;
                    const pct = goal > 0 ? Math.min(100, Math.round((Number(c.raised) / goal) * 100)) : 0;
                    return (
                      <div key={c.id} className="cp-campaign">
                        <div className="cp-campaign-head">
                          <h3>{c.title}</h3>
                          <CampaignDonateButton campaignId={c.id} campaignTitle={c.title} />
                        </div>
                        {c.description && <p className="cp-campaign-desc">{c.description}</p>}
                        <div className="cp-campaign-bar"><span style={{ width: `${pct}%` }} /></div>
                        <div className="cp-campaign-meta">${Number(c.raised).toLocaleString()} raised{goal > 0 ? ` of $${goal.toLocaleString()} · ${pct}%` : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {wishlistItems.length > 0 && (
              <div className="cp-rail-section">
                <span className="cp-rail-kicker">Wishlist</span>
                <div className="cp-rail-grid">
                  {wishlistItems.map((i: any) => (
                    <WishlistItemCard key={i.id} item={i} />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Mobile-only: jump to support without hunting for the rail */}
        <a href="#cp-support" className="cp-mobile-support">
          Subscribe to {displayName}
        </a>

        <style>{`
          /* ── Base ── */
          .cp { min-height: 100vh; background: #09090C; position: relative; }

          /* ── Three-column shell ── */
          .cp-shell {
            display: grid;
            grid-template-columns: 240px minmax(0, 1fr) 380px;
            gap: 32px;
            max-width: 1400px;
            margin: 0 auto;
            padding: 24px 32px 80px;
            align-items: start;
          }
          .cp-rail { min-width: 0; }
          .cp-center { min-width: 0; }

          /* The stage hero + feed sit inside the center column now — strip the
             full-bleed centering so they breathe inside the column instead. */
          .cp-center > section:first-child { padding-top: 32px !important; }

          .cp-rail--right {
            display: flex;
            flex-direction: column;
            gap: 28px;
          }
          .cp-support-block {
            position: sticky;
            top: 24px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--r-3);
            padding: 22px;
          }
          .cp-support-actions { display: flex; flex-direction: column; gap: 10px; }
          .cp-support-actions > * { width: 100%; }
          .cp-rail-btn { width: 100%; text-align: center; }

          .cp-rail-kicker {
            font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.22em;
            text-transform: uppercase; color: var(--muted-faint);
            display: block; margin-bottom: 14px;
          }
          .cp-rail-section { padding: 0; }
          .cp-rail-grid { display: flex; flex-direction: column; gap: 14px; }

          .cp-center-section { padding: 40px 0 0; }

          /* Mobile support bar (hidden on desktop) */
          .cp-mobile-support {
            display: none;
            position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
            text-align: center; text-decoration: none;
            font-family: var(--font-display); font-size: 14px; font-weight: 700;
            color: #09090C; background: var(--accent);
            padding: 16px; box-shadow: 0 -8px 30px rgba(0,0,0,0.5);
          }

          /* ── Responsive collapse ── */
          @media (max-width: 1100px) {
            .cp-shell {
              grid-template-columns: 1fr;
              gap: 0;
              padding: 0 0 96px;
            }
            .cp-rail--left { position: sticky; top: 0; z-index: 20; }
            .cp-center { padding: 0; }
            .cp-rail--right { padding: 8px 16px 0; gap: 24px; }
            .cp-support-block { position: static; }
            .cp-mobile-support { display: block; }
          }

          /* ── Stage hero ── */
          .cp-stage {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px 24px 48px;
            overflow: hidden;
          }
          .cp-stage-bg {
            position: absolute; inset: 0;
            pointer-events: none;
          }
          .cp-stage-cover-img {
            position: absolute; inset: 0;
            width: 100%; height: 100%;
            object-fit: cover;
            opacity: 0.45;
            filter: saturate(0.8) brightness(0.85);
          }
          .cp-stage-vignette {
            position: absolute; inset: 0;
            background: radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(9,9,12,0.45) 65%, rgba(9,9,12,0.82) 100%);
          }
          /* Spotlight beam — wide cone only, no vertical line */
          .cp-stage-beam-wide {
            position: absolute; top: 0; left: 50%; transform: translateX(-50%);
            width: min(700px, 80vw); height: 70%;
            background: radial-gradient(ellipse 60% 100% at 50% 0%, rgba(242,184,75,0.14) 0%, transparent 65%);
          }
          .cp-stage-floor {
            position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
            width: 60%; height: 200px;
            background: radial-gradient(ellipse 80% 60% at 50% 100%, rgba(242,184,75,0.06), transparent);
          }

          /* ── Stage inner content ── */
          .cp-stage-inner {
            position: relative; z-index: 1;
            display: flex; flex-direction: column;
            align-items: center; text-align: center;
            max-width: 600px;
          }
          .cp-stage-avatar-wrap {
            margin-bottom: 24px;
            position: relative;
          }
          .cp-stage-avatar-wrap::after {
            content: '';
            position: absolute; inset: -3px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(242,184,75,0.5), transparent 60%);
            pointer-events: none;
          }
          .cp-stage-avatar {
            width: 120px; height: 120px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid rgba(242,184,75,0.2);
            display: block;
          }
          .cp-stage-avatar-fallback {
            width: 120px; height: 120px;
            border-radius: 50%;
            background: rgba(242,184,75,0.1);
            border: 2px solid rgba(242,184,75,0.2);
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-serif);
            font-size: 48px; font-weight: 300; color: rgba(242,184,75,0.7);
          }
          .cp-stage-name {
            font-family: var(--font-serif);
            font-size: clamp(40px, 8vw, 72px);
            font-weight: 300;
            color: #fff;
            line-height: 1;
            letter-spacing: -0.02em;
            margin: 0 0 8px;
          }
          .cp-stage-handle {
            font-family: var(--font-mono);
            font-size: 12px;
            letter-spacing: 0.12em;
            color: rgba(242,184,75,0.6);
            margin: 0 0 20px;
          }
          .cp-stage-bio {
            font-size: 15px;
            color: rgba(242,242,240,0.6);
            line-height: 1.7;
            max-width: 480px;
            margin: 0 0 28px;
          }
          .cp-stage-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: center;
            margin-bottom: 20px;
          }

          /* ── Posts section label ── */
          .cp-posts-label {
            font-family: var(--font-mono);
            font-size: 9px;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.25);
            text-align: center;
            padding: 32px 0 8px;
          }

          /* ── Social links ── */
          .cp-social-links { display:flex; gap:var(--s-3); flex-wrap:wrap; margin-bottom:20px; justify-content:center; }
          .cp-social-link {
            font-family:var(--font-mono); font-size:10px; letter-spacing:.12em;
            text-transform:uppercase; color:rgba(242,242,240,0.4);
            text-decoration:none; padding:6px 12px;
            border:1px solid rgba(255,255,255,0.08); border-radius:4px;
            transition:all 0.15s;
          }
          .cp-social-link:hover { color:rgba(242,242,240,0.8); border-color:rgba(255,255,255,0.2); }

          /* ── Backstage link ── */
          .cp-backstage {
            display:flex; align-items:center; gap:var(--s-3);
            padding:var(--s-3) var(--s-5);
            background:rgba(168,85,247,0.06);
            border:1px solid rgba(168,85,247,0.2);
            border-radius:var(--r-2); text-decoration:none;
            margin-top:16px;
            transition:all 0.15s;
          }
          .cp-backstage:hover { background:rgba(168,85,247,0.1); }
          .cp-bs-tag { font-family:var(--font-mono); font-size:9px; letter-spacing:.2em; text-transform:uppercase; color:var(--accent-back); }
          .cp-bs-text { font-size:13px; color:rgba(242,242,240,0.7); }
          .cp-bs-arrow { color:var(--accent-back); font-size:16px; margin-left:auto; }

          /* ── Live player ── */
          .cp-live-banner { margin:0 auto; max-width:1100px; padding:0 var(--s-6) var(--s-6); border-radius:12px; overflow:hidden; }

          /* ── Content area ── */
          .cp-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 0 80px;
          }
          .cp-channels { padding:0 var(--s-6) var(--s-8); }
          .cp-channel-label { font-family:var(--font-mono); font-size:9px; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); margin:0 0 var(--s-4); }
          .cp-channel-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:var(--s-3); }
          .cp-channel-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-3); padding:var(--s-5); }
          .cp-channel-name { font-family:var(--font-serif); font-size:20px; font-weight:400; color:#fff; margin:0 0 var(--s-2); }
          .cp-channel-meta { font-family:var(--font-mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--accent); margin:0; font-weight:500; }
          .cp-channel-desc { font-size:13px; color:var(--muted); line-height:1.6; margin:var(--s-3) 0 0; }

          /* ── Top supporters ── */
          .cp-supporters { padding:0 var(--s-6) var(--s-8); }

          /* ── Campaigns ── */
          .cp-campaigns, .cp-digital, .cp-wishlist { padding:0 var(--s-6) var(--s-8); }
          .cp-section-title { font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:300; color:#fff; max-width:900px; margin:0 auto 16px; }
          .cp-card-grid { max-width:900px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:16px; }
          .cp-social-grid { max-width:900px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; align-items:start; }
          .cp-campaign-list { max-width:900px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
          .cp-campaign { background:#111115; border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:24px; }
          .cp-campaign-head { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:8px; }
          .cp-campaign-head h3 { font-size:18px; color:#fff; font-weight:600; margin:0; }
          .cp-campaign-desc { font-size:14px; color:rgba(255,255,255,0.6); margin:0 0 14px; line-height:1.6; }
          .cp-campaign-bar { height:6px; border-radius:3px; background:rgba(255,255,255,0.08); overflow:hidden; }
          .cp-campaign-bar span { display:block; height:100%; background:var(--accent); }
          .cp-campaign-meta { font-size:12px; color:rgba(255,255,255,0.5); margin-top:8px; font-family:'DM Mono',monospace; }

          /* ── Digital products ── */
          .cp-digital { padding:0 var(--s-6) var(--s-8); }

          /* ── Wishlist ── */
          .cp-wishlist { padding:0 var(--s-6) var(--s-8); }

          /* ── Tiers ── */
          .cp-tiers { padding:0 var(--s-6) var(--s-8); }

          /* ── Section heading ── */
          .cp-section-heading {
            font-family:var(--font-serif); font-size:24px; font-weight:300;
            color:#fff; margin:0 0 var(--s-5);
          }
          .cp-section-kicker {
            font-family:var(--font-mono); font-size:9px; letter-spacing:.2em;
            text-transform:uppercase; color:var(--muted); margin:0 0 var(--s-3); display:block;
          }

          /* ── Post gate ── */
          .cp-gate-blur { position:absolute; inset:0; backdrop-filter:blur(12px); background:rgba(10,10,15,0.5); }
          .cp-gate-overlay { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; text-align:center; gap:var(--s-3); padding:var(--s-6); }
          .cp-gate-icon { font-size:32px; }
          .cp-gate-label { font-family:var(--font-display); font-size:14px; font-weight:700; letter-spacing:.08em; color:var(--accent); margin:0; }
          .cp-gate-desc { font-size:13px; color:var(--muted); margin:0; max-width:260px; line-height:1.6; }
          .cp-gate-form { display:flex; flex-direction:column; align-items:center; gap:var(--s-2); }
          .cp-gate-btn { min-width:180px; }
          .cp-post-gate { position:relative; min-height:200px; display:flex; flex-direction:column; }

          /* ── Mobile ── */
          @media (max-width: 720px) {
            .cp-stage-name { font-size: clamp(32px, 10vw, 56px); }
            .cp-stage-avatar { width: 88px; height: 88px; }
            .cp-stage-avatar-fallback { width: 88px; height: 88px; font-size: 36px; }
            .cp-stage-actions { gap: 8px; }
            .cp-stage-actions .btn { flex: 1; min-width: 0; font-size: 11px; padding: 10px 12px; }
          }
        `}</style>
      </main>
      <CreatorFooter />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Action buttons — server components that check if integrations are ready
// ──────────────────────────────────────────────────────────────────

import { hasSecret } from "@/lib/settings";

async function SubscribeButton({ creatorProfileId }: { creatorProfileId: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const stripeReady = await hasSecret("STRIPE_SECRET_KEY");

  if (await isCreatorProfileLocked(supabase, creatorProfileId)) {
    return <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>This creator is currently unavailable.</p>;
  }

  // Load tiers
  const { data: tiers } = await (supabase as any)
    .from("subscription_tiers")
    .select("*")
    .eq("creator_profile_id", creatorProfileId)
    .eq("is_active", true)
    .order("monthly_price", { ascending: true });

  const activeTiers = tiers ?? [];

  if (!user) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <a href={`/fan-signup?return=${encodeURIComponent(`/?subscribe=${creatorProfileId}`)}`} className="btn btn--primary">
          Sign up to subscribe
        </a>
        <a href="/login" style={{ textAlign:"center", fontSize:12, color:"var(--muted)", textDecoration:"none" }}>
          Already have an account? Sign in
        </a>
      </div>
    );
  }

  // No tiers — simple subscribe button
  if (activeTiers.length === 0) {
    return (
      <form action="/api/subscribe" method="post">
        <input type="hidden" name="creator_profile_id" value={creatorProfileId} />
        <button type="submit" className="btn btn--primary" disabled={!stripeReady}>
          Subscribe
        </button>
      </form>
    );
  }

  // Has tiers — show tier cards with monthly/yearly toggle (client component)
  return <TierPicker tiers={activeTiers} creatorProfileId={creatorProfileId} stripeReady={stripeReady} />;
}
