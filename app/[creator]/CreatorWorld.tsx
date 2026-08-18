import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { hasSecret } from "@/lib/settings";
import { blurDataUrl } from "@/lib/blur";
import { bunnySignUrl, bunnyImage, bunnyImageSrcSet } from "@/lib/bunny";
import CreatorFeed from "@/components/CreatorFeed";
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
//   4. Below the feed the store leads and the ask sits in a rail beside it.
//      On a phone that rail falls underneath, so the goods are met first.
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

  const { data: posts, error: postsErr } = await supabase
    .from("posts")
    .select("id, caption, media_url, media_urls, media_type, tier, lock_type, required_tier_id, is_pinned, created_at, likes_count, tags")
    .eq("creator_profile_id", sp.id).eq("status", "live")
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false }).limit(18);

  // A failed posts query renders as an empty feed, which looks exactly like a
  // creator who has not posted. Never let that happen silently: one missing
  // column on this select takes the whole feed down.
  if (postsErr) {
    console.error(`CREATOR FEED QUERY FAILED for ${handle}:`, postsErr);
  }

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
    // Unify old single-media and new gallery posts into one ordered list.
    const galleryRaw: { url: string; type: string }[] = Array.isArray(p.media_urls) && p.media_urls.length
      ? p.media_urls.filter((m: any) => m && m.url).map((m: any) => ({ url: String(m.url), type: m.type === "video" ? "video" : "image" }))
      : p.media_url
      ? [{ url: String(p.media_url), type: mt.startsWith("video") ? "video" : "image" }]
      : [];
    const coverType = galleryRaw[0]?.type ?? (mt.startsWith("video") ? "video" : "image");
    const isImg = coverType === "image";
    const isVid = coverType === "video";
    let blur: string | null = null;
    if (!ent && isImg && galleryRaw[0]?.url) blur = await blurDataUrl(galleryRaw[0].url);
    // SECURITY: signed gallery urls go ONLY to entitled viewers. Everyone else gets
    // an empty gallery and just the blurred cover.
    const mediaUrls = ent ? galleryRaw.map((m) => ({ url: bunnySignUrl(m.url), type: m.type })) : [];
    return {
      id: p.id,
      caption: p.caption ?? null,
      isImg, isVid,
      entitled: ent,
      mediaUrl: mediaUrls[0]?.url ?? null,
      mediaUrls,
      blur,
      lockTierName: tierNameOf(p.required_tier_id ?? null),
      tags: Array.isArray(p.tags) ? (p.tags as string[]).filter(Boolean) : [],
      likesCount: Number(p.likes_count) || 0,
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
    .select("id, title, description, price, category, thumbnail_url, preview_description, total_sales, bundled_product_ids, sale_price, sale_starts_at, sale_ends_at")
    .eq("creator_profile_id", sp.id).eq("status", "active")
    .order("created_at", { ascending: false }).limit(8);

  const stripeReady = await hasSecret("STRIPE_SECRET_KEY");

  // Does this creator have a code out in the world right now. Only a boolean
  // crosses to the client: promo_codes has no public read policy on purpose, so
  // this uses the service role and counts rather than selecting. Without it the
  // card would either show a code field to every visitor of every store, or
  // hide it so well that nobody with a code can find it.
  let codesAvailable = false;
  try {
    const { createServiceClient } = await import("@/lib/supabase-server");
    const service = await createServiceClient();
    const nowIso = new Date().toISOString();
    const { count, error } = await (service as any)
      .from("promo_codes")
      .select("id", { count: "exact", head: true })
      .eq("creator_profile_id", sp.id)
      .eq("active", true)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`);
    if (error) console.error("promo code availability check failed:", error);
    codesAvailable = (count ?? 0) > 0;
  } catch (e) {
    console.error("promo code availability check threw:", e);
  }

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
    codesAvailable,
    loggedIn: !!user,
    viewerSubscribed,
    viewerUserId: user?.id ?? null,
    stripeReady,
    lastActiveLabel: ago((posts as any[])?.[0]?.created_at ?? null),
  };
}

export default async function CreatorWorld({ handle }: { handle: string }) {
  const data = await loadWorld(handle);
  if (!data) notFound();

  const {
    sp, isFounder, campaign, subscriberCount, subscriptionTiers,
    content, socialPosts, liveStream, merchCount, marketCount, digitalProducts, codesAvailable, loggedIn,
    viewerSubscribed, viewerUserId,
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
  // Is there anything to buy at all. With nothing on the shelf the two-column
  // layout collapses back to the single centered ask it always was.
  const hasStore = hasDigital || merchCount > 0 || marketCount > 0;

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
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(9,9,12,0.58) 0%, rgba(9,9,12,0.74) 32%, rgba(9,9,12,0.90) 64%, rgba(9,9,12,0.97) 100%)" }} />
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
              <CreatorFeed items={content as any} viewerUserId={viewerUserId} fn={fn} />
            </section>
          ) : null}

          {socialPosts.length > 0 ? (
            <section style={{ marginTop: content.length > 0 ? 56 : 64 }}>
              <SectionLabel center>From around the web</SectionLabel>
              <SocialPostsGrid posts={socialPosts} />
            </section>
          ) : null}

          {/* ── 4. THE SHELF AND THE ASK ──────────────────────────────────────
              What a visitor can actually buy leads. Subscribing sits beside it,
              not on top of it. The store column is first in the DOM, so a phone
              scrolls straight from the work into the goods and only meets the
              subscribe card after it. With nothing on the shelf the rail
              re-centers itself and the page reads exactly as it did before. */}
          <div
            id="support"
            className={hasStore ? "cw-market" : "cw-market cw-market--solo"}
            style={{ marginTop: hasFeed ? 76 : 56, scrollMarginTop: 90, paddingTop: 40, borderTop: "1px solid var(--border)" }}
          >

            {hasStore ? (
              <div className="cw-market-main">
                {hasDigital ? (
                  <section>
                    <SectionLabel>{fn}&apos;s digital store</SectionLabel>
                    <div className="cw-product-grid">
                      {digitalProducts.map((pr: any) => (
                        <DigitalProductCard
                          key={pr.id}
                          product={pr}
                          creatorProfileId={sp.id}
                          codesAvailable={codesAvailable}
                          bundleSavings={(() => {
                            const ids: string[] = pr.bundled_product_ids ?? [];
                            if (ids.length === 0) return undefined;
                            // What the same items would cost bought one at a time.
                            const full = (digitalProducts ?? [])
                              .filter((x: any) => ids.includes(x.id))
                              .reduce((sum: number, x: any) => sum + Number(x.price ?? 0), 0);
                            return full > Number(pr.price) ? full - Number(pr.price) : undefined;
                          })()}
                          bundleCovers={(() => {
                            const ids: string[] = pr.bundled_product_ids ?? [];
                            if (ids.length === 0) return undefined;
                            // Keep the creator's own ordering of the bundle.
                            return ids
                              .map((id) => (digitalProducts ?? []).find((x: any) => x.id === id)?.thumbnail_url)
                              .filter(Boolean) as string[];
                          })()}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {merchCount > 0 ? (
                  <section style={{ marginTop: hasDigital ? 52 : 0 }}>
                    <CreatorMerch creatorProfileId={sp.id} handle={sp.handle} />
                  </section>
                ) : null}

                {marketCount > 0 ? (
                  <section style={{ marginTop: hasDigital || merchCount > 0 ? 52 : 0 }}>
                    {/* Subscriber-only listings were hidden from real subscribers
                        while this was hard-coded false. */}
                    <CreatorMarketplace creatorProfileId={sp.id} displayName={displayName} isSubscribed={viewerSubscribed} />
                  </section>
                ) : null}
              </div>
            ) : null}

            {/* The rail. Recurring support, the goal, then the quiet one-time ways. */}
            <aside className="cw-market-rail">

              <div>
                <SectionLabel>
                  Join {fn}&apos;s community{fromPrice ? ` · from $${Number(fromPrice).toFixed(2)}/mo` : ""}
                </SectionLabel>
                <FreeTierCard
                  name={sp.free_tier_name}
                  blurb={sp.free_tier_blurb}
                  perks={sp.free_tier_perks}
                  handle={sp.handle}
                  loggedIn={loggedIn}
                />
                <SubscribeButton creatorProfileId={sp.id} />
              </div>

              {campaign ? (
                <div>
                  <SectionLabel>Back {fn}&apos;s goal</SectionLabel>
                  <div className="ring-gold" style={peerCard}>
                    <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, lineHeight: 1.2, color: "var(--text)", margin: "0 0 8px" }}>{campaign.title}</h3>
                    {campaign.description ? (
                      <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 16, lineHeight: 1.5, color: "rgba(247,243,236,0.7)", margin: "0 0 18px" }}>
                        {firstSentence(String(campaign.description))}
                      </p>
                    ) : null}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 19, color: "var(--text)" }}>{usd(Number(campaign.raised))}</span>
                      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>raised of {usd(campaignGoal)}</span>
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

              {/* One-time, quiet. The smallest weight on the page. */}
              <div>
                <SectionLabel>One-time ways to support {fn}</SectionLabel>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <SuperTipButton creatorProfileId={sp.id} handle={sp.handle} />
                  <TipButton creatorProfileId={sp.id} />
                  <GiftSubscriptionButton creatorProfileId={sp.id} handle={sp.handle} />
                  <MessageButton creatorProfileId={sp.id} handle={sp.handle} />
                </div>
              </div>

              {/* Quiet community signal */}
              {subscriberCount > 0 || isFounder ? (
                <TheRoom subscriberCount={subscriberCount} isFounder={isFounder} handle={sp.handle} />
              ) : null}

            </aside>
          </div>

          <div style={{ height: 72 }} />
        </div>
      </main>
      <CreatorFooter />
    </>
  );
}
