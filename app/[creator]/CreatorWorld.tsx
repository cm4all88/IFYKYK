import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { hasSecret } from "@/lib/settings";
import { blurDataUrl } from "@/lib/blur";
import { bunnySignUrl, bunnyImage, bunnyImageSrcSet } from "@/lib/bunny";
import type { ReactNode, CSSProperties } from "react";

import SiteHeader from "@/components/site-header";
import CreatorFooter from "@/components/CreatorFooter";
import SocialPostsGrid from "@/components/SocialPostsGrid";
import SuccessBanner from "./SuccessBanner";
import BackerCodeBanner from "./BackerCodeBanner";
import ReferralTracker from "./ReferralTracker";
import NowStrip from "./NowStrip";
import LivePlayer from "./LivePlayer";
import TheRoom from "./TheRoom";
import FreeTierCard from "./FreeTierCard";
import SubscribeButton from "./SubscribeButton";
import CampaignDonateButton from "./CampaignDonateButton";
import CampaignTiers from "./CampaignTiers";
import SuperTipButton from "./SuperTipButton";
import TipButton from "./TipButton";
import GiftSubscriptionButton from "./GiftSubscriptionButton";
import MessageButton from "./MessageButton";
import CreatorMerch from "./CreatorMerch";
import CreatorMarketplace from "./CreatorMarketplace";
import DigitalProductCard from "./DigitalProductCard";

// ─────────────────────────────────────────────────────────────────────────────
// ONE creator page. Not a profile, a world. The hierarchy is fixed and is the
// whole point:
//   1. The creator is the largest thing here. Face, name, voice. No "buy" yet.
//   2. The feed is the spine. Their actual content, central and large. It is
//      what makes someone subscribe, back a goal, or tip, so it comes first.
//   3. Support comes after value. The first ask appears only below the feed.
//   4. Campaign and subscription are peers, side by side. Neither takes over.
//   5. Empty sections never render. No "coming soon" anywhere.
//   6. The page is complete with no campaign, no merch, no marketplace, no
//      subscription. Strip every paid module and the world still stands.
// Locked media is served securely: a non-entitled viewer only ever receives a
// server-made blurred placeholder, never the original.
// ─────────────────────────────────────────────────────────────────────────────

function usd(n: number) { return "$" + Math.round(n).toLocaleString("en-US"); }
function firstSentence(s: string) { const m = s.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : s).trim(); }
function clamp(s: string, n: number) { return s.length > n ? s.slice(0, n).trimEnd() + "…" : s; }
function firstName(name: string) { return (name || "").trim().split(/\s+/)[0] || name; }
function isFree(p: any) { return p.lock_type ? p.lock_type === "free" : p.tier === "free"; }
function ago(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime(); if (Number.isNaN(t)) return null;
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  const d = Math.floor(s / 86400);
  if (d < 30) return d + "d ago";
  if (d < 365) return Math.floor(d / 30) + "mo ago";
  return Math.floor(d / 365) + "y ago";
}

const MONO = "var(--font-mono, 'DM Mono', monospace)";
const DISPLAY = "var(--font-display, 'Plus Jakarta Sans', sans-serif)";
const SERIF = "var(--font-serif, 'Cormorant Garamond', Georgia, serif)";

function SectionLabel({ children, center }: { children: ReactNode; center?: boolean }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16, textAlign: center ? "center" : "left" }}>
      {children}
    </div>
  );
}

