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
  };
  creatorProfileId: string;
}

export default function DigitalProductCard({ product, creatorProfileId, bundleSavings }: Props & { bundleSavings?: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/digital/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { setError(data.error ?? "Could not start checkout"); setLoading(false); }
  }

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-3)", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* Thumbnail or category icon */}
      <div style={{ height: 120, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {product.thumbnail_url
          ? <img src={product.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 44 }}>{CATEGORY_EMOJI[product.category] ?? "💾"}</span>
        }
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

        <InlineError message={error} />
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
          {loading ? "…" : `Buy · $${Number(product.price).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
