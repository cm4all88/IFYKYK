"use client";

import React from "react";
import LikeButton from "@/components/LikeButton";
import CommentSection from "@/app/[creator]/CommentSection";

type Item = {
  id: string;
  caption: string | null;
  isImg: boolean;
  isVid: boolean;
  entitled: boolean;
  mediaUrl: string | null;
  blur: string | null;
  lockTierName: string | null;
  tags: string[];
  likesCount: number;
};

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function pill(active: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono, monospace)", fontSize: 11, letterSpacing: "0.02em",
    padding: "7px 14px", borderRadius: 999, cursor: "pointer",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#0A0A0D" : "var(--text-soft, rgba(247,243,236,0.85))",
    border: `1px solid ${active ? "var(--accent)" : "var(--border, rgba(255,255,255,0.12))"}`,
    fontWeight: active ? 700 : 500,
  };
}
function chip(active: boolean): React.CSSProperties {
  return {
    fontSize: 12, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
    background: active ? "rgba(242,184,75,0.14)" : "transparent",
    color: active ? "var(--accent)" : "var(--muted, #C8C4BE)",
    border: `1px solid ${active ? "var(--accent-border, rgba(242,184,75,0.4))" : "var(--border, rgba(255,255,255,0.1))"}`,
  };
}

export default function CreatorFeed({ items, viewerUserId, fn }: { items: Item[]; viewerUserId: string | null; fn: string }) {
  const [sort, setSort] = React.useState<"new" | "liked">("new");
  const [tag, setTag] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<Item | null>(null);

  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => (i.tags || []).forEach((t) => t && set.add(t)));
    return Array.from(set).slice(0, 24);
  }, [items]);

  let shown = tag ? items.filter((i) => (i.tags || []).includes(tag)) : items.slice();
  if (sort === "liked") shown = [...shown].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
  // "new" keeps the incoming order (pinned first, then most recent)

  return (
    <div>
      {/* sort + (optional) tag filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: allTags.length ? 12 : 18 }}>
        <button onClick={() => setSort("new")} style={pill(sort === "new")}>Newest</button>
        <button onClick={() => setSort("liked")} style={pill(sort === "liked")}>Most liked</button>
      </div>
      {allTags.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          <button onClick={() => setTag(null)} style={chip(tag === null)}>All</button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTag((cur) => (cur === t ? null : t))} style={chip(tag === t)}>#{t}</button>
          ))}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted, #C8C4BE)", textAlign: "center", padding: "20px 0" }}>Nothing tagged #{tag} yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 14 }}>
          {shown.map((p) => (
            <div
              key={p.id}
              className="ring-gold"
              onClick={() => { if (p.entitled) setOpen(p); }}
              style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", cursor: p.entitled ? "pointer" : "default" }}
            >
              {p.entitled && p.mediaUrl && p.isImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.mediaUrl} alt="" style={{ width: "100%", height: 256, objectFit: "cover", display: "block" }} />
              ) : p.entitled && p.mediaUrl && p.isVid ? (
                <video src={p.mediaUrl} preload="metadata" muted playsInline style={{ width: "100%", height: 256, objectFit: "cover", display: "block", background: "#000" }} />
              ) : p.blur ? (
                <div style={{ position: "relative", height: 256, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.blur} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "blur(8px)", transform: "scale(1.15)" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(9,9,12,0.34)" }}>
                    <span style={{ fontSize: 20 }}>🔒</span>
                    <a href="#support" onClick={(e) => e.stopPropagation()} style={{ fontSize: 12, color: "#0A0A0D", background: "var(--accent)", padding: "8px 16px", borderRadius: 999, textDecoration: "none", fontWeight: 700 }}>
                      {p.lockTierName ? `Join ${p.lockTierName} to see` : "Subscribe to see"}
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ height: 256, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "linear-gradient(160deg, rgba(242,184,75,0.06), rgba(255,255,255,0.02))" }}>
                  <span style={{ fontSize: 20 }}>🔒</span>
                  <a href="#support" onClick={(e) => e.stopPropagation()} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>
                    {p.lockTierName ? `Join ${p.lockTierName} to see` : "Subscribe to see"}
                  </a>
                </div>
              )}

              <div style={{ padding: "11px 14px" }}>
                {p.caption ? <div style={{ fontSize: 13, color: "rgba(247,243,236,0.82)", lineHeight: 1.5, marginBottom: (p.tags.length || p.likesCount || p.entitled) ? 8 : 0 }}>{clamp(String(p.caption), 120)}</div> : null}
                {p.tags.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {p.tags.slice(0, 4).map((t) => (
                      <span key={t} onClick={(e) => { e.stopPropagation(); setTag(t); }} style={{ fontSize: 10.5, color: "var(--muted, #C8C4BE)", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 999, cursor: "pointer" }}>#{t}</span>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, color: "var(--muted, #C8C4BE)" }}>
                  <span>♥ {p.likesCount}</span>
                  {p.entitled ? <span>💬 Comments</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div
          onClick={() => setOpen(null)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(9,9,12,0.85)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, background: "var(--bg, #17181B)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 12px 0" }}>
              <button onClick={() => setOpen(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            {open.mediaUrl && open.isImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.mediaUrl} alt="" style={{ width: "100%", maxHeight: 460, objectFit: "contain", display: "block", background: "#000" }} />
            ) : open.mediaUrl && open.isVid ? (
              <video src={open.mediaUrl} controls autoPlay playsInline style={{ width: "100%", maxHeight: 460, display: "block", background: "#000" }} />
            ) : null}

            <div style={{ padding: "16px 20px 22px" }}>
              {open.caption ? <p style={{ fontSize: 14.5, color: "var(--text, #F7F3EC)", lineHeight: 1.6, margin: "0 0 12px" }}>{open.caption}</p> : null}
              {open.tags.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {open.tags.map((t) => (
                    <span key={t} onClick={() => { setTag(t); setOpen(null); }} style={{ fontSize: 12, color: "var(--accent)", background: "rgba(242,184,75,0.1)", padding: "3px 10px", borderRadius: 999, cursor: "pointer" }}>#{t}</span>
                  ))}
                </div>
              ) : null}

              <div style={{ marginBottom: 18 }}>
                <LikeButton postId={open.id} initialCount={open.likesCount} />
              </div>

              <CommentSection postId={open.id} viewerUserId={viewerUserId} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