async function loadWorld(handle: string) {
  const supabase = await createClient();

  const { data: spotlight } = await supabase
    .from("creator_profiles").select("*").eq("kind", "spotlight").eq("handle", handle).maybeSingle();
  if (!spotlight || (spotlight as any).deleted_at) return null;
  const sp: any = spotlight;

  const { data: { user } } = await supabase.auth.getUser();

  // Founding creator: among the first 100 spotlight creators by signup.
  const { count: earlier } = await (supabase as any)
    .from("creator_profiles").select("id", { count: "exact", head: true })
    .eq("kind", "spotlight").lt("created_at", sp.created_at);
  const isFounder = (earlier ?? 0) < 100;

  // Campaign: a support option, never the page. Optional.
  const { data: campaigns } = await (supabase as any)
    .from("campaigns").select("*, donations:campaign_donations(amount)")
    .eq("creator_profile_id", sp.id).eq("status", "active").order("created_at", { ascending: false });
  const firstCampaign: any = (campaigns ?? [])[0] ?? null;
  let campaign: any = null;
  if (firstCampaign) {
    const { data: tiers } = await (supabase as any)
      .from("campaign_tiers").select("*").eq("campaign_id", firstCampaign.id)
      .order("sort_order", { ascending: true }).order("amount", { ascending: true });
    const donations = firstCampaign.donations ?? [];
    campaign = {
      ...firstCampaign,
      raised: donations.reduce((s: number, d: any) => s + Number(d.amount), 0),
      backers: donations.length,
      tiers: tiers ?? [],
    };
  }

  const { count: subscriberCount } = await (supabase as any)
    .from("subscriptions").select("id", { count: "exact", head: true })
    .eq("creator_profile_id", sp.id).eq("status", "active");

  const { data: subscriptionTiers } = await (supabase as any)
    .from("subscription_tiers")
    .select("id, name, description, price_monthly, price_yearly, perks, color, sort_order")
    .eq("creator_profile_id", sp.id).eq("is_active", true).order("sort_order", { ascending: true });

  const { data: posts } = await supabase
    .from("posts")
    .select("id, caption, media_url, media_type, tier, lock_type, required_tier_id, is_pinned, created_at")
    .eq("creator_profile_id", sp.id).eq("status", "live")
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false }).limit(18);

  // Viewer entitlement: a real, active subscription at or above the required
  // tier unlocks a post. Everyone else only ever gets the blur.
  let viewerTierId: string | null = null;
  let viewerSubscribed = false;
  if (user) {
    const { data: sub } = await (supabase as any)
      .from("subscriptions").select("tier_id")
      .eq("creator_profile_id", sp.id).eq("status", "active").maybeSingle();
    viewerSubscribed = !!sub;
    viewerTierId = (sub as any)?.tier_id ?? null;
  }
  const tierRank: Record<string, number> = {};
  (subscriptionTiers ?? []).forEach((t: any, i: number) => { tierRank[t.id] = i; });
  const viewerRank = viewerTierId != null ? (tierRank[viewerTierId] ?? -1) : -1;
  const tierNameOf = (id: string | null) =>
    id ? ((subscriptionTiers ?? []).find((t: any) => t.id === id)?.name ?? "this tier") : null;

  function entitled(p: any): boolean {
    if (isFree(p)) return true;
    if (p.lock_type === "purchase") return false;
    if (!viewerSubscribed) return false;
    if (!p.required_tier_id) return true;
    return viewerRank >= (tierRank[p.required_tier_id] ?? 0);
  }

  const ranked = ((posts ?? []) as any[])
    .sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned))
    .slice(0, 12);

  // SECURITY: the original media_url is included ONLY for an entitled viewer.
  // A locked image becomes a server-made blurred mush; a locked video gets no
  // media at all. The client never receives the original of a locked post.
  const content = await Promise.all(ranked.map(async (p: any) => {
    const ent = entitled(p);
    const mt = String(p.media_type ?? "");
    const isImg = mt.startsWith("image");
    const isVid = mt.startsWith("video");
    let blur: string | null = null;
    if (!ent && isImg && p.media_url) blur = await blurDataUrl(p.media_url);
    return {
      id: p.id,
      caption: p.caption ?? null,
      isImg, isVid,
      entitled: ent,
      mediaUrl: ent && p.media_url ? bunnySignUrl(p.media_url) : null,
      blur,
      lockTierName: tierNameOf(p.required_tier_id ?? null),
    };
  }));

  const { data: socialPosts } = await (supabase as any)
    .from("social_posts").select("*").eq("creator_id", sp.id)
    .order("pinned", { ascending: false }).order("original_posted_at", { ascending: false, nullsFirst: false });

  // Live right now (what they are doing this moment).
  const { data: liveStream } = await (supabase as any)
    .from("live_streams").select("*").eq("creator_profile_id", sp.id).eq("status", "live").maybeSingle();

  // Quiet modules. We fetch only counts here; the client modules fetch their own
  // detail, but we never MOUNT them unless there is something, so their built-in
  // "coming soon" / "nothing listed" boxes can never render (principle 5).
  const [{ count: merchCount }, { count: marketCount }] = await Promise.all([
    (supabase as any).from("merch_products").select("id", { count: "exact", head: true })
      .eq("creator_profile_id", sp.id).eq("status", "active"),
    (supabase as any).from("marketplace_listings").select("id", { count: "exact", head: true })
      .eq("creator_profile_id", sp.id).eq("status", "active"),
  ]);

  const { data: digitalProducts } = await (supabase as any)
    .from("digital_products")
    .select("id, title, description, price, category, thumbnail_url, preview_description, total_sales")
    .eq("creator_profile_id", sp.id).eq("status", "active")
    .order("created_at", { ascending: false }).limit(8);

  const stripeReady = await hasSecret("STRIPE_SECRET_KEY");

  return {
    sp, isFounder, campaign,
    subscriberCount: subscriberCount ?? 0,
    subscriptionTiers: (subscriptionTiers ?? []) as any[],
    content,
    socialPosts: (socialPosts ?? []) as any[],
    liveStream: liveStream ?? null,
    merchCount: merchCount ?? 0,
    marketCount: marketCount ?? 0,
    digitalProducts: (digitalProducts ?? []) as any[],
    loggedIn: !!user,
    stripeReady,
    lastActiveLabel: ago((posts as any[])?.[0]?.created_at ?? null),
  };
}

