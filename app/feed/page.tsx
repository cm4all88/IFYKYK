"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Filter = "all" | "video" | "image" | "text" | "locked";

interface LiveStream {
  id: string;
  title: string;
  playback_url: string;
  started_at: string;
  creator_profile_id: string;
  creator_profile: Creator;
}

interface Creator {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  kind: string;
}

interface Post {
  id: string;
  creator_profile_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  tier: string;
  content_rating: string;
  likes_count: number;
  views_count: number;
  created_at: string;
  is_pinned: boolean;
  isUnlocked: boolean;
  isSubscribed: boolean;
  creator_profile: Creator;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",    label: "All" },
  { key: "video",  label: "▶ Video" },
  { key: "image",  label: "⬜ Photo" },
  { key: "text",   label: "✦ Text" },
  { key: "locked", label: "🔒 Locked" },
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Tonight";
  if (d.toDateString() === yesterday.toDateString()) return "Last Night";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Live Now banner ───────────────────────────────────────────
function LiveNowSection({ streams }: { streams: LiveStream[] }) {
  if (streams.length === 0) return null;
  const mono = "DM Mono, monospace";
  const serif = "Cormorant Garamond, Georgia, serif";
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{
          display: "inline-block", width: 8, height: 8, borderRadius: "50%",
          background: "#ef4444",
          boxShadow: "0 0 0 0 rgba(239,68,68,0.4)",
          animation: "live-pulse 1.5s ease-in-out infinite",
        }} />
        <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#ef4444" }}>
          Live now
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {streams.map((s) => (
          <Link key={s.id} href={`/${s.creator_profile.handle}`} style={{
            display: "flex", alignItems: "center", gap: 14,
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, padding: "14px 18px",
            textDecoration: "none", transition: "border-color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)")}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", overflow: "hidden",
                border: "2px solid rgba(239,68,68,0.4)",
                background: "rgba(239,68,68,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {s.creator_profile.avatar_url
                  ? <img src={s.creator_profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontFamily: serif, fontSize: 18, color: "rgba(239,68,68,0.6)" }}>{s.creator_profile.display_name?.[0]?.toUpperCase()}</span>
                }
              </div>
              <span style={{
                position: "absolute", bottom: -2, right: -2,
                background: "#ef4444", borderRadius: 3, padding: "1px 4px",
                fontFamily: mono, fontSize: 7, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#fff",
              }}>Live</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: serif, fontSize: 17, fontWeight: 400, color: "#fff", margin: "0 0 3px", lineHeight: 1.2 }}>
                {s.creator_profile.display_name}
              </p>
              <p style={{ fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.title}
              </p>
            </div>
            <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ef4444", flexShrink: 0 }}>
              Watch →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Creator avatar strip ───────────────────────────────────────
function CreatorStrip({ creators }: { creators: Creator[] }) {
  if (creators.length === 0) return null;
  return (
    <div style={{
      display: "flex", gap: 16, overflowX: "auto", padding: "0 24px 20px",
      scrollbarWidth: "none",
    }}>
      {creators.map((c) => (
        <Link key={c.id} href={`/${c.handle}`} style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 8, textDecoration: "none", flexShrink: 0,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", overflow: "hidden",
            border: "2px solid rgba(240,180,41,0.3)",
            background: "rgba(240,180,41,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {c.avatar_url
              ? <img src={c.avatar_url} alt={c.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 20, color: "rgba(240,180,41,0.6)" }}>{c.display_name?.[0]?.toUpperCase()}</span>
            }
          </div>
          <span style={{
            fontFamily: "DM Mono, monospace", fontSize: 9, letterSpacing: "0.08em",
            color: "#52525b", maxWidth: 60, textAlign: "center",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            @{c.handle}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ── Video card with hover-play ─────────────────────────────────
function VideoMedia({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <video
      ref={ref}
      src={src}
      muted playsInline loop preload="metadata"
      style={{ width: "100%", display: "block", maxHeight: 520, objectFit: "cover" }}
      onMouseEnter={() => ref.current?.play()}
      onMouseLeave={() => { if (ref.current) { ref.current.pause(); ref.current.currentTime = 0; } }}
    />
  );
}

// ── Single post card ───────────────────────────────────────────
function PostCard({ post }: { post: Post }) {
  const creator = post.creator_profile;
  const hasMedia = !!post.media_url;
  const isLocked = !post.isUnlocked && post.tier !== "free";
  const mono = "DM Mono, monospace";
  const serif = "Cormorant Garamond, Georgia, serif";

  return (
    <article style={{
      background: "#0E0E12",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
    >
      {/* Creator credit — playbill style */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 20px",
        borderBottom: hasMedia ? "1px solid rgba(255,255,255,0.04)" : "none",
      }}>
        <Link href={`/${creator.handle}`} style={{ display: "block", flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", overflow: "hidden",
            background: "rgba(240,180,41,0.08)",
            border: "1px solid rgba(240,180,41,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {creator.avatar_url
              ? <img src={creator.avatar_url} alt={creator.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontFamily: serif, fontSize: 16, color: "rgba(240,180,41,0.6)" }}>{creator.display_name?.[0]?.toUpperCase()}</span>
            }
          </div>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/${creator.handle}`} style={{ textDecoration: "none" }}>
            <p style={{ fontFamily: serif, fontSize: 16, fontWeight: 400, color: "#fff", margin: 0, lineHeight: 1.2 }}>
              {creator.display_name}
            </p>
          </Link>
          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", color: "#52525b", margin: "3px 0 0" }}>
            @{creator.handle}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {post.is_pinned && (
            <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(240,180,41,0.6)", background: "rgba(240,180,41,0.08)", border: "1px solid rgba(240,180,41,0.2)", padding: "2px 7px", borderRadius: 2 }}>
              Pinned
            </span>
          )}
          {post.tier !== "free" && (
            <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: post.isUnlocked ? "rgba(52,211,153,0.7)" : "rgba(240,180,41,0.6)", background: post.isUnlocked ? "rgba(52,211,153,0.08)" : "rgba(240,180,41,0.08)", border: `1px solid ${post.isUnlocked ? "rgba(52,211,153,0.2)" : "rgba(240,180,41,0.2)"}`, padding: "2px 7px", borderRadius: 2 }}>
              {post.isUnlocked ? "Unlocked" : "Premium"}
            </span>
          )}
          <span style={{ fontFamily: mono, fontSize: 9, color: "#3f3f46" }}>
            {timeAgo(post.created_at)}
          </span>
        </div>
      </div>

      {/* Media */}
      {hasMedia && (
        <div style={{ position: "relative", background: "#080808" }}>
          {isLocked ? (
            <div style={{ position: "relative", overflow: "hidden" }}>
              {/* Blurred preview */}
              {post.media_type === "video"
                ? <video src={post.media_url!} muted style={{ width: "100%", display: "block", maxHeight: 360, objectFit: "cover", filter: "blur(20px) brightness(0.4)", transform: "scale(1.05)" }} />
                : <img src={post.media_url!} alt="" style={{ width: "100%", display: "block", maxHeight: 360, objectFit: "cover", filter: "blur(20px) brightness(0.4)", transform: "scale(1.05)" }} />
              }
              {/* Lock overlay */}
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 12, padding: 24,
                background: "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "rgba(240,180,41,0.1)",
                  border: "1px solid rgba(240,180,41,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>
                  🔒
                </div>
                <p style={{ fontFamily: serif, fontSize: 18, fontStyle: "italic", color: "rgba(255,255,255,0.8)", margin: 0, textAlign: "center" }}>
                  Subscriber exclusive
                </p>
                <Link href={`/${creator.handle}`} style={{
                  fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase",
                  color: "#09090C", background: "#F0B429", padding: "10px 20px",
                  borderRadius: 3, textDecoration: "none",
                }}>
                  Subscribe to {creator.display_name}
                </Link>
              </div>
            </div>
          ) : (
            post.media_type === "video"
              ? <VideoMedia src={post.media_url!} />
              : <img src={post.media_url!} alt={post.caption ?? ""} style={{ width: "100%", display: "block", maxHeight: 560, objectFit: "cover" }} />
          )}
        </div>
      )}

      {/* Caption / text content */}
      {post.caption && (
        <div style={{ padding: hasMedia ? "16px 20px 20px" : "4px 20px 20px" }}>
          {!hasMedia ? (
            // Text-only post — large serif display
            <p style={{
              fontFamily: serif,
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.85)",
              margin: 0,
              fontStyle: "italic",
            }}>
              {isLocked ? post.caption.slice(0, 120) + "…" : post.caption}
            </p>
          ) : (
            <p style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.65)",
              margin: 0,
            }}>
              {isLocked ? post.caption.slice(0, 80) + "…" : post.caption}
            </p>
          )}
        </div>
      )}

      {/* Footer stats */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "12px 20px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        {post.views_count > 0 && (
          <span style={{ fontFamily: mono, fontSize: 10, color: "#3f3f46", letterSpacing: "0.08em" }}>
            {post.views_count.toLocaleString()} views
          </span>
        )}
        {post.likes_count > 0 && (
          <span style={{ fontFamily: mono, fontSize: 10, color: "#3f3f46", letterSpacing: "0.08em" }}>
            ♥ {post.likes_count.toLocaleString()}
          </span>
        )}
        <div style={{ marginLeft: "auto" }}>
          <Link href={`/${creator.handle}`} style={{
            fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "#52525b", textDecoration: "none",
            transition: "color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#F0B429")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#52525b")}
          >
            View page →
          </Link>
        </div>
      </div>
    </article>
  );
}

// ── Act divider ────────────────────────────────────────────────
function ActDivider({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, margin: "8px 0",
    }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <span style={{
        fontFamily: "DM Mono, monospace", fontSize: 9,
        letterSpacing: "0.25em", textTransform: "uppercase",
        color: "#3f3f46",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────
function EmptyState() {
  const serif = "Cormorant Garamond, Georgia, serif";
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <p style={{ fontSize: 48, marginBottom: 24, opacity: 0.3 }}>✦</p>
      <h2 style={{ fontFamily: serif, fontSize: 32, fontWeight: 300, color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>
        The stage is empty.
      </h2>
      <p style={{ fontSize: 15, color: "#52525b", lineHeight: 1.7, marginBottom: 32, maxWidth: 340, margin: "0 auto 32px" }}>
        Subscribe to creators to see their posts here — your own curated lineup.
      </p>
      <Link href="/" style={{
        fontFamily: "DM Mono, monospace", fontSize: 11, letterSpacing: "0.18em",
        textTransform: "uppercase", color: "#09090C", background: "#F0B429",
        padding: "14px 28px", borderRadius: 3, textDecoration: "none",
      }}>
        Find creators →
      </Link>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          background: "#0E0E12", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8, overflow: "hidden",
          animation: "feed-pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.15}s`,
        }}>
          <div style={{ padding: "16px 20px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: "40%", background: "rgba(255,255,255,0.05)", borderRadius: 2, marginBottom: 6 }} />
              <div style={{ height: 10, width: "20%", background: "rgba(255,255,255,0.03)", borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ height: i === 2 ? 120 : 280, background: "rgba(255,255,255,0.03)" }} />
          <div style={{ padding: "14px 20px" }}>
            <div style={{ height: 12, width: "70%", background: "rgba(255,255,255,0.04)", borderRadius: 2, marginBottom: 8 }} />
            <div style={{ height: 12, width: "45%", background: "rgba(255,255,255,0.03)", borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main feed page ─────────────────────────────────────────────
export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [cursor, setCursor] = useState<string | null>(null);

  async function load(f: Filter, cur: string | null, append = false) {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    const params = new URLSearchParams({ filter: f });
    if (cur) params.set("cursor", cur);

    const res = await fetch(`/api/feed?${params}`);
    if (res.status === 401) { router.push("/login"); return; }

    const data = await res.json();
    if (append) setPosts((prev) => [...prev, ...(data.posts ?? [])]);
    else {
      setPosts(data.posts ?? []);
      setCreators(data.creators ?? []);
      setLiveStreams(data.liveStreams ?? []);
    }
    setHasMore(data.hasMore ?? false);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => { load(filter, null, false); }, [filter]);

  function loadMore() {
    if (!posts.length) return;
    const last = posts[posts.length - 1].created_at;
    setCursor(last);
    load(filter, last, true);
  }

  // Group posts by day
  const grouped: { label: string; posts: Post[] }[] = [];
  for (const post of posts) {
    const label = dayLabel(post.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.label === label) last.posts.push(post);
    else grouped.push({ label, posts: [post] });
  }

  const mono = "DM Mono, monospace";
  const serif = "Cormorant Garamond, Georgia, serif";

  return (
    <main style={{
      minHeight: "100vh",
      background: "#09090C",
      backgroundImage: "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(240,180,41,0.06) 0%, transparent 65%)",
      paddingBottom: 80,
    }}>

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(9,9,12,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px" }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 0" }}>
            <div>
              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#3f3f46", margin: 0, marginBottom: 4 }}>
                Your lineup
              </p>
              <h1 style={{ fontFamily: serif, fontSize: 26, fontWeight: 300, color: "#fff", margin: 0, lineHeight: 1 }}>
                The Feed
              </h1>
            </div>
            <Link href="/dashboard" style={{
              fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
              color: "#52525b", textDecoration: "none", padding: "8px 14px",
              border: "1px solid rgba(255,255,255,0.07)", borderRadius: 3,
            }}>
              Dashboard
            </Link>
          </div>

          {/* Filter pills */}
          <div style={{
            display: "flex", gap: 6, overflowX: "auto", padding: "14px 0",
            scrollbarWidth: "none",
          }}>
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  flexShrink: 0, padding: "6px 14px",
                  fontFamily: mono, fontSize: 10, letterSpacing: "0.08em",
                  background: filter === key ? "#F0B429" : "rgba(255,255,255,0.04)",
                  color: filter === key ? "#09090C" : "#71717a",
                  border: `1px solid ${filter === key ? "#F0B429" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 3, cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 24px 0" }}>

        {/* Live now */}
        <LiveNowSection streams={liveStreams} />

        {/* Creator avatar strip */}
        {!loading && creators.length > 0 && (
          <div style={{ marginBottom: 24, marginLeft: -24, marginRight: -24 }}>
            <CreatorStrip creators={creators} />
          </div>
        )}

        {loading ? (
          <Skeleton />
        ) : posts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {grouped.map(({ label, posts: dayPosts }, gi) => (
              <div key={label}>
                <ActDivider label={label} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 8 }}>
                  {dayPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 4, padding: "14px 32px",
                    fontFamily: mono, fontSize: 10, letterSpacing: "0.15em",
                    textTransform: "uppercase", color: "#71717a",
                    cursor: loadingMore ? "default" : "pointer",
                    opacity: loadingMore ? 0.5 : 1,
                  }}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#3f3f46" }}>
                  — End of tonight's show —
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes live-pulse {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes feed-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}
