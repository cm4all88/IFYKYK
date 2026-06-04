"use client";

import { useState, useEffect } from "react";

interface Addback {
  id: string;
  platform: string;
  price_usd: number;
  description: string | null;
  delivery_days: number;
}

const PLATFORM_LABELS: Record<string, { label: string; emoji: string }> = {
  instagram: { label: "Instagram", emoji: "📷" },
  tiktok:    { label: "TikTok",    emoji: "🎵" },
  youtube:   { label: "YouTube",   emoji: "▶️" },
  twitter:   { label: "X / Twitter", emoji: "🐦" },
  twitch:    { label: "Twitch",    emoji: "💜" },
  discord:   { label: "Discord",   emoji: "🎮" },
  spotify:   { label: "Spotify",   emoji: "🎧" },
};

export default function SocialAddbacks({ creatorProfileId, displayName }: { creatorProfileId: string; displayName: string }) {
  const [addbacks, setAddbacks] = useState<Addback[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [fanHandle, setFanHandle] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch(`/api/social-addbacks?profileId=${creatorProfileId}`)
      .then(r => r.json())
      .then(d => setAddbacks(d.addbacks ?? []));
  }, [creatorProfileId]);

  async function purchase(addbackId: string) {
    if (!fanHandle.trim()) return;
    setProcessing(true);
    const res = await fetch("/api/social-addbacks/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addbackId, fanHandle: fanHandle.trim(), message: message.trim() }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Something went wrong");
    setProcessing(false);
  }

  if (addbacks.length === 0) return null;

  const mono = "var(--font-mono, DM Mono, monospace)";
  const serif = "var(--font-serif, Cormorant Garamond, Georgia, serif)";

  return (
    <div style={{ padding: "40px 40px 0" }}>
      <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>
        Follow-backs from {displayName}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {addbacks.map(ab => {
          const p = PLATFORM_LABELS[ab.platform] ?? { label: ab.platform, emoji: "🔗" };
          const isOpen = buying === ab.id;
          return (
            <div key={ab.id} style={{
              background: "rgba(10,10,15,0.75)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
              padding: "16px 20px", minWidth: 200, maxWidth: 280,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{p.emoji}</span>
                <div>
                  <p style={{ fontFamily: mono, fontSize: 11, color: "rgba(242,184,75,0.9)", margin: "0 0 2px", letterSpacing: "0.08em", textTransform: "uppercase" }}>${ab.price_usd}</p>
                  <p style={{ fontSize: 13, color: "#F2F2F0", margin: 0, fontWeight: 500 }}>{p.label} follow-back</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-soft)", margin: "0 0 12px", lineHeight: 1.5 }}>
                {ab.description || `Delivered within ${ab.delivery_days} days`}
              </p>
              {!isOpen ? (
                <button onClick={() => setBuying(ab.id)} style={{
                  width: "100%", background: "rgba(242,184,75,0.15)", border: "1px solid rgba(242,184,75,0.3)",
                  borderRadius: 6, padding: "8px 0", color: "rgba(242,184,75,0.9)",
                  fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
                }}>
                  Get follow-back · ${ab.price_usd}
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    placeholder={`Your ${p.label} handle`}
                    value={fanHandle}
                    onChange={e => setFanHandle(e.target.value)}
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "8px 12px", color: "#F2F2F0", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                  />
                  <input
                    placeholder="Message (optional)"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "8px 12px", color: "#F2F2F0", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => purchase(ab.id)} disabled={processing || !fanHandle.trim()} style={{
                      flex: 1, background: "rgba(242,184,75,0.9)", border: "none", borderRadius: 6,
                      padding: "9px 0", color: "#09090C", fontFamily: mono, fontSize: 10,
                      letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
                      opacity: processing || !fanHandle.trim() ? 0.5 : 1,
                    }}>
                      {processing ? "…" : `Pay $${ab.price_usd}`}
                    </button>
                    <button onClick={() => setBuying(null)} style={{
                      background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
                      padding: "9px 12px", color: "var(--text-soft)", cursor: "pointer", fontSize: 12,
                    }}>✕</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