export default async function CreatorWorld({ handle }: { handle: string }) {
  const data = await loadWorld(handle);
  if (!data) notFound();

  const {
    sp, isFounder, campaign, subscriberCount, subscriptionTiers,
    content, socialPosts, liveStream, merchCount, marketCount, digitalProducts, loggedIn,
    lastActiveLabel,
  } = data;

  const displayName = sp.display_name || sp.handle;
  const fn = firstName(displayName);
  const bgImg = sp.bg_url || sp.cover_url || null;
  const fromPrice = subscriptionTiers.length
    ? Math.min(...subscriptionTiers.map((t: any) => Number(t.price_monthly)))
    : (sp.subscription_price ? Number(sp.subscription_price) : null);

  const hasFeed = content.length > 0 || socialPosts.length > 0;
  const hasDigital = (digitalProducts ?? []).length > 0;

  const campaignGoal = campaign ? Number(campaign.goal_amount ?? campaign.goal ?? 0) : 0;
  const campaignPct = campaign && campaignGoal > 0
    ? Math.min(100, Math.round((Number(campaign.raised) / campaignGoal) * 100)) : 0;

  const peerCard: CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "24px 22px",
  };

  return (
    <>
      <SiteHeader />
      <SuccessBanner />
      <BackerCodeBanner />
      <ReferralTracker creatorHandle={sp.handle} />

      <main style={{ minHeight: "100vh", position: "relative", background: "#09090C" }}>
        {bgImg ? (
          <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bunnyImage(bgImg, { width: 1920, quality: 82 })}
              srcSet={bunnyImageSrcSet(bgImg, [768, 1280, 1920, 2560], { quality: 82 })}
              sizes="100vw"
              alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(9,9,12,0.30) 0%, rgba(9,9,12,0.58) 34%, rgba(9,9,12,0.86) 72%, rgba(9,9,12,0.95) 100%)" }} />
          </div>
        ) : null}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1040, margin: "0 auto", padding: "0 24px" }}>

          {/* ── 1. THE CREATOR — the largest thing on the page. No ask yet. ── */}
          <header style={{ textAlign: "center", paddingTop: 72, maxWidth: 760, margin: "0 auto" }}>
            <div aria-hidden style={{ position: "absolute", inset: "0 0 auto 0", height: 520, background: "radial-gradient(ellipse 60% 44% at 50% 0%, rgba(242,184,75,0.13), transparent 70%)", pointerEvents: "none" }} />

            {sp.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bunnyImage(sp.avatar_url, { width: 264, quality: 85 })} alt={displayName} width={132} height={132}
                style={{ position: "relative", display: "block", margin: "0 auto", borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.10)", boxShadow: "0 18px 50px rgba(0,0,0,0.5)" }} />
            ) : (
              <div style={{ position: "relative", width: 132, height: 132, borderRadius: "50%", margin: "0 auto", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 52, color: "var(--accent)" }}>
                {(displayName[0] || "?").toUpperCase()}
              </div>
            )}

            {isFounder ? (
              <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 999, background: "var(--accent-soft, rgba(242,184,75,0.12))", border: "1px solid var(--accent-border, rgba(242,184,75,0.3))", fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)" }}>
                ✦ Founding Creator
              </div>
            ) : null}

            <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: "clamp(46px, 8vw, 88px)", lineHeight: 1.0, letterSpacing: "-0.015em", color: "var(--text, #fff)", margin: "18px 0 6px" }}>
              {displayName}
            </h1>
            <div style={{ fontFamily: MONO, fontSize: 13, color: "var(--muted)", letterSpacing: "0.05em" }}>@{sp.handle}</div>

            {sp.bio ? (
              <p style={{ fontFamily: DISPLAY, fontSize: 19, lineHeight: 1.72, color: "rgba(247,243,236,0.82)", maxWidth: 600, margin: "26px auto 0" }}>
                {clamp(String(sp.bio), 460)}
              </p>
            ) : null}
          </header>

          {/* ── 2. NOW — the pulse, then live if it is happening this moment ── */}
          <div style={{ marginTop: 34, display: "flex", justifyContent: "center" }}>
            <NowStrip
              isLive={!!liveStream}
              liveTitle={(liveStream as any)?.title ?? null}
              lastActiveLabel={lastActiveLabel}
              postCount={content.length}
              campaign={campaign ? { title: String(campaign.title ?? "the goal"), pct: campaignPct } : null}
            />
          </div>

          {liveStream && (liveStream as any).playback_url ? (
            <section style={{ marginTop: 26 }}>
              <SectionLabel center>● Live right now</SectionLabel>
              <div style={{ maxWidth: 880, margin: "0 auto", borderRadius: 16, overflow: "hidden", border: "1px solid var(--accent-border, rgba(242,184,75,0.3))" }}>
                <LivePlayer playbackUrl={(liveStream as any).playback_url} title={(liveStream as any).title ?? "Live"} />
              </div>
            </section>
          ) : null}

          {/* ── 3. THE FEED — the spine. Their content, central and large. ── */}
          {content.length > 0 ? (
            <section style={{ marginTop: 64 }}>
              <SectionLabel center>Inside {fn}&apos;s world</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 14 }}>
                {content.map((p: any) => (
                  <div key={p.id} style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                    {p.entitled && p.mediaUrl && p.isImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.mediaUrl} alt="" style={{ width: "100%", height: 256, objectFit: "cover", display: "block" }} />
                    ) : p.entitled && p.mediaUrl && p.isVid ? (
                      <video src={p.mediaUrl} controls preload="metadata" muted playsInline style={{ width: "100%", height: 256, objectFit: "cover", display: "block", background: "#000" }} />
                    ) : p.blur ? (
                      <div style={{ position: "relative", height: 256, overflow: "hidden" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.blur} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "blur(8px)", transform: "scale(1.15)" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(9,9,12,0.34)" }}>
                          <span style={{ fontSize: 20 }}>🔒</span>
                          <a href="#support" style={{ fontSize: 12, color: "#0A0A0D", background: "var(--accent)", padding: "8px 16px", borderRadius: 999, textDecoration: "none", fontWeight: 700 }}>
                            {p.lockTierName ? `Join ${p.lockTierName} to see` : "Subscribe to see"}
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: 256, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "linear-gradient(160deg, rgba(242,184,75,0.06), rgba(255,255,255,0.02))" }}>
                        <span style={{ fontSize: 20 }}>🔒</span>
                        <a href="#support" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>
                          {p.lockTierName ? `Join ${p.lockTierName} to see` : "Subscribe to see"}
                        </a>
                      </div>
                    )}
                    {p.caption ? (
                      <div style={{ padding: "12px 14px", fontSize: 13, color: "rgba(247,243,236,0.82)", lineHeight: 1.5 }}>{clamp(String(p.caption), 120)}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {socialPosts.length > 0 ? (
            <section style={{ marginTop: content.length > 0 ? 56 : 64 }}>
              <SectionLabel center>From around the web</SectionLabel>
              <SocialPostsGrid posts={socialPosts} />
            </section>
          ) : null}

          {/* ── 4. SUPPORT — only after the work. Campaign + community as peers. ── */}
          <section id="support" style={{ marginTop: hasFeed ? 80 : 64, scrollMarginTop: 90, paddingTop: 36, borderTop: "1px solid var(--border)" }}>
            <SectionLabel center>Support {fn}</SectionLabel>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, alignItems: "start", maxWidth: campaign ? 920 : 480, margin: "0 auto" }}>

              {/* Peer A — back the goal (only if there is a real campaign) */}
              {campaign ? (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>
                    Back {fn}&apos;s goal
                  </div>
                  <div className="ring-gold" style={peerCard}>
                    <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 21, lineHeight: 1.2, color: "var(--text)", margin: "0 0 8px" }}>{campaign.title}</h3>
                    {campaign.description ? (
                      <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 17, lineHeight: 1.5, color: "rgba(247,243,236,0.7)", margin: "0 0 18px" }}>
                        {firstSentence(String(campaign.description))}
                      </p>
                    ) : null}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, color: "var(--text)" }}>{usd(Number(campaign.raised))}</span>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>raised of {usd(campaignGoal)}</span>
                    </div>
                    <div style={{ height: 9, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ width: `${campaignPct}%`, height: "100%", background: "var(--accent)", borderRadius: 6 }} />
                    </div>
                    <div style={{ marginTop: 9, marginBottom: 18, fontFamily: MONO, fontSize: 12, letterSpacing: "0.04em", color: "var(--muted)" }}>
                      {campaignPct}% · {campaign.backers} {campaign.backers === 1 ? "person" : "people"} backing
                    </div>
                    <CampaignDonateButton campaignId={campaign.id} campaignTitle={campaign.title} />
                  </div>
                  {campaign.tiers && campaign.tiers.length > 0 ? (
                    <CampaignTiers campaignId={campaign.id} campaignTitle={campaign.title} tiers={campaign.tiers} />
                  ) : null}
                </div>
              ) : null}

              {/* Peer B — join the community (free follow + any subscription tiers) */}
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-soft, rgba(247,243,236,0.7))", marginBottom: 12 }}>
                  Join {fn}&apos;s community{fromPrice ? ` · from $${Number(fromPrice).toFixed(2)}/mo` : ""}
                </div>
                <FreeTierCard
                  name={sp.free_tier_name}
                  blurb={sp.free_tier_blurb}
                  perks={sp.free_tier_perks}
                  handle={sp.handle}
                  loggedIn={loggedIn}
                />
                <div style={{ marginTop: 14 }}>
                  <SubscribeButton creatorProfileId={sp.id} />
                </div>
              </div>
            </div>


            {/* Quiet community signal */}
            {(subscriberCount > 0 || isFounder) ? (
              <div style={{ maxWidth: 560, margin: "40px auto 0" }}>
                <TheRoom subscriberCount={subscriberCount} isFounder={isFounder} handle={sp.handle} />
              </div>
            ) : null}

            {/* One-time, quiet. The smallest weight on the page. */}
            <div style={{ marginTop: 40, textAlign: "center" }}>
              <SectionLabel center>One-time ways to support {fn}</SectionLabel>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <SuperTipButton creatorProfileId={sp.id} handle={sp.handle} />
                <TipButton creatorProfileId={sp.id} />
                <GiftSubscriptionButton creatorProfileId={sp.id} handle={sp.handle} />
                <MessageButton creatorProfileId={sp.id} handle={sp.handle} />
              </div>
            </div>
          </section>

          {/* ── Quiet shelves — only when they actually hold something ── */}
          {hasDigital ? (
            <section style={{ marginTop: 64 }}>
              <SectionLabel center>{fn}&apos;s digital store</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                {digitalProducts.map((pr: any) => (
                  <DigitalProductCard key={pr.id} product={pr} creatorProfileId={sp.id} />
                ))}
              </div>
            </section>
          ) : null}

          {merchCount > 0 ? (
            <section style={{ marginTop: 56, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
              <CreatorMerch creatorProfileId={sp.id} handle={sp.handle} />
            </section>
          ) : null}

          {marketCount > 0 ? (
            <section style={{ marginTop: 40, paddingBottom: 8, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
              <CreatorMarketplace creatorProfileId={sp.id} displayName={displayName} isSubscribed={false} />
            </section>
          ) : null}

          <div style={{ height: 72 }} />
        </div>
      </main>
      <CreatorFooter />
    </>
  );
}
