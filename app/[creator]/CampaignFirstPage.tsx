import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { hasSecret } from "@/lib/settings";
import { blurDataUrl } from "@/lib/blur";
import { bunnySignUrl } from "@/lib/bunny";
import type { ReactNode } from "react";

import SiteHeader from "@/components/site-header";
import CreatorFooter from "@/components/CreatorFooter";
import SocialPostsGrid from "@/components/SocialPostsGrid";
import BackerCodeBanner from "./BackerCodeBanner";
import CampaignDonateButton from "./CampaignDonateButton";
import CampaignTiers from "./CampaignTiers";
import TheRoom from "./TheRoom";
import FreeTierCard from "./FreeTierCard";
import SubscribeButton from "./SubscribeButton";
import SuperTipButton from "./SuperTipButton";
import TipButton from "./TipButton";
import GiftSubscriptionButton from "./GiftSubscriptionButton";
import MessageButton from "./MessageButton";

// The adaptive Spotlightly creator page, campaign-first occupant.
// Rendered by app/[creator]/page.tsx when the creator has an active campaign.
// The campaign headlines; the creator's whole world stays on the page at the
// right weight. Support hierarchy: back the campaign (primary), subscribe /
// follow free (secondary), tip / super tip / gift / message (tertiary).
// Locked media is served securely: non-entitled viewers only ever receive a
// server-made blurred placeholder, never the original.

function usd(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}
function firstSentence(s: string) {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}
function clamp(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}
function isFree(p: any) {
  return p.lock_type ? p.lock_type === "free" : p.tier === "free";
}

function SpineLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--font-mono, 'DM Mono', monospace)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted)", textAlign: "center", marginBottom: 18 }}>
      {children}
    </div>
  );
}

