"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import UnlockButton from "./UnlockButton";
import CommentSection from "./CommentSection";
import LikeButton from "@/components/LikeButton";
import MedalButton from "@/components/MedalButton";
import SocialLinks from "@/components/SocialLinks";

interface Post {
  id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  tier: string;
  lock_type: string;
  unlock_price: number | null;
  early_access_at: string | null;
  expires_at: string | null;
  created_at: string;
  tags?: string[];
  is_pinned?: boolean;
  post_type?: string;
  required_tier_id?: string | null;
  likes_count?: number;
  medal_count?: number;
}

interface Props {
  posts: Post[];
  isSubscribed: boolean;
  hasEarlyAccess: boolean;
  unlockedPostIds: string[];
  likedPostIds: string[];
  viewerUserId: string | null;
  displayName: string;
  handle: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bgUrl: string | null;
  creatorProfileId: string;
  subscriptionPrice: number | null;
  backstageHandle: string | null;
  bookingUrl: string | null;
  bookingLabel: string | null;
  viewerTierRank: number | null;
  tierRanks: Record<string, number>;
  medalPoints?: number;
  medalCount?: number;
  totalLikes?: number;
  subscriberCount?: number;
  isFounder?: boolean;
  socialLinks?: Record<string, string> | null;
  children: React.ReactNode; // subscribe/tip/supertip buttons
}

