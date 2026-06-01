"use client";
import "@/app/design.css";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InterestPicker from "@/app/(auth)/fan-signup/InterestPicker";

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
  { key: "video",  label: "Video" },
  { key: "image",  label: "Photos" },
  { key: "text",   label: "Written" },
  { key: "locked", label: "Premium" },
];

const mono = "var(--font-mono)";
const serif = "var(--font-serif)";

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

// ── Avatar ─────────────────────────────────────────────────────
function Avatar({ url, name, size, ring = true }: { url: string | null; name?: string; size: number; ring?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
      border: ring ? "1px solid var(--accent-border)" : "none",
      background: "var(--accent-soft)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {url
        ? <img src={url} alt={name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontFamily: serif, fontSize: size * 0.42, color: "var(--accent)" }}>{(name ?? "?")[0]?.toUpperCase()}</span>
      }
    </div>
  );
}

// ── Live Now ───────────────────────────────────────────────────
function LiveNowSection({ streams }: { streams: LiveStream[] }) {
  if (streams.length === 0) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{
          display: "inline-block", width: 7, height: 7, borderRadius: "50%",
          background: "#ef4444", animation: "live-pulse 1.5s ease-in-out infinite",
        }} />
        <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", color: "#ef4444" }}>
          On stage now
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {streams.map((s) => (
          <Link key={s.id} href={`/${s.creator_profile.handle}`} style={{
            display: "flex", alignItems: "center", gap: 14,
            background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 10, padding: "14px 18px", textDecoration: "none", transition: "border-color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(239,68,68,0.18)")}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Avatar url={s.creator_profile.avatar_url} name={s.creator_profile.display_name} size={44} ring={false} />
              <span style={{
                position: "absolute", bottom: -2, right: -2, background: "#ef4444", borderRadius: 3,
                padding: "1px 4px", fontFamily: mono, fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff",
              }}>Live</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: serif, fontSize: 18, fontWeight: 400, color: "var(--text)", margin: "0 0 3px", lineHeight: 1.2 }}>
                {s.creator_profile.display_name}
              </p>
              <p style={{ fontFamily: mono, fontSize: 11, color: "var(--muted-faint)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.title}
              </p>
            </div>
            <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ef4444", flexShrink: 0 }}>
              Watch →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Creator strip ──────────────────────────────────────────────
function CreatorStrip({ creators }: { creators: Creator[] }) {
  if (creators.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 20, overflowX: "auto", padding: "0 24px 24px", scrollbarWidth: "none" }}>
      {creators.map((c) => (
        <Link key={c.id} href={`/${c.handle}`} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0,
        }}>
          <Avatar url={c.avatar_url} name={c.display_name} size={56} />
          <span style={{
            fontFamily: mono, fontSize: 9, letterSpacing: "0.06em", color: "var(--muted-faint)",
            maxWidth: 64, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            @{c.handle}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ── Video with hover-play ──────────────────────────────────────
function VideoMedia({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <video
      ref={ref}
      src={src}
      muted playsInline loop preload="metadata"
      style={{ width: "100%", display: "block", maxHeight: 540, objectFit: "cover" }}
      onMouseEnter={() => ref.current?.play()}
      onMouseLeave={() => { if (ref.current) { ref.current.pause(); ref.current.currentTime = 0; } }}
    />
  );
}

// ── Post card ──────────────────────────────────────────────────
function PostCard({ post }: { post: Post }) {
  const creator = post.creator_profile;
  const hasMedia = !!post.media_url;
  const isLocked = !post.isUnlocked && post.tier !== "free";

  return (
    <article className="feed-card">
      {/* Playbill credit line */}
      <div style={{
        display: "flex", alignItems: "center", gap: 13, padding: "18px 22px",
        borderBottom: hasMedia ? "1px solid rgba(255,255,255,0.05)" : "none",
      }}>
        <Link href={`/${creator.handle}`} style={{ flexShrink: 0 }}>
          <Avatar url={creator.avatar_url} name={creator.display_name} size={38} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/${creator.handle}`} style={{ textDecoration: "none" }}>
            <p style={{ fontFamily: serif, fontSize: 17, fontWeight: 400, color: "var(--text)", margin: 0, lineHeight: 1.2 }}>
              {creator.display_name}
            </p>
          </Link>
          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.08em", color: "var(--muted-faint)", margin: "3px 0 0" }}>
            @{creator.handle} · {timeAgo(post.created_at)}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {post.is_pinned && (
            <span className="badge badge--accent">Pinned</span>
          )}
          {post.tier !== "free" && (
            <span className={`badge ${post.isUnlocked ? "badge--green" : "badge--accent"}`}>
              {post.isUnlocked ? "Unlocked" : "Premium"}
            </span>
          )}
        </div>
      </div>

      {/* Media */}
      {hasMedia && (
        <div style={{ position: "relative", background: "#080809" }}>
          {isLocked ? (
            <div style={{ position: "relative", overflow: "hidden" }}>
              {post.media_type === "video"
                ? <video src={post.media_url!} muted style={{ width: "100%", display: "block", maxHeight: 380, objectFit: "cover", filter: "blur(22px) brightness(0.38)", transform: "scale(1.06)" }} />
                : <img src={post.media_url!} alt="" style={{ width: "100%", display: "block", maxHeight: 380, objectFit: "cover", filter: "blur(22px) brightness(0.38)", transform: "scale(1.06)" }} />
              }
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
                background: "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(9,9,12,0.15) 0%, rgba(9,9,12,0.7) 100%)",
              }}>
                <div style={{
                  width: 54, height: 54, borderRadius: "50%", background: "var(--accent-soft)",
                  border: "1px solid var(--accent-border)", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 20, color: "var(--accent)",
                }}>✦</div>
                <p style={{ fontFamily: serif, fontSize: 20, fontStyle: "italic", fontWeight: 300, color: "var(--text)", margin: 0, textAlign: "center" }}>
                  Behind the curtain
                </p>
                <Link href={`/${creator.handle}`} className="btn btn--primary btn--small">
                  Subscribe to unlock
                </Link>
              </div>
            </div>
          ) : (
            post.media_type === "video"
              ? <VideoMedia src={post.media_url!} />
              : <img src={post.media_url!} alt={post.caption ?? ""} style={{ width: "100%", display: "block", maxHeight: 580, objectFit: "cover" }} />
          )}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div style={{ padding: hasMedia ? "18px 22px 22px" : "26px 24px" }}>
          {!hasMedia ? (
            <p style={{ fontFamily: serif, fontSize: 22, fontWeight: 300, lineHeight: 1.6, color: "var(--text-soft)", margin: 0, fontStyle: "italic" }}>
              {isLocked ? post.caption.slice(0, 120) + "…" : post.caption}
            </p>
          ) : (
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text-soft)", margin: 0 }}>
              {isLocked ? post.caption.slice(0, 80) + "…" : post.caption}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ── Act divider ────────────────────────────────────────────────
function ActDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, margin: "32px 0 18px" }}>
      <span className="feed-act">{label}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="empty-state">
      <p className="empty-state-icon">✦</p>
      <h2 className="empty-state-title">The house lights are up.</h2>
      <p className="empty-state-body" style={{ maxWidth: 360, margin: "0 auto var(--s-8)" }}>
        Subscribe to a few creators and their work fills this space — your own curated lineup, no algorithm deciding for you.
      </p>
      <Link href="/explore" className="btn btn--primary">Find creators →</Link>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="feed-card" style={{ animation: "feed-pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}>
          <div style={{ padding: "18px 22px", display: "flex", gap: 13, alignItems: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: "40%", background: "rgba(255,255,255,0.05)", borderRadius: 2, marginBottom: 6 }} />
              <div style={{ height: 10, width: "22%", background: "rgba(255,255,255,0.03)", borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ height: i === 2 ? 130 : 300, background: "rgba(255,255,255,0.03)" }} />
          <div style={{ padding: "16px 22px" }}>
            <div style={{ height: 12, width: "72%", background: "rgba(255,255,255,0.04)", borderRadius: 2, marginBottom: 8 }} />
            <div style={{ height: 12, width: "46%", background: "rgba(255,255,255,0.03)", borderRadius: 2 }} />
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
  const [isCreator, setIsCreator] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [needsInterests, setNeedsInterests] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/profile/me").then(r => r.json()).catch(() => null);
      const creator = !!me?.profile;
      setIsCreator(creator);
      if (creator) { setNeedsInterests(false); return; }
      const ints = await fetch("/api/fan/interests").then(r => r.json()).catch(() => ({ interests: [] }));
      setNeedsInterests(((ints?.interests ?? []).length === 0));
    })();
  }, []);

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

  useEffect(() => { if (needsInterests === false) load(filter, null, false); }, [filter, needsInterests]);

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

  if (needsInterests === true) {
    return (
      <InterestPicker
        returnUrl="/feed"
        onDone={() => { setNeedsInterests(false); load(filter, null, false); }}
      />
    );
  }

  return (
    <main className="spotlight-stage" style={{ minHeight: "100vh", paddingBottom: 96 }}>
      <div className="spotlight-beam" aria-hidden="true" />

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "rgba(9,9,12,0.78)", backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 660, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "18px 0 0" }}>
            <Link href="/" className="brand-logo" style={{ justifySelf: "start", fontSize: 22 }}>Spot<span>light</span>ly</Link>
            <span className="feed-kicker">Your lineup</span>
            <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 8 }}>
              {isCreator && (
                <Link href="/dashboard" className="nav-pill nav-pill--secondary">Dashboard</Link>
              )}
              <Link href="/account" className="nav-pill nav-pill--primary">Account</Link>
            </div>
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "14px 0 0", scrollbarWidth: "none" }}>
            {FILTERS.map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)} className={`feed-filter${filter === key ? " feed-filter--active" : ""}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Body */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 660, margin: "0 auto", padding: "0 24px" }}>

        {/* Editorial intro */}
        <div style={{ textAlign: "center", padding: "56px 0 44px" }}>
          <h1 className="feed-hero" style={{ fontSize: "clamp(38px, 7vw, 60px)", marginBottom: 14 }}>
            Tonight's <em>lineup.</em>
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-faint)", margin: "0 auto", maxWidth: 420, lineHeight: 1.6 }}>
            Everyone you follow, in one place — on their terms, not an algorithm's.
          </p>
        </div>

        <LiveNowSection streams={liveStreams} />

        {/* Creator strip */}
        {!loading && creators.length > 0 && (
          <div style={{ marginBottom: 16, marginLeft: -24, marginRight: -24 }}>
            <CreatorStrip creators={creators} />
          </div>
        )}

        {loading ? (
          <Skeleton />
        ) : posts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {grouped.map(({ label, posts: dayPosts }) => (
              <div key={label}>
                <ActDivider label={label} />
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {dayPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div style={{ textAlign: "center", padding: "40px 0 0" }}>
                <button onClick={loadMore} disabled={loadingMore} className="btn btn--secondary">
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div style={{ textAlign: "center", padding: "48px 0 0" }}>
                <span className="feed-act">End of tonight's show</span>
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
        @keyframes feed-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}
