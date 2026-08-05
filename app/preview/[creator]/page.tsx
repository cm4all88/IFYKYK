import { createClient } from "@/lib/supabase-server";
import { PUBLIC_CREATOR_SELECT } from "@/lib/creator-public";
import { notFound } from "next/navigation";
import { hasSecret } from "@/lib/settings";
import type { ReactNode } from "react";

import SiteHeader from "@/components/site-header";
import CreatorFooter from "@/components/CreatorFooter";
import SocialPostsGrid from "@/components/SocialPostsGrid";
import BackerCodeBanner from "../../[creator]/BackerCodeBanner";
import CampaignDonateButton from "../../[creator]/CampaignDonateButton";
import CampaignTiers from "../../[creator]/CampaignTiers";
import TheRoom from "../../[creator]/TheRoom";
import FreeTierCard from "../../[creator]/FreeTierCard";
import TierPicker from "../../[creator]/TierPicker";
import SuperTipButton from "../../[creator]/SuperTipButton";
import TipButton from "../../[creator]/TipButton";
import GiftSubscriptionButton from "../../[creator]/GiftSubscriptionButton";
import MessageButton from "../../[creator]/MessageButton";

export const dynamic = "force-dynamic";

// ── Prototype: the adaptive Spotlightly frame, campaign-first occupant.
// The campaign is the hero, but the creator's whole world stays on the page
// at the right weight. Support hierarchy: back the campaign (primary),
// subscribe / follow free (secondary), tip / super tip / gift / message
// (tertiary). New route, live page untouched, existing data + actions only.

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

  const { data: spotlight } = await (supabase as any)
    .from("creator_public").select(PUBLIC_CREATOR_SELECT).eq("kind", "spotlight").eq("handle", handle).maybeSingle();
  // The view filters soft-deleted rows, so the old deleted_at guard is in SQL now.
  if (!spotlight) return null;
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
    .from("posts").select("id, caption, media_url, media_type, tier, lock_type, is_pinned, created_at")
    .eq("creator_profile_id", sp.id).eq("status", "live").order("created_at", { ascending: false }).limit(12);

  const content = ((posts ?? []) as any[])
    .sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned))
    .slice(0, 9);

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

export default async function PreviewCreatorPage(props: { params: Promise<{ creator: string }> }) {
  const { creator } = await props.params;
  const data = await loadCampaignFirst(creator);
  if (!data) notFound();
  const { sp, campaign, subscriberCount, subscriptionTiers, content, socialPosts, loggedIn, stripeReady } = data;

  const displayName = sp.display_name || sp.handle;
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
      <main style={{ position: "relative", minHeight: "70vh" }}>
        <div style={{ position: "relative", maxWidth: 920, margin: "0 auto", padding: "0 24px" }}>
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
                    {content.map((p: any) => {
                      const free = isFree(p);
                      const mt = String(p.media_type ?? "");
                      return (
                        <div key={p.id} style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", minHeight: 200 }}>
                          {free && p.media_url && mt.startsWith("image") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.media_url} alt="" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
                          ) : free && p.media_url && mt.startsWith("video") ? (
                            <video src={p.media_url} controls preload="metadata" muted playsInline style={{ width: "100%", height: 220, objectFit: "cover", display: "block", background: "#000" }} />
                          ) : !free ? (
                            <div style={{ height: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(160deg, rgba(242,184,75,0.06), rgba(255,255,255,0.02))" }}>
                              <span style={{ fontSize: 22 }}>🔒</span>
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>Subscribers only</span>
                              <a href="#join" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Subscribe to unlock</a>
                            </div>
                          ) : null}
                          {p.caption ? (
                            <div style={{ padding: "12px 14px", fontSize: 13, color: "rgba(247,243,236,0.82)", lineHeight: 1.5 }}>{clamp(String(p.caption), 110)}</div>
                          ) : null}
                        </div>
                      );
                    })}
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
                {subscriptionTiers.length > 0 ? (
                  <div style={{ marginTop: 14 }}>
                    <TierPicker tiers={subscriptionTiers as any} creatorProfileId={sp.id} stripeReady={stripeReady} loggedIn={loggedIn} />
                  </div>
                ) : null}
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
                Campaign-first prototype
              </div>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 28, color: "var(--text)", margin: "0 auto 12px", maxWidth: 520 }}>
                No active campaign to headline
              </h1>
              <p style={{ fontSize: 15, color: "var(--muted)", maxWidth: 460, margin: "0 auto" }}>
                @{sp.handle} has no active campaign right now, so campaign-first mode does not apply. The other modes are out of scope for this prototype.
              </p>
            </section>
          )}
        </div>
      </main>
      <CreatorFooter />
    </>
  );
}
