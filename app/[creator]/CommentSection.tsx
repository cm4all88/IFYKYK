"use client";
import { useState, useEffect } from "react";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  is_boosted: boolean;
  boosted_until: string | null;
  boost_amount_usd: number | null;
  author: { email: string };
}

interface Props {
  postId: string;
  viewerUserId: string | null;
}

export default function CommentSection({ postId, viewerUserId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    fetch(`/api/comments?postId=${postId}`)
      .then(r => r.json())
      .then(d => setComments(d.comments ?? []));
  }, [postId, expanded]);

  async function submit() {
    if (!text.trim() || !viewerUserId) return;
    setSubmitting(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, content: text.trim() }),
    });
    const data = await res.json();
    if (data.comment) {
      setComments(prev => [...prev, data.comment]);
      setText("");
    }
    setSubmitting(false);
  }

  async function boost(commentId: string) {
    setBoostingId(commentId);
    const res = await fetch("/api/comments/boost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, amountUsd: 4.99 }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { alert(data.error ?? "Could not boost"); setBoostingId(null); }
  }

  const boosted = comments.filter(c => c.is_boosted && (!c.boosted_until || new Date(c.boosted_until) > new Date()));
  const regular = comments.filter(c => !boosted.includes(c));

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 2 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: "100%", textAlign: "left", padding: "12px var(--s-6)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, fontFamily: "var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase" }}
      >
        {expanded ? "Hide" : `Comments ${comments.length > 0 ? `(${comments.length})` : ""}`}
      </button>

      {expanded && (
        <div style={{ padding: "0 var(--s-6) var(--s-6)" }}>
          {/* Boosted comments */}
          {boosted.map(c => (
            <div key={c.id} style={{ background: "rgba(240,180,41,0.06)", border: "1px solid rgba(240,180,41,0.2)", borderRadius: "var(--r-2)", padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-spot)", letterSpacing: ".15em", textTransform: "uppercase" }}>⭐ Boosted</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{c.author?.email?.split("@")[0]}</span>
              </div>
              <p style={{ fontSize: 14, color: "var(--text)", margin: 0, lineHeight: 1.6 }}>{c.content}</p>
            </div>
          ))}

          {/* Regular comments */}
          {regular.map(c => (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginRight: 8 }}>
                  {c.author?.email?.split("@")[0]}
                </span>
                <span style={{ fontSize: 14, color: "var(--text-soft)", lineHeight: 1.6 }}>{c.content}</span>
              </div>
              {viewerUserId && (
                <button
                  onClick={() => boost(c.id)}
                  disabled={boostingId === c.id}
                  style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", background: "none", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "3px 8px", cursor: "pointer" }}
                >
                  {boostingId === c.id ? "…" : "Boost $4.99"}
                </button>
              )}
            </div>
          ))}

          {comments.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>No comments yet.</p>
          )}

          {/* Post comment */}
          {viewerUserId ? (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="text" placeholder="Add a comment…" value={text} maxLength={500}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "9px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={submit} disabled={submitting || !text.trim()} className="btn btn--primary btn--small" style={{ borderRadius: "var(--r-pill)", fontSize: 12 }}>
                {submitting ? "…" : "Post"}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              <a href="/login" style={{ color: "var(--accent-spot)" }}>Sign in</a> to comment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
