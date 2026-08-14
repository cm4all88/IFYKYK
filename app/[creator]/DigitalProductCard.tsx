"use client";
import { useState } from "react";
import { InlineError } from "./InlineError";

const CATEGORY_EMOJI: Record<string, string> = {
  guide: "📚", course: "🎓", preset: "🎨", template: "📋",
  sample_pack: "🎵", artwork: "🖼️", workout: "💪",
  spreadsheet: "📊", bundle: "📦", other: "💾",
};

interface Props {
  product: {
    id: string;
    title: string;
    description?: string;
    price: number;
    category: string;
    thumbnail_url?: string;
    preview_description?: string;
    total_sales?: number;
    sale_price?: number | null;
    sale_starts_at?: string | null;
    sale_ends_at?: string | null;
  };
  creatorProfileId: string;
}

// Mirrors saleIsLive in lib/promotions.ts. The server decides the real price at
// checkout; this only decides what the card shows.
function saleLive(p: Props["product"]): boolean {
  if (p.sale_price === null || p.sale_price === undefined) return false;
  if (Number(p.sale_price) >= Number(p.price)) return false;
  const now = Date.now();
  if (p.sale_starts_at && new Date(p.sale_starts_at).getTime() > now) return false;
  if (p.sale_ends_at && new Date(p.sale_ends_at).getTime() <= now) return false;
  return true;
}

function endsIn(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "ends within the hour";
  if (hours < 24) return `ends in ${hours}h`;
  return `ends in ${Math.floor(hours / 24)}d`;
}