export default function CreatorStageClient({
  posts, isSubscribed, hasEarlyAccess, unlockedPostIds, likedPostIds,
  viewerUserId, displayName, handle, bio, avatarUrl, coverUrl, bgUrl,
  creatorProfileId, subscriptionPrice, backstageHandle,
  bookingUrl, bookingLabel, viewerTierRank, tierRanks, medalPoints = 0, medalCount = 0, totalLikes = 0, subscriberCount = 0, isFounder = false, socialLinks, children,
}: Props) {
  const now = new Date();

  // A subscriber on too low a tier can't see a post locked to a higher tier.
  const tierLockedFor = (p: Post) => {
    if (p.lock_type !== "subscription" || !p.required_tier_id) return false;
    if (!isSubscribed) return false; // handled by the subscriber gate
    const need = tierRanks[p.required_tier_id] ?? 0;
    return viewerTierRank === null || viewerTierRank < need;
  };

  // Filter expired, sort pinned first
  const visiblePosts = useMemo(() => {
    return [...posts]
      .filter(p => !p.expires_at || new Date(p.expires_at) > now)
      .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
  }, [posts]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Post | null>(null);
  const [tipPost, setTipPost] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipping, setTipping] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const CARD_W = 340;
  const CARD_GAP = 16;

  const filteredPosts = useMemo(() => {
    let r = visiblePosts;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(p => p.caption?.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)));
    }
    if (activeTag) r = r.filter(p => p.tags?.includes(activeTag));
    return r;
  }, [visiblePosts, search, activeTag]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    visiblePosts.forEach(p => p.tags?.forEach(t => s.add(t)));
    return Array.from(s).slice(0, 10);
  }, [visiblePosts]);

  const activePost = filteredPosts[activeIdx] ?? visiblePosts[0] ?? null;

  // What shows in the avatar circle
  const circleContent = activePost?.media_url && activePost.media_type === "image"
    ? activePost.media_url
    : null;

  const scrollTo = useCallback((idx: number) => {
    const c = Math.max(0, Math.min(idx, filteredPosts.length - 1));
    setActiveIdx(c);
    trackRef.current?.scrollTo({ left: c * (CARD_W + CARD_GAP), behavior: "smooth" });
  }, [filteredPosts.length]);

  async function sendTip() {
    setTipping(true);
    const fd = new FormData();
    fd.append("creator_profile_id", creatorProfileId);
    fd.append("amount_usd", String(tipAmount));
    const res = await fetch("/api/tip", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
    setTipping(false);
    setTipPost(null);
  }

  const mono = "var(--font-mono, DM Mono, monospace)";
  const serif = "var(--font-serif, Cormorant Garamond, Georgia, serif)";

  const bgImage = bgUrl || coverUrl;
  const statPill: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px",
    background: "rgba(242,184,75,0.06)", border: "1px solid rgba(242,184,75,0.18)", borderRadius: 999,
    fontFamily: mono, fontSize: 11, letterSpacing: "0.06em", color: "rgba(242,184,75,0.95)",
  };

  return (
    <>
      {/* Fullscreen lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <button onClick={() => setLightbox(null)} style={{
            position: "absolute", top: 20, right: 24,
            background: "none", border: "none", color: "var(--text-soft)",
            fontSize: 28, cursor: "pointer", lineHeight: 1,
          }}>×</button>

          <div style={{ maxWidth: 900, width: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            {lightbox.media_url && lightbox.media_type === "image" && (
              <img src={lightbox.media_url} alt="" style={{ width: "100%", borderRadius: 8, display: "block" }} />
            )}
            {lightbox.media_url && lightbox.media_type === "video" && (
              lightbox.media_url.includes("iframe.mediadelivery.net") ? (
                <div style={{ position: "relative", paddingTop: "56.25%" }}>
                  <iframe src={`${lightbox.media_url}&responsive=true&autoplay=true`}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", borderRadius: 8 }}
                    allow="autoplay; fullscreen" allowFullScreen />
                </div>
              ) : (
                <video src={lightbox.media_url} controls autoPlay style={{ width: "100%", borderRadius: 8 }} />
              )
            )}
            {lightbox.caption && (
              <p style={{ color: "rgba(242,242,240,0.85)", fontSize: 15, lineHeight: 1.7, marginTop: 20, padding: "0 4px" }}>
                {lightbox.caption}
              </p>
            )}
            {lightbox.tags && lightbox.tags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                {lightbox.tags.map(t => (
                  <span key={t} style={{ padding: "3px 10px", borderRadius: 4, background: "rgba(242,184,75,0.1)", border: "1px solid rgba(242,184,75,0.2)", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(242,184,75,0.7)" }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage hero */}
      <section style={{
        position: "relative",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "80px 24px 48px", overflow: "hidden",
      }}>
        {/* Background */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {/* page-level background paints the creator's image; here we add the spotlight glow only */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 70% 70% at 50% 40%, rgba(242,184,75,0.08), transparent 70%)",
          }} />
          {/* Floor glow */}
          <div style={{
            position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "60%", height: 200,
            background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(242,184,75,0.06), transparent)",
          }} />
        </div>

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%", maxWidth: 900 }}>

          {/* Creator identity — top */}
          <div className="cp-identity">
            <div className="cp-stage-avatar" style={{ borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(242,184,75,0.35)", flexShrink: 0, boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "rgba(242,184,75,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 48, color: "rgba(242,184,75,0.7)" }}>
                  {String(displayName).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="cp-identity-text">
              <h1 className="cp-stage-name" style={{ fontFamily: serif, fontWeight: 300, color: "#ffffff", lineHeight: 1, letterSpacing: "-0.02em", margin: "0 0 6px", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
                {displayName}
              </h1>
              <p style={{ fontFamily: mono, fontSize: 13, letterSpacing: "0.14em", color: "rgba(242,184,75,0.95)", margin: 0 }}>@{handle}</p>
            </div>
          </div>

          {/* Bio + actions ABOVE screen */}
          {bio && (
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.7, maxWidth: 560, margin: "0 0 16px", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {bio}
            </p>
          )}

          <SocialLinks links={socialLinks} />

          {/* Social proof — medals · likes · subscribers */}
          {(isFounder || medalCount > 0 || totalLikes > 0 || subscriberCount > 0) && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center", alignSelf: "center", marginBottom: 16 }}>
              {isFounder && (
                <span style={{ ...statPill, background: "rgba(192,132,252,0.10)", border: "1px solid rgba(192,132,252,0.35)", color: "#d7b8ff" }}>
                  <span>★</span> Founding Creator
                </span>
              )}              {medalCount > 0 && (
                <span style={statPill}>
                  <span style={{ fontSize: 14 }}>🏅</span>
                  {medalCount.toLocaleString()} {medalCount === 1 ? "medal" : "medals"}
                </span>
              )}
              {totalLikes > 0 && (
                <span style={statPill}>
                  <span style={{ color: "#F2B84B", fontSize: 13 }}>♥</span>
                  {totalLikes.toLocaleString()} {totalLikes === 1 ? "like" : "likes"}
                </span>
              )}
              {subscriberCount > 0 && (
                <span style={statPill}>
                  {subscriberCount.toLocaleString()} {subscriberCount === 1 ? "subscriber" : "subscribers"}
                </span>
              )}
              {medalCount > 0 && (
                <a href="/wall" style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none", marginLeft: 2 }}>
                  The Wall →
                </a>
              )}
            </div>
          )}

          <div className="cp-stage-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
            {children}
          </div>

          {backstageHandle && (
            <a href={`/${backstageHandle}`} style={{
              display: "inline-flex", alignItems: "center", gap: 12,
              padding: "8px 16px", background: "rgba(168,85,247,0.06)",
              border: "1px solid rgba(168,85,247,0.2)", borderRadius: 6,
              textDecoration: "none", marginBottom: 20,
            }}>
              <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#A855F7" }}>Backstage</span>
              <span style={{ fontSize: 13, color: "rgba(242,242,240,0.7)" }}>@{backstageHandle}</span>
              <span style={{ color: "#A855F7" }}>→</span>
            </a>
          )}

          {/* THE SCREEN — active post displayed large (only when native posts exist) */}
          {visiblePosts.length > 0 && (
          <div
            data-cat="sec-posts"
            onClick={() => activePost && setLightbox(activePost)}
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "#0a0a0f",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              overflow: "hidden",
              cursor: activePost?.media_url ? "pointer" : "default",
              position: "relative",
              marginBottom: 0,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(242,184,75,0.1)",
            }}
          >
            {/* Screen content — active post */}
            {activePost?.media_url && activePost.media_type === "image" && (
              <img src={activePost.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
            {activePost?.media_url && activePost.media_type === "video" && (
              activePost.media_url.includes("iframe.mediadelivery.net") ? (
                <iframe
                  src={`${activePost.media_url}&responsive=true&autoplay=false`}
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  onClick={e => { e.stopPropagation(); }}
                />
              ) : (
                <video
                  src={activePost.media_url}
                  controls
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000", display: "block" }}
                  onClick={e => { e.stopPropagation(); }}
                />
              )
            )}
            {(!activePost?.media_url) && (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                <div style={{ fontFamily: serif, fontSize: 48, fontWeight: 300, color: "rgba(242,184,75,0.15)", lineHeight: 1 }}>✦</div>
                {activePost?.caption && (
                  <p style={{ fontFamily: serif, fontSize: 22, fontStyle: "italic", fontWeight: 300, color: "var(--text-soft)", maxWidth: 560, lineHeight: 1.6, padding: "0 32px" }}>
                    &ldquo;{activePost.caption}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* Locked overlay */}
            {activePost && (() => {
              const subLocked = activePost.lock_type === "subscription" && !isSubscribed;
              const purchaseLocked = activePost.lock_type === "purchase" && !unlockedPostIds.includes(activePost.id);
              const tierLocked = tierLockedFor(activePost);
              const locked = subLocked || (activePost.tier === "premium" && activePost.lock_type !== "purchase" && !isSubscribed);
              if (!locked && !purchaseLocked && !tierLocked) return null;
              return (
                <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(16px)", background: "rgba(9,9,12,0.7)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 40 }}>{purchaseLocked ? "🔓" : "🔒"}</div>
                  <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(242,184,75,0.8)", margin: 0 }}>
                    {tierLocked ? "Higher tier only" : purchaseLocked ? "Unlock to view" : "Subscribers only"}
                  </p>
                  {activePost.caption && (
                    <p style={{ fontFamily: serif, fontSize: 18, fontStyle: "italic", color: "var(--text-soft)", maxWidth: 400, lineHeight: 1.6, margin: 0 }}>
                      &ldquo;{activePost.caption.slice(0, 120)}&rdquo;
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Fullscreen hint */}
            {activePost?.media_url && (
              <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.6)", borderRadius: 4, padding: "4px 8px", fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
                ⤢ Fullscreen
              </div>
            )}
          </div>
          )}
        </div>
      </section>

      {/* Posts section */}
      {visiblePosts.length > 0 && (
        <div data-cat="sec-posts" style={{ background: "transparent", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-soft)", textAlign: "center", padding: "24px 0 8px" }}>
            {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
          </p>

          {/* Search + tags */}
          {(allTags.length > 0 || visiblePosts.length > 3) && (
            <div style={{ padding: "0 40px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {visiblePosts.length > 3 && (
                <div style={{ position: "relative" }}>
                  <input type="text" value={search} onChange={e => { setSearch(e.target.value); setActiveIdx(0); }}
                    placeholder="Search posts…" style={{
                      width: "100%", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
                      padding: "10px 16px 10px 40px", color: "#ffffff", fontSize: 14,
                      outline: "none", fontFamily: "inherit",
                    }} />
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.4 }}>🔍</span>
                </div>
              )}
              {allTags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => { setActiveTag(null); setActiveIdx(0); }} style={{ padding: "4px 12px", borderRadius: 4, border: "1px solid", borderColor: !activeTag ? "rgba(242,184,75,0.5)" : "rgba(255,255,255,0.1)", background: !activeTag ? "rgba(242,184,75,0.1)" : "transparent", color: !activeTag ? "rgba(242,184,75,0.9)" : "rgba(255,255,255,0.4)", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>All</button>
                  {allTags.map(tag => (
                    <button key={tag} onClick={() => { setActiveTag(activeTag === tag ? null : tag); setActiveIdx(0); }} style={{ padding: "4px 12px", borderRadius: 4, border: "1px solid", borderColor: activeTag === tag ? "rgba(242,184,75,0.5)" : "rgba(255,255,255,0.1)", background: activeTag === tag ? "rgba(242,184,75,0.1)" : "transparent", color: activeTag === tag ? "rgba(242,184,75,0.9)" : "rgba(255,255,255,0.4)", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>{tag}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Carousel */}
          <div style={{ position: "relative" }}>
            <div ref={trackRef}
              onScroll={e => setActiveIdx(Math.round(e.currentTarget.scrollLeft / (CARD_W + CARD_GAP)))}
              style={{ display: "flex", gap: CARD_GAP, overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", padding: "24px 40px 40px", WebkitOverflowScrolling: "touch" }}
            >
              {filteredPosts.map((p, i) => {
                const earlyAccessAt = p.early_access_at ? new Date(p.early_access_at) : null;
                const regularAccessAt = earlyAccessAt ? new Date(earlyAccessAt.getTime() + 30 * 60 * 1000) : null;
                const visibleToRegular = !regularAccessAt || regularAccessAt <= now;
                const subLocked = p.lock_type === "subscription" && !isSubscribed;
                const earlyAccessLocked = p.lock_type === "subscription" && isSubscribed && !hasEarlyAccess && !!earlyAccessAt && !visibleToRegular;
                const purchaseLocked = p.lock_type === "purchase" && !unlockedPostIds.includes(p.id);
                const tierLocked = tierLockedFor(p);
                const locked = subLocked || (p.tier === "premium" && p.lock_type !== "purchase" && !isSubscribed);
                const isActive = activeIdx === i;
                const expiresIn = p.expires_at ? Math.max(0, new Date(p.expires_at).getTime() - now.getTime()) : null;
                const expiresHours = expiresIn ? Math.ceil(expiresIn / 3600000) : null;
                const canView = !(locked || earlyAccessLocked || purchaseLocked || tierLocked);

                return (
                  <div key={p.id}
                    onClick={() => { setActiveIdx(i); if (canView && p.media_url) setLightbox(p); }}
                    style={{
                      flexShrink: 0, width: CARD_W, scrollSnapAlign: "start",
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${p.is_pinned ? "rgba(242,184,75,0.3)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 12, overflow: "hidden", cursor: "pointer",
                      transform: isActive ? "scale(1.03)" : "scale(0.95)",
                      transition: "transform 0.35s ease, box-shadow 0.35s ease, opacity 0.35s ease",
                      opacity: isActive ? 1 : 0.65,
                      boxShadow: isActive ? "0 24px 70px rgba(0,0,0,0.6), 0 0 0 1px rgba(242,184,75,0.2)" : "0 4px 20px rgba(0,0,0,0.3)",
                    }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "scale(1.05)"; el.style.opacity = "1"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = isActive ? "scale(1.03)" : "scale(0.95)"; el.style.opacity = isActive ? "1" : "0.65"; }}
                  >
                    {/* Badges */}
                    <div style={{ position: "relative" }}>
                      {(p.is_pinned || expiresHours || p.post_type !== "post") && (
                        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 3, display: "flex", gap: 6 }}>
                          {p.is_pinned && <span style={{ background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "3px 8px", fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(242,184,75,0.9)" }}>📌</span>}
                          {p.post_type === "vod" && <span style={{ background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "3px 8px", fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(248,113,113,0.9)" }}>🎬 Replay</span>}
                          {expiresHours && expiresHours <= 48 && <span style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 4, padding: "3px 8px", fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(248,113,113,0.9)" }}>⏱ {expiresHours}h</span>}
                        </div>
                      )}

                      {/* Media or gate */}
                      {canView ? (
                        <>
                          {p.media_url && p.media_type === "image" && (
                            <img src={p.media_url} alt="" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
                          )}
                          {p.media_url && p.media_type === "video" && (
                            <div style={{ height: 220, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(242,184,75,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 18, marginLeft: 4 }}>▶</span>
                              </div>
                              <span style={{ position: "absolute", bottom: 10, left: 12, fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-soft)" }}>Click to play</span>
                            </div>
                          )}
                          {!p.media_url && <div style={{ height: 60, background: "rgba(242,184,75,0.03)" }} />}
                        </>
                      ) : (
                        <div style={{ height: 220, position: "relative", background: "linear-gradient(135deg,#111118,#1a1a22)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                          <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(8px)", background: "rgba(10,10,15,0.6)" }} />
                          <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 20px" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>{purchaseLocked ? "🔓" : "🔒"}</div>
                            <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(242,184,75,0.8)", marginBottom: 8 }}>
                              {tierLocked ? "Higher tier only" : purchaseLocked ? "Unlock to view" : "Subscribers only"}
                            </p>
                            {p.caption && <p style={{ fontSize: 11, color: "var(--text-soft)", lineHeight: 1.5, fontStyle: "italic", marginBottom: 12 }}>&ldquo;{p.caption.slice(0, 80)}{p.caption.length > 80 ? "…" : ""}&rdquo;</p>}
                            <div onClick={e => e.stopPropagation()}>
                              {(locked || subLocked) && (
                                <form action="/api/subscribe" method="post">
                                  <input type="hidden" name="creator_profile_id" value={creatorProfileId} />
                                  <button type="submit" style={{ background: "var(--accent)", color: "#09090C", fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", padding: "9px 18px", borderRadius: 4, border: "none", cursor: "pointer" }}>
                                    Subscribe{subscriptionPrice ? ` · $${subscriptionPrice}/mo` : ""}
                                  </button>
                                </form>
                              )}
                              {purchaseLocked && <UnlockButton postId={p.id} price={p.unlock_price} viewerUserId={viewerUserId} />}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card content */}
                    <div style={{ padding: "14px 18px" }}>
                      {canView && p.caption && (
                        <p style={{ fontSize: 14, color: "rgba(242,242,240,0.85)", lineHeight: 1.65, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {p.caption}
                        </p>
                      )}
                      {p.tags && p.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                          {p.tags.slice(0, 3).map(tag => (
                            <button key={tag} onClick={e => { e.stopPropagation(); setActiveTag(activeTag === tag ? null : tag); setActiveIdx(0); }}
                              style={{ padding: "2px 8px", borderRadius: 3, background: "rgba(242,184,75,0.06)", border: "1px solid rgba(242,184,75,0.12)", color: "rgba(242,184,75,0.9)", fontFamily: mono, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-soft)", letterSpacing: "0.06em" }}>
                          {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <LikeButton postId={p.id} initialCount={p.likes_count ?? 0} initialLiked={likedPostIds.includes(p.id)} size="sm" />
                          <MedalButton postId={p.id} initialCount={p.medal_count ?? 0} size="sm" />
                          {canView && (
                            <button onClick={e => { e.stopPropagation(); setTipPost(tipPost === p.id ? null : p.id); }}
                              style={{ background: tipPost === p.id ? "rgba(242,184,75,0.15)" : "none", border: "1px solid rgba(242,184,75,0.2)", borderRadius: 4, padding: "4px 10px", color: "rgba(242,184,75,0.7)", cursor: "pointer", fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              💛 Tip
                            </button>
                          )}
                        </div>
                      </div>
                      {tipPost === p.id && (
                        <div style={{ marginTop: 10, padding: 12, background: "rgba(242,184,75,0.06)", borderRadius: 6, border: "1px solid rgba(242,184,75,0.15)" }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                            {[1,5,10,25].map(a => (
                              <button key={a} onClick={() => setTipAmount(a)} style={{ padding: "5px 10px", borderRadius: 4, border: "1px solid", borderColor: tipAmount===a?"rgba(242,184,75,0.5)":"rgba(255,255,255,0.1)", background: tipAmount===a?"rgba(242,184,75,0.12)":"transparent", color: tipAmount===a?"rgba(242,184,75,0.9)":"rgba(255,255,255,0.5)", fontFamily: mono, fontSize: 11, cursor: "pointer" }}>${a}</button>
                            ))}
                          </div>
                          <button onClick={sendTip} disabled={tipping} style={{ width: "100%", background: "rgba(242,184,75,0.9)", color: "#09090C", fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "9px 0", borderRadius: 4, border: "none", cursor: "pointer", opacity: tipping ? 0.5 : 1 }}>
                            {tipping ? "…" : `Send $${tipAmount}`}
                          </button>
                        </div>
                      )}
                      {canView && isActive && (
                        <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                          <CommentSection postId={p.id} viewerUserId={viewerUserId} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div style={{ flexShrink: 0, width: 24 }} />
            </div>

            {/* Arrows */}
            {filteredPosts.length > 1 && (
              <>
                <button onClick={() => scrollTo(activeIdx - 1)} disabled={activeIdx === 0} style={{ position: "absolute", left: 8, top: "45%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.15)", color: activeIdx === 0 ? "rgba(255,255,255,0.2)" : "#fff", fontSize: 20, cursor: activeIdx === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>‹</button>
                <button onClick={() => scrollTo(activeIdx + 1)} disabled={activeIdx === filteredPosts.length - 1} style={{ position: "absolute", right: 8, top: "45%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.15)", color: activeIdx === filteredPosts.length - 1 ? "rgba(255,255,255,0.2)" : "#fff", fontSize: 20, cursor: activeIdx === filteredPosts.length - 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>›</button>
              </>
            )}

            {/* Dots */}
            {filteredPosts.length > 1 && filteredPosts.length <= 20 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 20 }}>
                {filteredPosts.map((_, i) => (
                  <button key={i} onClick={() => scrollTo(i)} style={{ width: activeIdx === i ? 24 : 6, height: 6, borderRadius: 3, background: activeIdx === i ? "var(--accent)" : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s ease" }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
