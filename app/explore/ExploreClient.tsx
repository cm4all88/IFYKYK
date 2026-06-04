"use client";
import { useState, useEffect, useCallback } from "react";
import { CREATOR_CATEGORIES } from "@/lib/categories";

interface Creator {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  subscription_price: number | null;
  tags: string[];
  location_city: string | null;
  location_country: string | null;
}

interface Props {
  initialCreators: Creator[];
  userId: string | null;
}

export default function ExploreClient({ initialCreators, userId }: Props) {
  const [creators, setCreators] = useState<Creator[]>(initialCreators);
  const [recommendations, setRecommendations] = useState<{ creator: Creator; reason?: string }[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // Load recommendations for logged-in fans
  useEffect(() => {
    if (!userId) return;
    fetch("/api/recommendations?ai=1&limit=6")
      .then(r => r.json())
      .then(data => {
        const recs = (data.creators ?? []).map((c: Creator) => ({
          creator: c,
          reason: data.reasons?.[c.id],
        }));
        setRecommendations(recs);
      })
      .catch(() => {});
  }, [userId]);

  const search = useCallback(async (q: string, tag: string | null) => {
    if (!q && !tag) {
      setCreators(initialCreators);
      return;
    }
    setSearching(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.append("tag", tag);
    const res = await fetch(`/api/search?${params}`);
    const data = await res.json();
    setCreators(data.creators ?? []);
    setSearching(false);
  }, [initialCreators]);

  useEffect(() => {
    const timer = setTimeout(() => search(query, activeTag), 300);
    return () => clearTimeout(timer);
  }, [query, activeTag, search]);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px 120px" }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Discover</p>
        <h1 style={{ fontFamily: "Georgia,serif", fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1.05, marginBottom: 16 }}>
          Find your next <em style={{ color: "#F0B429" }}>favorite creator.</em>
        </h1>
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
          <input
            type="text"
            placeholder="Search by name, bio, or keyword…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: "100%", background: "#111115", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "13px 20px 13px 44px", color: "#F2F2F0", fontSize: 14, outline: "none", fontFamily: "inherit" }}
          />
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--muted)" }}>🔍</span>
        </div>
      </div>

      {/* Tag filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 40 }}>
        <button onClick={() => setActiveTag(null)} style={{
          padding: "7px 14px", borderRadius: 999, border: "1px solid", cursor: "pointer", fontSize: 12, fontFamily: "monospace", letterSpacing: ".06em",
          background: !activeTag ? "rgba(240,180,41,0.1)" : "transparent",
          color: !activeTag ? "#F0B429" : "rgba(255,255,255,0.35)",
          borderColor: !activeTag ? "rgba(240,180,41,0.3)" : "rgba(255,255,255,0.1)",
        }}>All</button>
        {CREATOR_CATEGORIES.filter(c => c.id !== "adult").map(cat => (
          <button key={cat.id} onClick={() => setActiveTag(activeTag === cat.id ? null : cat.id)} style={{
            padding: "7px 14px", borderRadius: 999, border: "1px solid", cursor: "pointer", fontSize: 12,
            background: activeTag === cat.id ? "rgba(240,180,41,0.1)" : "transparent",
            color: activeTag === cat.id ? "#F0B429" : "rgba(255,255,255,0.35)",
            borderColor: activeTag === cat.id ? "rgba(240,180,41,0.3)" : "rgba(255,255,255,0.1)",
          }}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Recommendations section */}
      {recommendations.length > 0 && !query && !activeTag && (
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>
            ✦ Recommended for you
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2, marginBottom: 2 }}>
            {recommendations.map(({ creator: c, reason }) => (
              <CreatorCard key={c.id} creator={c} reason={reason} />
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "32px 0" }} />
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>
            All creators
          </p>
        </div>
      )}

      {/* Creator grid */}
      {searching ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>Searching…</div>
      ) : creators.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <p style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 300, color: "var(--muted)", fontStyle: "italic", marginBottom: 12 }}>No creators match that search.</p>
          <button onClick={() => { setQuery(""); setActiveTag(null); }} style={{ background: "none", border: "none", color: "#F0B429", fontSize: 13, cursor: "pointer" }}>Clear filters →</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 }}>
          {creators.map(c => <CreatorCard key={c.id} creator={c} />)}
        </div>
      )}

      {/* Fan invite banner */}
      {!query && !activeTag && (
        <div style={{ background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "40px 48px", textAlign: "center", marginTop: 64 }}>
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>Don&apos;t see your favorite creator?</p>
          <h3 style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 300, color: "#fff", lineHeight: 1.1, marginBottom: 12 }}>
            Tell them about <em style={{ color: "#F0B429" }}>Spotlightly.</em>
          </h3>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, maxWidth: 420, margin: "0 auto 28px" }}>
            They keep 100% of what they earn. No percentage cuts, no follower minimums.
          </p>
          <a href="https://spotlightly.app/signup" style={{ display: "inline-block", background: "#F0B429", color: "#09090C", fontWeight: 700, fontSize: 13, padding: "12px 28px", borderRadius: 999, textDecoration: "none" }}>
            Send them this link →
          </a>
        </div>
      )}
    </main>
  );
}

function CreatorCard({ creator: c, reason }: { creator: Creator; reason?: string }) {
  return (
    <a href={`/${c.handle}`} style={{ display: "block", background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "24px", textDecoration: "none", transition: "border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.06)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {c.avatar_url
            ? <img src={c.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#F0B429" }}>{(c.display_name ?? c.handle).charAt(0).toUpperCase()}</span>
          }
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#F2F2F0", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.display_name ?? c.handle}
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>@{c.handle}</p>
        </div>
      </div>

      {/* AI reason */}
      {reason && (
        <p style={{ fontSize: 12, color: "#F0B429", fontStyle: "italic", marginBottom: 10, lineHeight: 1.5, background: "rgba(240,180,41,0.06)", border: "1px solid rgba(240,180,41,0.12)", borderRadius: 6, padding: "8px 10px" }}>
          ✦ {reason}
        </p>
      )}

      {c.bio && !reason && (
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {c.bio}
        </p>
      )}

      {/* Tags */}
      {c.tags?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {c.tags.slice(0, 3).map(tag => {
            const cat = CREATOR_CATEGORIES.find(x => x.id === tag);
            return cat ? (
              <span key={tag} style={{ fontSize: 11, color: "var(--muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 999 }}>
                {cat.emoji} {cat.label}
              </span>
            ) : null;
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>Spotlight</span>
          {c.location_city && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>· 📍 {c.location_city}</span>
          )}
          {(c as any).offers_services && (
            <span style={{ fontSize: 11, color: 'rgba(52,211,153,0.7)', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', padding: '1px 7px', borderRadius: 99 }}>📅 Bookings</span>
          )}
        </div>
        {c.subscription_price && (
          <span style={{ fontSize: 12, color: "#F0B429", fontWeight: 700 }}>
            ${Number(c.subscription_price).toFixed(0)}/mo
          </span>
        )}
      </div>
    </a>
  );
}
