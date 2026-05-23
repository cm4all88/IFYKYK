"use client";
import { useState } from "react";

interface Tier {
  id: string;
  name: string;
  description?: string;
  price_monthly: number;
  price_yearly?: number | null;
  perks?: string[];
  color?: string;
}

interface Props {
  tiers: Tier[];
  creatorHandle: string;
  creatorName: string;
}

export default function TiersSection({ tiers, creatorHandle, creatorName }: Props) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState<string | null>(null);

  const hasYearly = tiers.some(t => t.price_yearly);

  async function subscribe(tier: Tier) {
    if (billing === "yearly" && !tier.price_yearly) return;
    setLoading(tier.id);

    const res = await fetch("/api/subscribe/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tierId: tier.id,
        billingPeriod: billing,
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else {
      alert(data.error ?? "Could not start checkout");
      setLoading(null);
    }
  }

  const savings = (tier: Tier) => {
    if (!tier.price_yearly) return null;
    return Math.round((1 - tier.price_yearly / (tier.price_monthly * 12)) * 100);
  };

  return (
    <div style={{ marginBottom: "var(--s-12)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--s-4)", marginBottom: "var(--s-6)" }}>
        <div>
          <p className="kicker">Subscribe</p>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Choose how you want to support {creatorName}.</p>
        </div>

        {/* Monthly / Yearly toggle */}
        {hasYearly && (
          <div style={{ display: "flex", gap: 2, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", padding: 3 }}>
            {(["monthly", "yearly"] as const).map(period => (
              <button
                key={period}
                onClick={() => setBilling(period)}
                style={{
                  padding: "7px 16px", borderRadius: "var(--r-pill)", border: "none",
                  cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
                  background: billing === period ? "var(--accent)" : "transparent",
                  color: billing === period ? "#09090C" : "var(--muted)",
                  transition: "all 0.15s",
                }}
              >
                {period === "monthly" ? "Monthly" : "Yearly"}
                {period === "yearly" && (
                  <span style={{ marginLeft: 6, fontSize: 10, background: "rgba(0,0,0,0.2)", padding: "1px 6px", borderRadius: 99 }}>
                    Save up to {Math.max(...tiers.filter(t => t.price_yearly).map(t => savings(t) ?? 0))}%
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--s-3)" }}>
        {tiers.map(tier => {
          const price = billing === "yearly" && tier.price_yearly ? tier.price_yearly : tier.price_monthly;
          const period = billing === "yearly" && tier.price_yearly ? "/yr" : "/mo";
          const save = billing === "yearly" ? savings(tier) : null;
          const unavailable = billing === "yearly" && !tier.price_yearly;

          return (
            <div
              key={tier.id}
              style={{
                background: "var(--surface)",
                border: `1px solid ${tier.color ? `${tier.color}40` : "var(--border)"}`,
                borderRadius: "var(--r-3)",
                padding: "var(--s-6)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-3)",
                opacity: unavailable ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {/* Tier header */}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: tier.color ?? "var(--accent)", flexShrink: 0 }} />
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{tier.name}</p>
              </div>

              {/* Price */}
              <div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: tier.color ?? "var(--accent)", letterSpacing: "-.03em" }}>
                  ${Number(price).toFixed(2)}
                </span>
                <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 4 }}>{period}</span>
                {save && (
                  <span style={{ marginLeft: 8, fontSize: 11, background: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)", padding: "2px 8px", borderRadius: 99 }}>
                    Save {save}%
                  </span>
                )}
              </div>

              {/* Description */}
              {tier.description && (
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>{tier.description}</p>
              )}

              {/* Perks */}
              {tier.perks && tier.perks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  {tier.perks.map((perk, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ color: tier.color ?? "var(--accent)", flexShrink: 0, marginTop: 1, fontSize: 13 }}>✓</span>
                      <span style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.5 }}>{perk}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Subscribe button */}
              <button
                onClick={() => subscribe(tier)}
                disabled={!!loading || unavailable}
                style={{
                  marginTop: "var(--s-2)",
                  width: "100%",
                  padding: "11px 0",
                  borderRadius: "var(--r-pill)",
                  border: "none",
                  cursor: unavailable ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 13,
                  background: tier.color ?? "var(--accent)",
                  color: "#09090C",
                  opacity: loading === tier.id ? 0.7 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {loading === tier.id
                  ? "…"
                  : unavailable
                  ? "Monthly only"
                  : `Join ${tier.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
