import { createClient } from "@/lib/supabase-server";
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
import LivePlayer from "./LivePlayer";
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
      .eq("status", "live")
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

  if (user) {
    const [{ data: sub }, { data: unlocks }, { data: earlyPass }] = await Promise.all([
      (supabase as any)
        .from("subscriptions")
        .select("id")
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
    unlockedPostIds = new Set((unlocks ?? []).map((u: any) => u.post_id));
    hasEarlyAccess = !!earlyPass;
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
    viewerUserId: user?.id ?? null,
    campaigns: campaignsWithProgress,
    wishlistItems: wishlistItems ?? [],
    digitalProducts: digitalProducts ?? [],
    subscriptionTiers: subscriptionTiers ?? [],
    liveStream: liveStream ?? null,
    superTips: superTips ?? [],
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

  const { spotlight, backstageHandle, channels, posts, isSubscribed, campaigns, wishlistItems, digitalProducts, subscriptionTiers } = data;
  const displayName = spotlight.display_name ?? spotlight.handle;

  return (
    <>
      <SiteHeader />
      <SuccessBanner />
      <main className="cp">
        <section className="cp-cover">
          {spotlight.cover_url ? (
            <img src={spotlight.cover_url} alt="" className="cp-cover-img" />
          ) : (
            <div className="cp-cover-fallback" aria-hidden />
          )}
          <div className="cp-cover-fade" aria-hidden />
        </section>

        <header className="cp-header">
          <div className="cp-header-inner">
            <div className="cp-avatar-wrap">
              {spotlight.avatar_url ? (
                <img src={spotlight.avatar_url} alt="" className="cp-avatar" />
              ) : (
                <div className="cp-avatar cp-avatar-fallback">
                  {String(displayName).charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="cp-identity">
              <div className="cp-name-row">
                <h1 className="cp-name">{displayName}</h1>
              </div>
              <p className="cp-handle">@{spotlight.handle}</p>
              {spotlight.bio && <p className="cp-bio">{spotlight.bio}</p>}

              {/* Social links */}
              {(() => {
                const links = (spotlight as any).social_links as Record<string,string> | null;
                if (!links) return null;
                const labels: Record<string,string> = { social_tiktok:"TikTok", social_instagram:"Instagram", social_youtube:"YouTube", social_twitter:"X", social_twitch:"Twitch", social_discord:"Discord", social_substack:"Substack", social_website:"Website" };
                const active = Object.entries(links).filter(([,v]) => v && (v as string).length > 0);
                if (!active.length) return null;
                return (
                  <div className="cp-social-links">
                    {active.map(([key, url]) => (
                      <a key={key} href={url as string} target="_blank" rel="noopener noreferrer" className="cp-social-link">
                        {labels[key] ?? key.replace("social_","")}
                      </a>
                    ))}
                  </div>
                );
              })()}

              {backstageHandle && (
                <Link href={`/${backstageHandle}`} className="cp-backstage">
                  <span className="cp-bs-tag">Backstage</span>
                  <span className="cp-bs-text">
                    Exclusive content at <strong>@{backstageHandle}</strong>
                  </span>
                  <span className="cp-bs-arrow">→</span>
                </Link>
              )}
            </div>

            <div className="cp-actions">
              <SubscribeButton creatorProfileId={spotlight.id} />
              <TipButton creatorProfileId={spotlight.id} />
              <SuperTipButton creatorProfileId={spotlight.id} handle={spotlight.handle} />
              {(spotlight as any).booking_url && (
                <a
                  href={(spotlight as any).booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--secondary cp-book-btn"
                  style={{ display:"inline-flex", alignItems:"center", gap:8 }}
                >
                  📅 {(spotlight as any).booking_label || "Book an appointment"}
                </a>
              )}
            </div>
          </div>
        </header>

        <ReferralTracker creatorHandle={spotlight.handle} />

        {/* Calendly embed — shows when booking URL is a Calendly link */}
        {(spotlight as any).booking_url?.includes("calendly.com") && (
          <div style={{ maxWidth:"var(--container)", margin:"0 auto var(--s-6)", padding:"0 var(--s-6)" }}>
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", overflow:"hidden" }}>
              <div style={{ padding:"var(--s-4) var(--s-6)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18 }}>📅</span>
                <div>
                  <p style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{(spotlight as any).booking_label || "Book an appointment"}</p>
                  <p style={{ fontSize:12, color:"var(--muted)" }}>Powered by Calendly</p>
                </div>
              </div>
              <iframe
                src={`${(spotlight as any).booking_url}?embed_domain=${typeof window !== "undefined" ? window.location.hostname : "spotlightly.app"}&embed_type=Inline`}
                width="100%"
                height="700"
                style={{ border:"none", display:"block" }}
                title="Book an appointment"
              />
            </div>
          </div>
        )}

        {/* Live stream banner — shows when creator is live */}
        {data.liveStream && (
          <div style={{ maxWidth: "var(--container)", margin: "0 auto var(--s-4)", padding: "0 var(--s-6)" }}>
            <LivePlayer playbackUrl={data.liveStream.playback_url} title={data.liveStream.title} />
          </div>
        )}

        {/* Top Supporters */}
        {data.superTips.length > 0 && (
          <div style={{ maxWidth: "var(--container)", margin: "0 auto var(--s-4)", padding: "0 var(--s-6)" }}>
            <div style={{ background: "rgba(240,180,41,0.04)", border: "1px solid rgba(240,180,41,0.15)", borderRadius: "var(--r-3)", padding: "var(--s-4) var(--s-5)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--accent-spot)", marginBottom: "var(--s-3)" }}>⭐ Top Supporters</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.superTips.map((t: any, i: number) => (
                  <div key={i} style={{ background: "rgba(240,180,41,0.08)", border: "1px solid rgba(240,180,41,0.2)", borderRadius: "var(--r-pill)", padding: "4px 12px", fontSize: 12, color: "var(--text-soft)" }}>
                    <span style={{ color: "var(--accent-spot)", fontWeight: 700 }}>{t.fan_display_name}</span>
                    {t.message && <span style={{ marginLeft: 6, fontStyle: "italic" }}>"{t.message.slice(0, 40)}"</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <section className="cp-content">
          <div className="cp-content-inner">
            {channels.length > 0 && (
              <div className="cp-channels">
                <p className="kicker">Channels</p>
                <div className="cp-channel-grid">
                  {channels.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/${spotlight.handle}/${ch.slug}`}
                      className="cp-channel"
                    >
                      <h3 className="cp-channel-name">{ch.name}</h3>
                      {ch.description && (
                        <p className="cp-channel-desc">{ch.description}</p>
                      )}
                      <p className="cp-channel-meta">
                        {ch.subscription_price
                          ? `$${Number(ch.subscription_price).toFixed(2)}/mo`
                          : "Free"}{" "}
                        · {ch.content_rating}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ── CAMPAIGNS ── */}
            {campaigns && campaigns.length > 0 && (
              <div className="cp-campaigns">
                <p className="kicker">Campaigns</p>
                <div className="cp-campaign-list">
                  {campaigns.map((c: any) => {
                    const pct = Math.min(100, Math.round((c.raised / c.goal_amount) * 100));
                    const daysLeft = c.deadline
                      ? Math.max(0, Math.ceil((new Date(c.deadline).getTime() - Date.now()) / 86400000))
                      : null;
                    return (
                      <div key={c.id} className="cp-campaign">
                        <div className="cp-campaign-head">
                          <h3 className="cp-campaign-title">{c.title}</h3>
                          {daysLeft !== null && (
                            <span className="cp-campaign-deadline">
                              {daysLeft > 0 ? `${daysLeft}d left` : "Ended"}
                            </span>
                          )}
                        </div>
                        {c.description && (
                          <p className="cp-campaign-desc">{c.description}</p>
                        )}
                        <div className="cp-campaign-progress">
                          <div className="cp-campaign-bar">
                            <div className="cp-campaign-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="cp-campaign-stats">
                            <span className="cp-campaign-raised">
                              ${Number(c.raised).toFixed(0)} raised
                            </span>
                            <span className="cp-campaign-goal">
                              of ${Number(c.goal_amount).toFixed(0)} goal · {pct}%
                            </span>
                          </div>
                        </div>
                        {c.reward_description && (
                          <p className="cp-campaign-reward">
                            🎟 Supporters get: {c.reward_description}
                          </p>
                        )}
                        {c.status === "active" && (
                          <div style={{ marginTop: "var(--s-4)" }}>
                            <CampaignDonateButton campaignId={c.id} campaignTitle={c.title} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── WISHLIST ── */}
            {/* Subscription Tiers */}
            {subscriptionTiers && subscriptionTiers.length > 0 && (
              <TiersSection
                tiers={subscriptionTiers as any}
                creatorHandle={spotlight.handle}
                creatorName={spotlight.display_name ?? spotlight.handle}
              />
            )}

            {/* Digital Store */}
            {digitalProducts && digitalProducts.length > 0 && (
              <div style={{ marginBottom:"var(--s-12)" }}>
                <p className="kicker">Digital Store</p>
                <p style={{ fontSize:13, color:"var(--muted)", marginBottom:"var(--s-5)" }}>
                  Download instantly after purchase.
                </p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"var(--s-4)" }}>
                  {(digitalProducts as any[]).map((product: any) => (
                    <DigitalProductCard key={product.id} product={product} creatorProfileId={spotlight.id} />
                  ))}
                </div>
              </div>
            )}

                        {wishlistItems && wishlistItems.length > 0 && (
              <div className="cp-wishlist">
                <p className="kicker">Wishlist</p>
                <p className="cp-wishlist-sub">
                  Send {displayName} something from their wishlist.
                </p>
                <div className="cp-wishlist-grid">
                  {(wishlistItems as any[]).map((item: any) => (
                    <WishlistItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            <div className="cp-posts">
              <p className="kicker">Latest</p>

              {posts.length === 0 ? (
                <div className="cp-empty">
                  <div className="cp-empty-mark" aria-hidden>
                    ◌
                  </div>
                  <h2 className="cp-empty-title">The stage is set.</h2>
                  <p className="cp-empty-text">
                    {displayName} hasn&apos;t posted yet. Check back soon.
                  </p>
                </div>
              ) : (
                <ul className="cp-post-list">
                  {posts.map((p) => {
                    const unlockedPostIds = data.unlockedPostIds ?? [];
                    const now = new Date();
                    const earlyAccessAt = p.early_access_at ? new Date(p.early_access_at) : null;
                    const regularAccessAt = earlyAccessAt ? new Date(earlyAccessAt.getTime() + 30 * 60 * 1000) : null;

                    // Early access timing: hide from everyone until earlyAccessAt
                    const visibleToEarlyAccess = !earlyAccessAt || earlyAccessAt <= now;
                    const visibleToRegular = !regularAccessAt || regularAccessAt <= now;

                    const subLocked = p.lock_type === "subscription" && !isSubscribed;
                    const earlyAccessLocked = p.lock_type === "subscription" && isSubscribed && !data.hasEarlyAccess && !!earlyAccessAt && !visibleToRegular;
                    const purchaseLocked = p.lock_type === "purchase" && !unlockedPostIds.includes(p.id);
                    const locked = subLocked || (p.tier === "premium" && p.lock_type !== "purchase" && !isSubscribed);
                    return (
                      <li key={p.id} className={`cp-post${locked || purchaseLocked || earlyAccessLocked ? " cp-post--locked" : ""}`}>
                        {locked ? (
                          <>
                            <div className="cp-post-gate">
                              <div className="cp-gate-blur" aria-hidden />
                              <div className="cp-gate-overlay">
                                <span className="cp-gate-icon">🔒</span>
                                <p className="cp-gate-label">Subscribers only</p>
                                <p className="cp-gate-desc">Subscribe to {displayName} to unlock this post.</p>
                                <form action="/api/subscribe" method="post" className="cp-gate-form">
                                  <input type="hidden" name="creator_profile_id" value={spotlight.id} />
                                  <button type="submit" className="btn btn--primary cp-gate-btn">
                                    Subscribe · {spotlight.subscription_price ? `$${Number(spotlight.subscription_price).toFixed(0)}/mo` : "Subscribe"}
                                  </button>
                                </form>
                              </div>
                            </div>
                            <div className="cp-post-meta" style={{ padding: "var(--s-4) var(--s-6)" }}>
                              <span>{new Date(p.created_at).toLocaleDateString()}</span>
                              <span className="cp-post-lock">🔒 Subscriber content</span>
                            </div>
                          </>
                        ) : earlyAccessLocked ? (
                          <>
                            <div className="cp-post-gate">
                              <div className="cp-gate-blur" aria-hidden />
                              <div className="cp-gate-overlay">
                                <span className="cp-gate-icon">⏱</span>
                                <p className="cp-gate-label" style={{ color: "var(--accent-spot)" }}>Early Access only</p>
                                <p className="cp-gate-desc">
                                  This post drops for all subscribers in {Math.ceil((regularAccessAt!.getTime() - now.getTime()) / 60000)} min.
                                  Early Access fans can read it now.
                                </p>
                                <a href="/dashboard?pane=settings" className="btn btn--secondary cp-gate-btn" style={{ fontSize: 12 }}>
                                  Get Early Access · $2.99/mo
                                </a>
                              </div>
                            </div>
                            <div className="cp-post-meta" style={{ padding: "var(--s-4) var(--s-6)" }}>
                              <span>{new Date(p.created_at).toLocaleDateString()}</span>
                              <span className="cp-post-lock" style={{ color: "var(--accent-spot)" }}>⏱ Early Access</span>
                            </div>
                          </>
                        ) : purchaseLocked ? (
                          <>
                            <div className="cp-post-gate">
                              <div className="cp-gate-blur" aria-hidden />
                              <div className="cp-gate-overlay">
                                <span className="cp-gate-icon">🔓</span>
                                <p className="cp-gate-label">Unlock this post</p>
                                {p.caption && (
                                  <p className="cp-gate-desc" style={{ fontStyle: "italic", maxWidth: 280 }}>
                                    &ldquo;{p.caption.slice(0, 120)}{p.caption.length > 120 ? "…" : ""}&rdquo;
                                  </p>
                                )}
                                <UnlockButton postId={p.id} price={p.unlock_price} viewerUserId={data.viewerUserId} />
                              </div>
                            </div>
                            <div className="cp-post-meta" style={{ padding: "var(--s-4) var(--s-6)" }}>
                              <span>{new Date(p.created_at).toLocaleDateString()}</span>
                              <span className="cp-post-lock" style={{ color: "var(--accent-spot)" }}>
                                🔓 ${Number(p.unlock_price).toFixed(2)} to unlock
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            {p.media_url && p.media_type === "image" && (
                              <img src={p.media_url} alt="" className="cp-post-media" />
                            )}
                            {p.media_url && p.media_type === "video" && (
                              p.media_url.includes("iframe.mediadelivery.net") ? (
                                <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: "var(--r-2)", overflow: "hidden", marginBottom: "var(--s-3)", background: "#0a0a0f" }}>
                                  <iframe
                                    src={`${p.media_url}&responsive=true`}
                                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                                    allowFullScreen
                                    loading="lazy"
                                  />
                                  {/* Processing overlay — hidden once iframe loads video */}
                                  <div style={{
                                    position: "absolute", inset: 0,
                                    display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10,
                                    background: "rgba(10,10,15,0.85)", pointerEvents: "none", zIndex: 1,
                                  }}
                                    className="video-processing-overlay"
                                  >
                                    <div style={{ fontSize: 28 }}>🎬</div>
                                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(242,184,75,0.7)", margin: 0 }}>
                                      Video processing — ready shortly
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <video src={p.media_url} className="cp-post-media" controls style={{ width: "100%", borderRadius: "var(--r-2)" }} />
                              )
                            )}
                            {p.caption && <p className="cp-post-caption">{p.caption}</p>}
                            <div className="cp-post-meta">
                              <span>{new Date(p.created_at).toLocaleDateString()}</span>
                              {p.lock_type === "subscription" && <span className="cp-post-lock" style={{ color: "var(--accent-open)" }}>✓ Subscriber content</span>}
                              {p.lock_type === "purchase" && <span className="cp-post-lock" style={{ color: "var(--accent-spot)" }}>✓ Unlocked</span>}
                              {p.likes_count != null && p.likes_count > 0 && (
                                <span>{p.likes_count} likes</span>
                              )}
                            </div>
                            <CommentSection postId={p.id} viewerUserId={data.viewerUserId} />
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        <style>{`
          .cp { min-height: 100vh; }
          .cp-cover {
            position: relative;
            width: 100%;
            height: clamp(220px, 32vw, 360px);
            overflow: hidden;
            background: var(--surface-2);
          }
          .cp-cover-img { width: 100%; height: 100%; object-fit: cover; }
          .cp-cover-fallback {
            width: 100%; height: 100%;
            background:
              radial-gradient(ellipse 60% 50% at 30% 40%, rgba(245, 200, 66, 0.12), transparent 70%),
              radial-gradient(ellipse 50% 40% at 70% 60%, rgba(192, 132, 252, 0.08), transparent 70%),
              var(--surface-2);
          }
          .cp-cover-fade {
            position: absolute; inset: 0;
            background: linear-gradient(to bottom, transparent 50%, rgba(10,10,15,0.6) 80%, var(--bg) 100%);
            pointer-events: none;
          }
          .cp-header {
            max-width: var(--container);
            margin: -90px auto 0;
            padding: 0 var(--s-6);
            position: relative;
            z-index: 2;
          }
          .cp-header-inner {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: var(--s-8);
            align-items: end;
          }
          .cp-avatar {
            width: 144px; height: 144px;
            border-radius: 50%;
            border: 4px solid var(--bg);
            object-fit: cover;
            background: var(--surface-2);
          }
          .cp-avatar-fallback {
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-serif);
            font-size: 56px;
            color: var(--accent);
          }
          .cp-identity { padding-bottom: var(--s-3); min-width: 0; }
          .cp-name-row {
            display: flex; align-items: center; gap: var(--s-3); flex-wrap: wrap;
          }
          .cp-name {
            font-family: var(--font-serif);
            font-size: clamp(32px, 5vw, 44px);
            font-weight: 400;
            color: #fff;
            margin: 0;
            line-height: 1.05;
            letter-spacing: -0.01em;
          }
          .cp-handle {
            font-family: var(--font-mono);
            font-size: 13px;
            color: var(--muted);
            margin: var(--s-2) 0 0;
          }
          .cp-bio {
            font-size: 15px;
            line-height: 1.7;
            color: var(--text-soft);
            margin: var(--s-4) 0 0;
            max-width: 580px;
          }
          .cp-backstage {
            display: inline-flex;
            align-items: center;
            gap: var(--s-3);
            margin-top: var(--s-5);
            padding: 10px 16px;
            background: rgba(192,132,252,0.06);
            border: 1px solid rgba(192,132,252,0.2);
            border-radius: var(--r-2);
            transition: all var(--t-fast);
          }
          .cp-backstage:hover {
            background: rgba(192,132,252,0.1);
            border-color: rgba(192,132,252,0.35);
          }
          .cp-bs-tag {
            font-family: var(--font-mono);
            font-size: 9px;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: var(--accent-back);
          }
          .cp-bs-text { font-size: 13px; color: var(--text-soft); }
          .cp-bs-text strong {
            font-family: var(--font-mono);
            color: var(--accent-back);
            font-weight: 500;
          }
          .cp-bs-arrow { color: var(--accent-back); font-size: 14px; }

          .cp-actions { display: flex; gap: var(--s-2); padding-bottom: var(--s-3); }

          .cp-content {
            max-width: var(--container);
            margin: var(--s-16) auto 0;
            padding: 0 var(--s-6) var(--s-20);
          }

          .cp-channels { margin-bottom: var(--s-12); }
          .cp-campaigns { margin-bottom: var(--s-12); }
          .cp-campaign-list { display: flex; flex-direction: column; gap: var(--s-4); }
          .cp-campaign {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--r-3);
            padding: var(--s-6);
          }
          .cp-campaign-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s-4); margin-bottom: var(--s-2); }
          .cp-campaign-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: #fff; margin: 0; }
          .cp-campaign-deadline { font-family: var(--font-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); flex-shrink: 0; }
          .cp-campaign-desc { font-size: 13px; color: var(--text-soft); line-height: 1.6; margin-bottom: var(--s-4); }
          .cp-campaign-progress { margin-bottom: var(--s-3); }
          .cp-campaign-bar { height: 4px; background: var(--surface-2); border-radius: 2px; overflow: hidden; margin-bottom: var(--s-2); }
          .cp-campaign-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width .4s ease; }
          .cp-campaign-stats { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 11px; }
          .cp-campaign-raised { color: var(--accent); font-weight: 500; }
          .cp-campaign-goal { color: var(--muted); }
          .cp-campaign-reward { font-size: 12px; color: var(--text-soft); background: rgba(240,180,41,.06); border: 1px solid rgba(240,180,41,.12); border-radius: var(--r-1); padding: var(--s-2) var(--s-3); margin-top: var(--s-3); }
          .cp-wishlist { margin-bottom: var(--s-12); }
          .cp-wishlist-sub { font-size: 13px; color: var(--muted); margin-bottom: var(--s-5); }
          .cp-wishlist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--s-4); }
          .cp-channel-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 2px;
            margin-top: var(--s-4);
          }
          .cp-channel {
            background: var(--surface);
            border: 1px solid var(--border);
            padding: var(--s-5);
            transition: border-color var(--t-fast);
          }
          .cp-channel:hover { border-color: var(--border-strong); }
          .cp-channel-name {
            font-family: var(--font-serif);
            font-size: 22px;
            font-weight: 400;
            color: #fff;
            margin: 0 0 var(--s-2);
          }
          .cp-channel-desc {
            font-size: 13px;
            color: var(--text-soft);
            line-height: 1.6;
            margin: 0 0 var(--s-3);
          }
          .cp-channel-meta {
            font-family: var(--font-mono);
            font-size: 10px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--accent);
            margin: 0;
          }

          .cp-posts { }
          .cp-post-list {
            list-style: none;
            padding: 0;
            margin: var(--s-4) 0 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .cp-post {
            background: var(--surface);
            border: 1px solid var(--border);
            padding: var(--s-6);
          }
          .cp-post-media {
            width: 100%;
            max-height: 600px;
            object-fit: cover;
            border-radius: var(--r-2);
            margin-bottom: var(--s-4);
          }
          .cp-post-caption {
            font-size: 15px;
            line-height: 1.7;
            color: var(--text);
            margin: 0 0 var(--s-3);
            white-space: pre-wrap;
          }
          .cp-post-meta {
            display: flex;
            gap: var(--s-4);
            font-family: var(--font-mono);
            font-size: 10px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--muted);
          }
          .cp-post-lock { color: var(--accent); }
          .cp-social-links { display:flex; flex-wrap:wrap; gap:var(--s-2); margin-top:var(--s-4); }
          .cp-social-link { font-family:var(--font-display); font-size:11px; font-weight:600; letter-spacing:.04em; color:var(--muted); padding:6px 14px; border:1px solid var(--border); border-radius:var(--r-pill); background:var(--surface); transition:all var(--t-fast); text-decoration:none; }
          .cp-social-link:hover { color:var(--text); border-color:var(--border-strong); }
          .cp-social-links {
            display: flex; flex-wrap: wrap; gap: var(--s-2); margin-top: var(--s-4);
          }
          .cp-social-link {
            font-family: var(--font-display); font-size: 11px; font-weight: 600;
            letter-spacing: 0.04em; color: var(--muted);
            padding: 6px 14px; border: 1px solid var(--border);
            border-radius: var(--r-pill); background: var(--surface);
            transition: all var(--t-fast); text-decoration: none;
          }
          .cp-social-link:hover {
            color: var(--text); border-color: var(--border-strong);
            background: var(--surface-2);
          }

          .cp-post--locked { border-color: rgba(245,200,66,0.12); }
          .cp-post-gate {
            position: relative;
            min-height: 260px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: var(--surface-2);
          }
          .cp-gate-blur {
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, var(--surface-2), var(--surface-3));
            filter: blur(0);
          }
          .cp-gate-overlay {
            position: relative;
            z-index: 2;
            text-align: center;
            padding: var(--s-8) var(--s-6);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--s-3);
          }
          .cp-gate-icon { font-size: 32px; }
          .cp-gate-label {
            font-family: var(--font-mono);
            font-size: 10px;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: var(--accent);
          }
          .cp-gate-desc {
            font-size: 14px;
            color: var(--text-soft);
            max-width: 360px;
            line-height: 1.65;
            margin: 0;
          }
          .cp-gate-form { margin-top: var(--s-2); }
          .cp-gate-btn { padding: 12px 24px; }

          .cp-empty {
            text-align: center;
            padding: var(--s-16) var(--s-5);
            background: var(--surface);
            border: 1px solid var(--border);
            margin-top: var(--s-4);
          }
          .cp-empty-mark {
            font-size: 48px;
            color: var(--muted);
            opacity: 0.4;
            margin-bottom: var(--s-5);
            font-family: var(--font-serif);
          }
          .cp-empty-title {
            font-family: var(--font-serif);
            font-size: 24px;
            font-style: italic;
            font-weight: 300;
            color: #fff;
            margin: 0 0 var(--s-2);
          }
          .cp-empty-text { font-size: 13px; color: var(--muted); margin: 0; }

          @media (max-width: 720px) {
            .cp-header { margin-top: -64px; padding: 0 var(--s-5); }
            .cp-header-inner { grid-template-columns: 1fr; gap: var(--s-5); }
            .cp-avatar { width: 104px; height: 104px; }
            .cp-avatar-fallback { font-size: 40px; }
            .cp-actions { padding-bottom: 0; }
            .btn { flex: 1; }
            .cp-content { margin-top: var(--s-12); padding: 0 var(--s-5) var(--s-16); }
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
        <a href="/login" style={{ textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.4)", textDecoration:"none" }}>
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
