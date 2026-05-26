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
import PostCarousel from "./PostCarousel";
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
        {/* Stage hero */}
        <section className="cp-stage">
          {/* Background — cover image or spotlight beam */}
          <div className="cp-stage-bg" aria-hidden>
            {spotlight.cover_url && (
              <img src={spotlight.cover_url} alt="" className="cp-stage-cover-img" />
            )}
            <div className="cp-stage-vignette" />
            {/* Spotlight beam */}
            <div className="cp-stage-beam" />
            <div className="cp-stage-beam-wide" />
            {/* Stage floor glow */}
            <div className="cp-stage-floor" />
          </div>

          {/* Stage content — centered */}
          <div className="cp-stage-inner">
            {/* Avatar */}
            <div className="cp-stage-avatar-wrap">
              {spotlight.avatar_url ? (
                <img src={spotlight.avatar_url} alt="" className="cp-stage-avatar" />
              ) : (
                <div className="cp-stage-avatar cp-stage-avatar-fallback">
                  {String(displayName).charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name */}
            <h1 className="cp-stage-name">{displayName}</h1>
            <p className="cp-stage-handle">@{spotlight.handle}</p>

            {spotlight.bio && (
              <p className="cp-stage-bio">{spotlight.bio}</p>
            )}

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

            {/* Actions */}
            <div className="cp-stage-actions">
              <SubscribeButton creatorProfileId={spotlight.id} />
              <TipButton creatorProfileId={spotlight.id} />
              <SuperTipButton creatorProfileId={spotlight.id} handle={spotlight.handle} />
              {(spotlight as any).booking_url && (
                <a
                  href={(spotlight as any).booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--secondary"
                >
                  📅 {(spotlight as any).booking_label || "Book"}
                </a>
              )}
            </div>

            {backstageHandle && (
              <Link href={`/${backstageHandle}`} className="cp-backstage">
                <span className="cp-bs-tag">Backstage</span>
                <span className="cp-bs-text">Exclusive content at <strong>@{backstageHandle}</strong></span>
                <span className="cp-bs-arrow">→</span>
              </Link>
            )}
          </div>
        </section>

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

              {posts.length > 0 && (
              <div className="cp-posts-label">
                {posts.length} post{posts.length !== 1 ? "s" : ""}
              </div>
            )}
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
                <PostCarousel
                  posts={posts}
                  isSubscribed={isSubscribed}
                  hasEarlyAccess={data.hasEarlyAccess}
                  unlockedPostIds={data.unlockedPostIds ?? []}
                  viewerUserId={data.viewerUserId}
                  displayName={displayName}
                  creatorProfileId={spotlight.id}
                  subscriptionPrice={spotlight.subscription_price ? Number(spotlight.subscription_price) : null}
                />
              )}
            </div>
          </div>
        </section>

        {/* LEGACY POSTS SECTION - REPLACED BY CAROUSEL */}
        {false && posts.map((p) => {
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
          /* ── Base ── */
          .cp { min-height: 100vh; background: #09090C; }

          /* ── Stage hero ── */
          .cp-stage {
            position: relative;
            min-height: 100vh;
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
            opacity: 0.12;
            filter: saturate(0.6);
          }
          .cp-stage-vignette {
            position: absolute; inset: 0;
            background: radial-gradient(ellipse 80% 80% at 50% 50%, transparent 20%, rgba(9,9,12,0.7) 70%, rgba(9,9,12,0.97) 100%);
          }
          .cp-stage-beam {
            position: absolute; top: 0; left: 50%; transform: translateX(-50%);
            width: 2px; height: 60%;
            background: linear-gradient(to bottom, rgba(242,184,75,0.9), transparent);
          }
          .cp-stage-beam-wide {
            position: absolute; top: 0; left: 50%; transform: translateX(-50%);
            width: min(600px, 70vw); height: 65%;
            background: radial-gradient(ellipse 70% 100% at 50% 0%, rgba(242,184,75,0.1) 0%, transparent 65%);
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
          .cp-live-banner { margin:0 auto; max-width:900px; padding:0 var(--s-6) var(--s-6); }

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
          .cp-campaigns { padding:0 var(--s-6) var(--s-8); }

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
