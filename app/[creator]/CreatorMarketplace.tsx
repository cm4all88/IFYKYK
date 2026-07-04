"use client";

import { useState, useEffect } from "react";
import { InlineError } from "./InlineError";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  price_usd: number;
  condition: string;
  category: string;
  images: string[];
  quantity: number;
  subscriber_only: boolean;
  personal_note: string | null;
  autograph: boolean;
  status: string;
}

const CONDITION_LABELS: Record<string, string> = {
  new: "New", like_new: "Like new", good: "Good", fair: "Fair"
};

const CATEGORY_ICONS: Record<string, string> = {
  clothing: "👗", accessories: "👜", prints: "🖼️",
  gear: "🎥", signed: "✍️", personal: "💛", other: "📦"
};

export default function CreatorMarketplace({
  creatorProfileId, displayName, isSubscribed
}: { creatorProfileId: string; displayName: string; isSubscribed: boolean }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [processing, setProcessing] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/marketplace?profileId=${creatorProfileId}`)
      .then(r => r.json())
      .then(d => { setListings(d.listings ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [creatorProfileId]);

  const visible = listings.filter(l => !l.subscriber_only || isSubscribed);
  if (!loaded) return null;
  if (visible.length === 0) {
    return (
      <div className="cp-rail-section">
        <span className="cp-rail-kicker">Marketplace</span>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "22px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 26, marginBottom: 6, opacity: 0.5 }}>🛍️</div>
          <p style={{ fontFamily: "var(--font-serif, serif)", fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>Nothing listed yet</p>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{displayName}&apos;s marketplace items will show here.</p>
        </div>
      </div>
    );
  }

  const mono = "var(--font-mono, DM Mono, monospace)";
  const serif = "var(--font-serif, Cormorant Garamond, Georgia, serif)";

  async function purchase(listingId: string) {
    setProcessing(true);
    setError(null);
    const res = await fetch("/api/marketplace/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setError(data.error ?? "Something went wrong");
    setProcessing(false);
  }

  return (
    <>
      {/* Lightbox / detail view */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0f0f14", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, overflow: "hidden", maxWidth: 720, width: "100%",
            display: "grid", gridTemplateColumns: "1fr 1fr",
          }}>
            {/* Image side */}
            <div style={{ background: "#09090C", minHeight: 380, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {selected.images && selected.images.length > 0 ? (
                <img src={selected.images[0]} alt={selected.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <span style={{ fontSize: 64, opacity: 0.3 }}>{CATEGORY_ICONS[selected.category] ?? "📦"}</span>
              )}
              {selected.autograph && (
                <div style={{ position: "absolute", bottom: 16, left: 16, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", borderRadius: 6, padding: "6px 12px", fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(242,184,75,0.9)", border: "1px solid rgba(242,184,75,0.2)" }}>
                  ✍️ Signed by {displayName}
                </div>
              )}
            </div>

            {/* Info side */}
            <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column" }}>
              <button onClick={() => setSelected(null)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 22, lineHeight: 1, marginBottom: 16 }}>×</button>

              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(242,184,75,0.6)", margin: "0 0 10px" }}>
                {CATEGORY_ICONS[selected.category]} {selected.category} · {CONDITION_LABELS[selected.condition]}
              </p>

              <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 300, color: "#fff", margin: "0 0 16px", lineHeight: 1.2 }}>
                {selected.title}
              </h2>

              {selected.description && (
                <p style={{ fontSize: 14, color: "var(--text-soft)", lineHeight: 1.7, margin: "0 0 20px" }}>
                  {selected.description}
                </p>
              )}

              {selected.personal_note && (
                <div style={{ padding: "14px 16px", background: "rgba(242,184,75,0.06)", borderLeft: "2px solid rgba(242,184,75,0.4)", borderRadius: "0 6px 6px 0", marginBottom: 20 }}>
                  <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(242,184,75,0.5)", margin: "0 0 6px" }}>Personal note from {displayName}</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontStyle: "italic", margin: 0, lineHeight: 1.6 }}>"{selected.personal_note}"</p>
                </div>
              )}

              <div style={{ marginTop: "auto" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
                  <span style={{ fontFamily: serif, fontSize: 36, fontWeight: 300, color: "rgba(242,184,75,0.95)" }}>${selected.price_usd}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>
                    {selected.quantity === 1 ? "1 of 1" : `${selected.quantity} available`}
                  </span>
                </div>

                {selected.subscriber_only && !isSubscribed ? (
                  <p style={{ fontSize: 13, color: "rgba(248,113,113,0.7)", fontFamily: mono, letterSpacing: "0.08em" }}>
                    🔒 Subscribe to purchase
                  </p>
                ) : selected.quantity < 1 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)", fontFamily: mono, letterSpacing: "0.08em" }}>
                    Sold
                  </p>
                ) : (
                  <>
                  <InlineError message={error} />
                  <button onClick={() => purchase(selected.id)} disabled={processing} style={{
                    width: "100%", padding: "14px 0",
                    background: "rgba(242,184,75,0.9)", border: "none", borderRadius: 6,
                    color: "#09090C", fontFamily: mono, fontSize: 11,
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    cursor: "pointer", fontWeight: 700,
                    opacity: processing ? 0.5 : 1,
                    transition: "opacity 0.15s",
                  }}>
                    {processing ? "Opening checkout…" : `Purchase · $${selected.price_usd}`}
                  </button>
                  </>
                )}

                <p style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 10, letterSpacing: "0.06em" }}>
                  Shipped by {displayName} · Spotlightly collects 5%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section header */}
      <div style={{ padding: "48px 40px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 24 }}>
          <p style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: "#fff", margin: 0 }}>
            From the collection of <em style={{ color: "rgba(242,184,75,0.85)", fontStyle: "italic" }}>{displayName}</em>
          </p>
          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", margin: 0 }}>
            {visible.length} item{visible.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Editorial list — not a grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {visible.map((l, i) => (
            <div
              key={l.id}
              onClick={() => setSelected(l)}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr auto",
                gap: 20,
                padding: "20px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
                alignItems: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {/* Thumbnail */}
              <div style={{ width: 80, height: 80, borderRadius: 6, overflow: "hidden", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {l.images && l.images.length > 0 ? (
                  <img src={l.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 28, opacity: 0.4 }}>{CATEGORY_ICONS[l.category] ?? "📦"}</span>
                )}
              </div>

              {/* Info */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: l.quantity < 1 ? "rgba(255,255,255,0.35)" : "#F2F2F0", margin: 0 }}>
                    {l.title}
                  </p>
                  {l.autograph && <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(242,184,75,0.7)", background: "rgba(242,184,75,0.08)", padding: "2px 6px", borderRadius: 3 }}>✍️ Signed</span>}
                  {l.subscriber_only && <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 3 }}>🔒</span>}
                  {l.quantity < 1 && <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(248,113,113,0.5)", padding: "2px 0" }}>Sold</span>}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em" }}>{CONDITION_LABELS[l.condition]}</span>
                  {l.description && <span style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>{l.description}</span>}
                </div>
              </div>

              {/* Price */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontFamily: serif, fontSize: 22, fontWeight: 300, color: l.quantity < 1 ? "rgba(255,255,255,0.2)" : "rgba(242,184,75,0.9)", margin: "0 0 2px" }}>
                  ${l.price_usd}
                </p>
                <p style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em", margin: 0 }}>
                  {l.quantity === 1 ? "1 of 1" : l.quantity > 1 ? `${l.quantity} left` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