export default function DigitalProductCard({
  product,
  creatorProfileId,
  codesAvailable,
  bundleSavings,
  bundleCovers,
}: Props & { codesAvailable?: boolean; bundleSavings?: number; bundleCovers?: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [applied, setApplied] = useState<{ code: string; label: string; netCents: number; free: boolean } | null>(null);

  // Only asked for when the result is free: there is no Stripe checkout to
  // collect an address on, so the download link needs somewhere to go.
  const [email, setEmail] = useState("");
  const [needEmail, setNeedEmail] = useState(false);
  const [granted, setGranted] = useState<string | null>(null);

  const onSale = saleLive(product);
  const baseCents = Math.round(Number(onSale ? product.sale_price : product.price) * 100);
  const payCents = applied ? applied.netCents : baseCents;
  const saleWindow = onSale ? endsIn(product.sale_ends_at) : null;

  async function applyCode() {
    if (code.trim().length < 3) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, code }),
      });
      const data = await res.json();
      if (data.ok) {
        setApplied({ code: data.code, label: data.label, netCents: data.netCents, free: data.free });
        setError(null);
      } else {
        setApplied(null);
        setError(data.error ?? "That code is not valid for this product.");
      }
    } catch {
      setError("Could not check that code. Try again.");
    } finally {
      setChecking(false);
    }
  }

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/digital/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          code: applied?.code ?? "",
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (data.url) { window.location.href = data.url; return; }
      if (data.free && data.downloadUrl) { setGranted(data.downloadUrl); setLoading(false); return; }
      if (data.needEmail) { setNeedEmail(true); setError(data.error ?? null); setLoading(false); return; }

      setError(data.error ?? "Could not start checkout");
      setLoading(false);
    } catch {
      setError("Could not start checkout");
      setLoading(false);
    }
  }

  const buyLabel = (() => {
    if (loading) return "…";
    if (payCents === 0) return needEmail ? "Send my download" : "Get it free";
    return `Buy · $${(payCents / 100).toFixed(2)}`;
  })();

  return (
    <div style={{
      background: "var(--surface)", border: `1px solid ${onSale ? "var(--accent-border, var(--border))" : "var(--border)"}`,
      borderRadius: "var(--r-3)", overflow: "hidden",
      display: "flex", flexDirection: "column", position: "relative",
    }}>
      {onSale && (
        <div style={{
          position: "absolute", top: 10, left: 10, zIndex: 2,
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
          background: "var(--accent)", color: "#09090C", fontWeight: 700,
          padding: "3px 9px", borderRadius: 99,
        }}>
          On sale
        </div>
      )}

      {/* Cover. A bundle with no cover of its own builds one from what is inside
          it, laid out as a grid. Composed at render rather than generated and
          stored, so it stays correct when a creator changes one of the covers. */}
      <div style={{ height: 120, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : bundleCovers && bundleCovers.length > 0 ? (
          <div style={{
            width: "100%", height: "100%", display: "grid", gap: 1,
            gridTemplateColumns: bundleCovers.length === 1 ? "1fr" : "1fr 1fr",
            gridTemplateRows: bundleCovers.length <= 2 ? "1fr" : "1fr 1fr",
          }}>
            {bundleCovers.slice(0, 4).map((src, i) => (
              <div key={i} style={{ position: "relative", overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
                <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {/* More than four included: mark the last tile with the remainder. */}
                {i === 3 && bundleCovers.length > 4 && (
                  <div style={{
                    position: "absolute", inset: 0, background: "rgba(10,10,15,0.66)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "#fff",
                  }}>
                    +{bundleCovers.length - 3}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 44 }}>{CATEGORY_EMOJI[product.category] ?? "💾"}</span>
        )}
      </div>

      <div style={{ padding: "var(--s-4)", flex: 1, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{product.title}</p>

        {bundleSavings != null && bundleSavings > 0 && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--accent)", margin: "4px 0 0" }}>
            Bundle · save ${bundleSavings.toFixed(0)}
          </p>
        )}

        {product.preview_description && (
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{product.preview_description}</p>
        )}

        {product.total_sales && product.total_sales > 0 ? (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>
            {product.total_sales} sold
          </p>
        ) : null}

        {onSale && !applied && (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            <span style={{ textDecoration: "line-through", opacity: 0.6 }}>${Number(product.price).toFixed(2)}</span>
            {saleWindow ? <span style={{ marginLeft: 8, color: "var(--accent)" }}>{saleWindow}</span> : null}
          </p>
        )}

        {applied && applied.netCents < baseCents && (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            <span style={{ textDecoration: "line-through", opacity: 0.6 }}>${(baseCents / 100).toFixed(2)}</span>
            <span style={{ marginLeft: 8, color: "var(--accent)" }}>
              you save ${((baseCents - applied.netCents) / 100).toFixed(2)}
            </span>
          </p>
        )}

        {applied && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            background: "rgba(240,180,41,0.08)",
            border: "1px solid var(--accent-border, rgba(240,180,41,0.25))",
            borderRadius: "var(--r-2, 8px)", padding: "9px 11px",
          }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "var(--accent)" }}>
                {applied.code}
              </span>
              <span style={{ fontSize: 12, color: "var(--text)", marginLeft: 8 }}>{applied.label}</span>
            </span>
            <button
              type="button"
              onClick={() => { setApplied(null); setCode(""); setError(null); setNeedEmail(false); }}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--muted)", fontSize: 11.5, flexShrink: 0 }}
            >
              Remove
            </button>
          </div>
        )}

        {granted ? (
          <a
            href={granted}
            style={{
              marginTop: "auto", width: "100%", textAlign: "center",
              background: "var(--accent)", color: "#09090C",
              fontWeight: 700, fontSize: 13,
              padding: "10px 0", borderRadius: "var(--r-pill)",
              textDecoration: "none", display: "block",
            }}
          >
            Download now →
          </a>
        ) : (
          <>
            <InlineError message={error} />

            {needEmail && (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)", borderRadius: "var(--r-1)",
                  color: "var(--text)", fontSize: 12.5, padding: "8px 10px",
                }}
              />
            )}

            {!applied && codesAvailable && (
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-2, 8px)",
                padding: "10px 10px 11px",
              }}>
                <label style={{
                  display: "block",
                  fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".14em",
                  textTransform: "uppercase", color: "var(--muted)", marginBottom: 7,
                }}>
                  Promo code
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") void applyCode(); }}
                    placeholder="Enter code"
                    style={{
                      flex: 1, minWidth: 0,
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid var(--border)", borderRadius: "var(--r-1, 6px)",
                      color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12.5,
                      letterSpacing: ".1em", padding: "9px 10px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void applyCode()}
                    disabled={checking || code.trim().length < 3}
                    style={{
                      flexShrink: 0,
                      background: code.trim().length >= 3 ? "rgba(255,255,255,0.10)" : "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--text)", borderRadius: "var(--r-1, 6px)",
                      fontSize: 12, fontWeight: 600, padding: "9px 14px",
                      cursor: code.trim().length >= 3 ? "pointer" : "default",
                      opacity: checking ? 0.6 : 1,
                    }}
                  >
                    {checking ? "…" : "Apply"}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={buy}
              disabled={loading}
              style={{
                marginTop: "auto", width: "100%",
                background: "var(--accent)", color: "#09090C",
                fontWeight: 700, fontSize: 13,
                padding: "10px 0", borderRadius: "var(--r-pill)",
                border: "none", cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {buyLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
