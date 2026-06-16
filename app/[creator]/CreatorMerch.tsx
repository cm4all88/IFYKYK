"use client";

import { useEffect, useState } from "react";

interface MerchItem {
  id: string;
  name: string;
  description: string | null;
  design_url: string | null;
  retail_price: number;
  category: string;
  mockup_urls: string[];
}

const CATEGORY_SIZES: Record<string, string[]> = {
  tshirt: ["S", "M", "L", "XL", "2XL"],
  hoodie: ["S", "M", "L", "XL", "2XL"],
};

function MerchCard({ item, handle }: { item: MerchItem; handle: string }) {
  const sizes = CATEGORY_SIZES[item.category] ?? [];
  const [size, setSize] = useState(sizes[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const img = item.mockup_urls?.[0] || item.design_url || null;

  async function buy() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.id, size }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.href = `/fan-signup?return=/${handle}`; return; }
      if (data.url) { window.location.href = data.url; return; }
      setErr(data.error ?? "Couldn't start checkout");
    } catch {
      setErr("Couldn't start checkout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cp-merch-card">
      {img ? (
        <div className="cp-merch-thumb"><img src={img} alt={item.name} /></div>
      ) : (
        <div className="cp-merch-thumb cp-merch-thumb--empty">🧢</div>
      )}
      <div className="cp-merch-body">
        <p className="cp-merch-name">{item.name}</p>
        <p className="cp-merch-price">${Number(item.retail_price).toFixed(2)}</p>
        {sizes.length > 0 && (
          <div className="cp-merch-sizes">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`cp-merch-size${size === s ? " cp-merch-size--active" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {err && <p className="cp-merch-err">{err}</p>}
        <button onClick={buy} disabled={busy} className="btn btn--secondary btn--small cp-merch-buy">
          {busy ? "…" : "Order"}
        </button>
      </div>
    </div>
  );
}

export default function CreatorMerch({
  creatorProfileId,
  handle,
}: {
  creatorProfileId: string;
  handle: string;
}) {
  const [items, setItems] = useState<MerchItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/merch?profileId=${creatorProfileId}`)
      .then((r) => r.json())
      .then((d) => { if (alive) { setItems(d.products ?? []); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [creatorProfileId]);

  if (!loaded) return null;
  if (items.length === 0) {
    return (
      <div className="cp-rail-section">
        <span className="cp-rail-kicker">Merch</span>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "22px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 26, marginBottom: 6, opacity: 0.5 }}>🧢</div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>Merch coming soon</p>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Branded gear is on the way.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-rail-section">
      <span className="cp-rail-kicker">Merch</span>
      <div className="cp-rail-grid">
        {items.map((item) => (
          <MerchCard key={item.id} item={item} handle={handle} />
        ))}
      </div>

      <style>{`
        .cp-merch-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-3); overflow: hidden;
        }
        .cp-merch-thumb { aspect-ratio: 1; background: #0a0a0f; }
        .cp-merch-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cp-merch-thumb--empty {
          display: flex; align-items: center; justify-content: center; font-size: 40px; opacity: 0.4;
        }
        .cp-merch-body { padding: 14px 16px; }
        .cp-merch-name {
          font-family: var(--font-display); font-size: 14px; font-weight: 600;
          color: var(--text); margin: 0 0 4px;
        }
        .cp-merch-price {
          font-family: var(--font-mono); font-size: 13px; color: var(--accent); margin: 0 0 12px;
        }
        .cp-merch-sizes { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .cp-merch-size {
          min-width: 34px; padding: 5px 0; border-radius: var(--r-2);
          border: 1px solid var(--border); background: transparent; color: var(--muted-faint);
          font-family: var(--font-mono); font-size: 11px; cursor: pointer;
        }
        .cp-merch-size--active { border-color: var(--accent-border); background: var(--accent-soft); color: var(--accent); }
        .cp-merch-err { color: var(--red); font-size: 12px; margin: 0 0 8px; }
        .cp-merch-buy { width: 100%; }
      `}</style>
    </div>
  );
}
