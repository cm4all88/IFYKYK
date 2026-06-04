"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import UnlockButton from "./UnlockButton";
import CommentSection from "./CommentSection";

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
  likes_count?: number;
  tags?: string[];
  is_pinned?: boolean;
  post_type?: string;
}

interface Props {
  posts: Post[];
  isSubscribed: boolean;
  hasEarlyAccess: boolean;
  unlockedPostIds: string[];
  viewerUserId: string | null;
  displayName: string;
  creatorProfileId: string;
  subscriptionPrice: number | null;
}

export default function PostCarousel({
  posts, isSubscribed, hasEarlyAccess, unlockedPostIds,
  viewerUserId, displayName, creatorProfileId, subscriptionPrice,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tippingPost, setTippingPost] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipping, setTipping] = useState(false);

  const CARD_W = 340;
  const CARD_GAP = 16;

  // Filter out expired posts, sort pinned first
  const now = new Date();
  const filteredPosts = useMemo(() => {
    let result = posts.filter(p => !p.expires_at || new Date(p.expires_at) > now);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.caption?.toLowerCase().includes(q) ||
        p.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    if (activeTag) {
      result = result.filter(p => p.tags?.includes(activeTag));
    }

    // Pinned first
    return [...result].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
  }, [posts, search, activeTag, now.getTime()]);

  // All unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    posts.forEach(p => p.tags?.forEach(t => set.add(t)));
    return Array.from(set).slice(0, 12);
  }, [posts]);

  const scrollTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, filteredPosts.length - 1));
    setActiveIdx(clamped);
    if (trackRef.current) {
      trackRef.current.scrollTo({ left: clamped * (CARD_W + CARD_GAP), behavior: "smooth" });
    }
  }, [filteredPosts.length]);

  async function sendTip(postId: string) {
    setTipping(true);
    const res = await fetch("/api/tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_profile_id: creatorProfileId, amount_usd: tipAmount }),
    });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
    setTipping(false);
    setTippingPost(null);
  }

  const mono = "var(--font-mono, DM Mono, monospace)";
  const serif = "var(--font-serif, Cormorant Garamond, Georgia, serif)";

  return (
    <div>
      {/* Search + tag filter */}
      {(allTags.length > 0 || posts.length > 3) && (
        <div style={{ padding: "0 40px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.length > 3 && (
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setActiveIdx(0); }}
                placeholder="Search posts…"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, padding: "10px 16px 10px 40px",
                  color: "#F2F2F0", fontSize: 14, outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <span style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 14, opacity: 0.4,
              }}>🔍</span>
            </div>
          )}

          {allTags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => { setActiveTag(null); setActiveIdx(0); }}
                style={{
                  padding: "4px 12px", borderRadius: 4, border: "1px solid",
                  borderColor: !activeTag ? "rgba(242,184,75,0.5)" : "rgba(255,255,255,0.1)",
                  background: !activeTag ? "rgba(242,184,75,0.1)" : "transparent",
                  color: !activeTag ? "rgba(242,184,75,0.9)" : "rgba(255,255,255,0.4)",
                  fontFamily: mono, fontSize: 10, letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >All</button>
              {allTags.map(tag => (
                <button key={tag} onClick={() => { setActiveTag(activeTag === tag ? null : tag); setActiveIdx(0); }}
                  style={{
                    padding: "4px 12px", borderRadius: 4, border: "1px solid",
                    borderColor: activeTag === tag ? "rgba(242,184,75,0.5)" : "rgba(255,255,255,0.1)",
                    background: activeTag === tag ? "rgba(242,184,75,0.1)" : "transparent",
                    color: activeTag === tag ? "rgba(242,184,75,0.9)" : "rgba(255,255,255,0.4)",
                    fontFamily: mono, fontSize: 10, letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: "pointer",
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filteredPosts.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ fontFamily: serif, fontSize: 20, fontStyle: "italic", color: "var(--muted)", margin: 0 }}>
            {search || activeTag ? "No posts match that search." : "The stage is set."}
          </p>
        </div>
      )}

      {filteredPosts.length > 0 && (
        <div style={{ position: "relative" }}>
          {/* Carousel track */}
          <div
            ref={trackRef}
            onScroll={e => {
              const idx = Math.round(e.currentTarget.scrollLeft / (CARD_W + CARD_GAP));
              setActiveIdx(idx);
            }}
            style={{
              display: "flex", gap: CARD_GAP,
              overflowX: "auto", scrollSnapType: "x mandatory",
              scrollbarWidth: "none", padding: "24px 40px 40px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {filteredPosts.map((p, i) => {
              const earlyAccessAt = p.early_access_at ? new Date(p.early_access_at) : null;
              const regularAccessAt = earlyAccessAt ? new Date(earlyAccessAt.getTime() + 30 * 60 * 1000) : null;
              const visibleToRegular = !regularAccessAt || regularAccessAt <= now;
              const subLocked = p.lock_type === "subscription" && !isSubscribed;
              const earlyAccessLocked = p.lock_type === "subscription" && isSubscribed && !hasEarlyAccess && !!earlyAccessAt && !visibleToRegular;
              const purchaseLocked = p.lock_type === "purchase" && !unlockedPostIds.includes(p.id);
              const locked = subLocked || (p.tier === "premium" && p.lock_type !== "purchase" && !isSubscribed);
              const isExpanded = expandedPost === p.id;
              const isActive = activeIdx === i;

              // Time remaining for expiry
              const expiresIn = p.expires_at ? Math.max(0, new Date(p.expires_at).getTime() - now.getTime()) : null;
              const expiresHours = expiresIn ? Math.ceil(expiresIn / 3600000) : null;

              return (
                <div
                  key={p.id}
                  onClick={() => { setActiveIdx(i); setExpandedPost(isExpanded ? null : p.id); }}
                  style={{
                    flexShrink: 0, width: CARD_W,
                    scrollSnapAlign: "start",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${p.is_pinned ? "rgba(242,184,75,0.3)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 12, overflow: "hidden", cursor: "pointer",
                    transform: isActive ? "scale(1.02)" : "scale(0.97)",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease",
                    opacity: isActive ? 1 : 0.7,
                    boxShadow: isActive
                      ? "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(242,184,75,0.15)"
                      : "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = "scale(1.04)";
                    el.style.opacity = "1";
                    el.style.boxShadow = "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(242,184,75,0.25)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.transform = isActive ? "scale(1.02)" : "scale(0.97)";
                    el.style.opacity = isActive ? "1" : "0.7";
                    el.style.boxShadow = isActive
                      ? "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(242,184,75,0.15)"
                      : "0 4px 20px rgba(0,0,0,0.3)";
                  }}
                >
                  {/* Badges */}
                  <div style={{ position: "relative" }}>
                    {(p.is_pinned || expiresHours || p.post_type === "vod" || p.post_type === "campaign_update") && (
                      <div style={{
                        position: "absolute", top: 10, left: 10, zIndex: 3,
                        display: "flex", gap: 6, flexWrap: "wrap",
                      }}>
                        {p.is_pinned && (
                          <span style={{
                            background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "3px 8px",
                            fontFamily: mono, fontSize: 9, letterSpacing: "0.12em",
                            textTransform: "uppercase", color: "rgba(242,184,75,0.9)",
                          }}>📌 Pinned</span>
                        )}
                        {p.post_type === "vod" && (
                          <span style={{
                            background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "3px 8px",
                            fontFamily: mono, fontSize: 9, letterSpacing: "0.12em",
                            textTransform: "uppercase", color: "rgba(248,113,113,0.9)",
                          }}>🎬 Replay</span>
                        )}
                        {p.post_type === "campaign_update" && (
                          <span style={{
                            background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "3px 8px",
                            fontFamily: mono, fontSize: 9, letterSpacing: "0.12em",
                            textTransform: "uppercase", color: "rgba(96,165,250,0.9)",
                          }}>📣 Update</span>
                        )}
                        {expiresHours && expiresHours <= 48 && (
                          <span style={{
                            background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)",
                            borderRadius: 4, padding: "3px 8px",
                            fontFamily: mono, fontSize: 9, letterSpacing: "0.12em",
                            textTransform: "uppercase", color: "rgba(248,113,113,0.9)",
                          }}>⏱ {expiresHours}h left</span>
                        )}
                      </div>
                    )}

                    {/* Media */}
                    {(locked || earlyAccessLocked || purchaseLocked) ? (
                      <div style={{
                        height: 220, position: "relative",
                        background: "linear-gradient(135deg, #111118, #1a1a22)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexDirection: "column",
                      }}>
                        <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(8px)", background: "rgba(10,10,15,0.6)" }} />
                        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 24px" }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>
                            {earlyAccessLocked ? "⏱" : purchaseLocked ? "🔓" : "🔒"}
                          </div>
                          <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(242,184,75,0.8)", marginBottom: 8 }}>
                            {earlyAccessLocked ? "Early access only" : purchaseLocked ? "Unlock to view" : "Subscribers only"}
                          </p>
                          {p.caption && (
                            <p style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.5, fontStyle: "italic", marginBottom: 16 }}>
                              &ldquo;{p.caption.slice(0, 100)}{p.caption.length > 100 ? "…" : ""}&rdquo;
                            </p>
                          )}
                          <div onClick={e => e.stopPropagation()}>
                            {(locked || subLocked) && (
                              <form action="/api/subscribe" method="post">
                                <input type="hidden" name="creator_profile_id" value={creatorProfileId} />
                                <button type="submit" style={{
                                  background: "var(--accent)", color: "#09090C",
                                  fontFamily: mono, fontSize: 10, letterSpacing: "0.14em",
                                  textTransform: "uppercase", padding: "10px 20px",
                                  borderRadius: 4, border: "none", cursor: "pointer",
                                }}>
                                  Subscribe · {subscriptionPrice ? `$${subscriptionPrice}/mo` : "Subscribe"}
                                </button>
                              </form>
                            )}
                            {purchaseLocked && (
                              <UnlockButton postId={p.id} price={p.unlock_price} viewerUserId={viewerUserId} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {p.media_url && p.media_type === "image" && (
                          <img src={p.media_url} alt="" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
                        )}
                        {p.media_url && p.media_type === "video" && (
                          p.media_url.includes("iframe.mediadelivery.net") ? (
                            <div style={{ position: "relative", paddingTop: "56.25%", background: "#000" }}>
                              <iframe
                                src={`${p.media_url}&responsive=true`}
                                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                                allowFullScreen loading="lazy"
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                          ) : (
                            <video src={p.media_url} style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} controls onClick={e => e.stopPropagation()} />
                          )
                        )}
                        {!p.media_url && (
                          <div style={{ height: 60, background: "rgba(242,184,75,0.03)", borderBottom: "1px solid rgba(242,184,75,0.06)" }} />
                        )}
                      </>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: "14px 18px" }}>
                    {!(locked || earlyAccessLocked || purchaseLocked) && p.caption && (
                      <p style={{
                        fontSize: 14, color: "rgba(242,242,240,0.85)", lineHeight: 1.65, marginBottom: 10,
                        display: "-webkit-box", WebkitLineClamp: isExpanded ? undefined : 3,
                        WebkitBoxOrient: "vertical", overflow: isExpanded ? "visible" : "hidden",
                      }}>
                        {p.caption}
                      </p>
                    )}

                    {/* Tags */}
                    {p.tags && p.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                        {p.tags.slice(0, 4).map(tag => (
                          <button key={tag} onClick={e => { e.stopPropagation(); setActiveTag(tag === activeTag ? null : tag); setActiveIdx(0); }}
                            style={{
                              padding: "2px 8px", borderRadius: 3,
                              background: "rgba(242,184,75,0.06)",
                              border: "1px solid rgba(242,184,75,0.12)",
                              color: "rgba(242,184,75,0.6)",
                              fontFamily: mono, fontSize: 9, letterSpacing: "0.08em",
                              textTransform: "uppercase", cursor: "pointer",
                            }}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Meta row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>
                        {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>

                      {/* Tip button on post */}
                      {!(locked || earlyAccessLocked || purchaseLocked) && (
                        <button
                          onClick={e => { e.stopPropagation(); setTippingPost(tippingPost === p.id ? null : p.id); }}
                          style={{
                            background: tippingPost === p.id ? "rgba(242,184,75,0.15)" : "none",
                            border: "1px solid rgba(242,184,75,0.2)",
                            borderRadius: 4, padding: "4px 10px",
                            color: "rgba(242,184,75,0.7)", cursor: "pointer",
                            fontFamily: mono, fontSize: 10, letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          💛 Tip
                        </button>
                      )}
                    </div>

                    {/* Inline tip panel */}
                    {tippingPost === p.id && (
                      <div style={{ marginTop: 12, padding: "12px", background: "rgba(242,184,75,0.06)", borderRadius: 6, border: "1px solid rgba(242,184,75,0.15)" }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {[1, 5, 10, 25].map(a => (
                            <button key={a} onClick={() => setTipAmount(a)} style={{
                              padding: "5px 10px", borderRadius: 4, border: "1px solid",
                              borderColor: tipAmount === a ? "rgba(242,184,75,0.5)" : "rgba(255,255,255,0.1)",
                              background: tipAmount === a ? "rgba(242,184,75,0.12)" : "transparent",
                              color: tipAmount === a ? "rgba(242,184,75,0.9)" : "rgba(255,255,255,0.5)",
                              fontFamily: mono, fontSize: 11, cursor: "pointer",
                            }}>${a}</button>
                          ))}
                        </div>
                        <button onClick={() => sendTip(p.id)} disabled={tipping} style={{
                          width: "100%", background: "rgba(242,184,75,0.9)", color: "#09090C",
                          fontFamily: mono, fontSize: 10, letterSpacing: "0.12em",
                          textTransform: "uppercase", padding: "9px 0",
                          borderRadius: 4, border: "none", cursor: "pointer",
                          opacity: tipping ? 0.5 : 1,
                        }}>
                          {tipping ? "…" : `Send $${tipAmount} tip`}
                        </button>
                      </div>
                    )}

                    {/* Expanded comments */}
                    {!(locked || earlyAccessLocked || purchaseLocked) && isExpanded && (
                      <div style={{ marginTop: 14 }} onClick={e => e.stopPropagation()}>
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
              <button onClick={() => scrollTo(activeIdx - 1)} disabled={activeIdx === 0} style={{
                position: "absolute", left: 8, top: "45%", transform: "translateY(-50%)",
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)",
                color: activeIdx === 0 ? "rgba(255,255,255,0.2)" : "#fff",
                fontSize: 20, cursor: activeIdx === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
              }}>‹</button>
              <button onClick={() => scrollTo(activeIdx + 1)} disabled={activeIdx === filteredPosts.length - 1} style={{
                position: "absolute", right: 8, top: "45%", transform: "translateY(-50%)",
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)",
                color: activeIdx === filteredPosts.length - 1 ? "rgba(255,255,255,0.2)" : "#fff",
                fontSize: 20, cursor: activeIdx === filteredPosts.length - 1 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
              }}>›</button>
            </>
          )}

          {/* Dots */}
          {filteredPosts.length > 1 && filteredPosts.length <= 20 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 16 }}>
              {filteredPosts.map((_, i) => (
                <button key={i} onClick={() => scrollTo(i)} style={{
                  width: activeIdx === i ? 24 : 6, height: 6, borderRadius: 3,
                  background: activeIdx === i ? "var(--accent)" : "rgba(255,255,255,0.2)",
                  border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s ease",
                }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