async function loadCampaignFirst(handle: string) {
  const supabase = await createClient();

  const { data: spotlight } = await supabase
    .from("creator_profiles").select("*").eq("kind", "spotlight").eq("handle", handle).maybeSingle();
  if (!spotlight || (spotlight as any).deleted_at) return null;
  const sp: any = spotlight;

  const { data: { user } } = await supabase.auth.getUser();

  // Auto-detection signal: an active campaign with a goal.
  const { data: campaigns } = await (supabase as any)
    .from("campaigns").select("*, donations:campaign_donations(amount)")
    .eq("creator_profile_id", sp.id).eq("status", "active").order("created_at", { ascending: false });

  const first: any = (campaigns ?? [])[0] ?? null;
  let campaign: any = null;
  if (first) {
    const { data: tiers } = await (supabase as any)
      .from("campaign_tiers").select("*").eq("campaign_id", first.id)
      .order("sort_order", { ascending: true }).order("amount", { ascending: true });
    const donations = first.donations ?? [];
    campaign = {
      ...first,
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
    .from("posts").select("id, caption, media_url, media_type, tier, lock_type, required_tier_id, is_pinned, created_at")
    .eq("creator_profile_id", sp.id).eq("status", "live").order("created_at", { ascending: false }).limit(12);

  // Viewer entitlement: a real, active subscription at or above the required tier
  // unlocks a post. Everyone else only ever gets the blur.
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
    .slice(0, 9);

  // SECURITY: the original media_url is included ONLY for an entitled viewer.
  // A locked image becomes a server-made blurred mush; a locked video gets no
  // media at all. The client never receives the original of a locked post, so
  // there is nothing to open in a new tab or un-blur in dev tools.
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

  const stripeReady = await hasSecret("STRIPE_SECRET_KEY");

  return {
    sp, campaign,
    subscriberCount: subscriberCount ?? 0,
    subscriptionTiers: (subscriptionTiers ?? []) as any[],
    content,
    socialPosts: (socialPosts ?? []) as any[],
    loggedIn: !!user,
    stripeReady,
  };
}

export default async function CampaignFirstPage({ handle }: { handle: string }) {
  const data = await loadCampaignFirst(handle);
  if (!data || !data.campaign) notFound();
  const { sp, campaign, subscriberCount, subscriptionTiers, content, socialPosts, loggedIn } = data;

  const displayName = sp.display_name || sp.handle;
  const bgImg = sp.bg_url || sp.cover_url || null;
  const fromPrice = subscriptionTiers.length
    ? Math.min(...subscriptionTiers.map((t) => Number(t.price_monthly)))
    : (sp.subscription_price ? Number(sp.subscription_price) : null);

  const secondaryBtn: React.CSSProperties = {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14,
    padding: "11px 20px", borderRadius: 999, textDecoration: "none",
    background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)",
  };

  return (
    <>
      <SiteHeader />
      <BackerCodeBanner />
      <main
        style={
          bgImg
            ? {
                minHeight: "100vh",
                position: "relative",
                background: `linear-gradient(180deg, rgba(9,9,12,0.35) 0, rgba(9,9,12,0.58) 320px, rgba(9,9,12,0.82) 760px, rgba(9,9,12,0.9) 100%), url("${bgImg}") top center / cover no-repeat`,
              }
            : { minHeight: "100vh", position: "relative", background: "#09090C" }
        }
      >
        <div style={{ position: "relative", zIndex: 1, maxWidth: 920, margin: "0 auto", padding: "0 24px" }}>
          {campaign ? (
            <>
              <div aria-hidden style={{ position: "absolute", inset: "0 0 auto 0", height: 560, background: "radial-gradient(ellipse 58% 42% at 50% 0%, rgba(242,184,75,0.14), transparent 70%)", pointerEvents: "none" }} />

              {/* ── STAGE: the campaign headlines, support hierarchy in reach ── */}
              <section style={{ position: "relative", textAlign: "center", paddingTop: 60, maxWidth: 720, margin: "0 auto" }}>
                <div style={{ fontFamily: "var(--font-mono, 'DM Mono', monospace)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 18, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                  Raising now
                </div>

                <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(32px, 5.5vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--text, #fff)", margin: "0 auto 14px", maxWidth: 680 }}>
                  {campaign.title}
                </h1>

                {campaign.description ? (
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 20, lineHeight: 1.5, color: "rgba(247,243,236,0.72)", maxWidth: 560, margin: "0 auto 24px" }}>
                    {firstSentence(String(campaign.description))}
                  </p>
                ) : null}

                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
                  {sp.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sp.avatar_url} alt="" width={34} height={34} style={{ borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)" }} />
                  )}
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{displayName}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>@{sp.handle}</div>
                  </div>
                </div>

                {(() => {
                  const goal = Number(campaign.goal_amount ?? campaign.goal ?? 0);
                  const pct = goal > 0 ? Math.min(100, Math.round((Number(campaign.raised) / goal) * 100)) : 0;
                  return (
                    <div style={{ maxWidth: 460, margin: "0 auto 24px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                        <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 22, color: "var(--text)" }}>{usd(Number(campaign.raised))}</span>
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>raised of {usd(goal)}</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", borderRadius: 6 }} />
                      </div>
                      <div style={{ marginTop: 10, fontFamily: "var(--font-mono, 'DM Mono', monospace)", fontSize: 12, letterSpacing: "0.04em", color: "var(--muted)" }}>
                        {pct}% · {campaign.backers} {campaign.backers === 1 ? "person" : "people"} backing
                      </div>
                    </div>
                  );
                })()}

                {/* primary: back the campaign */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <CampaignDonateButton campaignId={campaign.id} campaignTitle={campaign.title} />
                </div>

                {/* secondary: subscribe / follow free — highly visible, not competing */}
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: campaign.tiers.length ? 28 : 4 }}>
                  <a href="#join" style={secondaryBtn}>
                    Subscribe{fromPrice ? ` · from $${fromPrice.toFixed(2)}/mo` : ""}
                  </a>
                  <a href="#join" style={secondaryBtn}>Follow free</a>
                </div>

                {campaign.tiers.length > 0 ? (
                  <div style={{ maxWidth: 560, margin: "0 auto" }}>
                    <CampaignTiers campaignId={campaign.id} campaignTitle={campaign.title} tiers={campaign.tiers} />
                  </div>
                ) : null}
              </section>

              {/* ── THE WORLD: photos, videos, content. The page comes alive. ── */}
              {content.length > 0 ? (
                <section style={{ marginTop: 72 }}>
                  <SpineLabel>Inside {displayName}&apos;s world</SpineLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                    {content.map((p: any) => (
                      <div key={p.id} style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", minHeight: 200 }}>
                        {p.entitled && p.mediaUrl && p.isImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.mediaUrl} alt="" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
                        ) : p.entitled && p.mediaUrl && p.isVid ? (
                          <video src={p.mediaUrl} controls preload="metadata" muted playsInline style={{ width: "100%", height: 220, objectFit: "cover", display: "block", background: "#000" }} />
                        ) : p.blur ? (
                          <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.blur} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "blur(8px)", transform: "scale(1.15)" }} />
                            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(9,9,12,0.35)" }}>
                              <span style={{ fontSize: 20 }}>🔒</span>
                              <a href="#join" style={{ fontSize: 12, color: "#0A0A0D", background: "var(--accent)", padding: "8px 16px", borderRadius: 999, textDecoration: "none", fontWeight: 700 }}>
                                Subscribe{p.lockTierName ? ` to ${p.lockTierName}` : ""} to see
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div style={{ height: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "linear-gradient(160deg, rgba(242,184,75,0.06), rgba(255,255,255,0.02))" }}>
                            <span style={{ fontSize: 20 }}>🔒</span>
                            <a href="#join" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>
                              Subscribe{p.lockTierName ? ` to ${p.lockTierName}` : ""} to see
                            </a>
                          </div>
                        )}
                        {p.caption ? (
                          <div style={{ padding: "12px 14px", fontSize: 13, color: "rgba(247,243,236,0.82)", lineHeight: 1.5 }}>{clamp(String(p.caption), 110)}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* social embeds */}
              {socialPosts.length > 0 ? (
                <section style={{ marginTop: 64 }}>
                  <SpineLabel>From around the web · {socialPosts.length}</SpineLabel>
                  <SocialPostsGrid posts={socialPosts} />
                </section>
              ) : null}

              {/* community activity */}
              <section style={{ marginTop: 64, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
                <TheRoom subscriberCount={subscriberCount} handle={sp.handle} />
              </section>

              {/* ── JOIN: subscribe + follow free, the secondary tier, in full ── */}
              <section id="join" style={{ marginTop: 64, maxWidth: 560, marginLeft: "auto", marginRight: "auto", scrollMarginTop: 90 }}>
                <SpineLabel>Join {displayName}&apos;s community</SpineLabel>
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
              </section>

              {/* ── TERTIARY: more ways to support ── */}
              <section style={{ marginTop: 56, paddingBottom: 56, maxWidth: 560, marginLeft: "auto", marginRight: "auto", textAlign: "center" }}>
                <SpineLabel>More ways to support {displayName}</SpineLabel>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <SuperTipButton creatorProfileId={sp.id} handle={sp.handle} />
                  <TipButton creatorProfileId={sp.id} />
                  <GiftSubscriptionButton creatorProfileId={sp.id} handle={sp.handle} />
                  <MessageButton creatorProfileId={sp.id} handle={sp.handle} />
                </div>
              </section>
            </>
          ) : (
            <section style={{ textAlign: "center", padding: "120px 0 100px" }}>
              <div style={{ fontFamily: "var(--font-mono, 'DM Mono', monospace)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>
                Spotlightly
              </div>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 28, color: "var(--text)", margin: "0 auto 12px", maxWidth: 520 }}>
                No active campaign to headline
              </h1>
              <p style={{ fontSize: 15, color: "var(--muted)", maxWidth: 460, margin: "0 auto" }}>
                @{sp.handle} has no active campaign right now, so this page is updating. Refresh in a moment.
              </p>
            </section>
          )}
        </div>
      </main>
      <CreatorFooter />
    </>
  );
}
