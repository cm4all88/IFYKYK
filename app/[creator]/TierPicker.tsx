"use client";
import { useState } from "react";

// Normalize for comparing a perk against the description (ignore case, trailing punctuation/space)
const norm = (s: string) => (s || "").trim().toLowerCase().replace(/[.!,;:\s]+$/g, "");

interface Tier {
  id: string;
  name: string;
  description?: string;
  perks: string[];
  price_monthly: number;
  price_yearly?: number;
}

interface Props {
  tiers: Tier[];
  creatorProfileId: string;
  stripeReady: boolean;
  loggedIn?: boolean;
}

export default function TierPicker({ tiers, creatorProfileId, stripeReady, loggedIn = true }: Props) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedTier, setSelectedTier] = useState<string>(tiers[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  const hasYearly = tiers.some(t => t.price_yearly);
  const discountPct = (t: Tier) =>
    t.price_yearly ? Math.round((1 - t.price_yearly / (t.price_monthly * 12)) * 100) : 0;

  function subscribe() {
    if (!selectedTier) return;
    if (!loggedIn) {
      window.location.href = `/fan-signup?return=${encodeURIComponent(`/?subscribe=${creatorProfileId}`)}`;
      return;
    }
    if (!stripeReady) return;
    setLoading(true);
    // Submit a real top-level form so the browser follows Stripe's 303 redirect
    // with the URL #fragment intact. fetch() strips the fragment from res.url,
    // which produces a fragment-less Checkout URL that Stripe can't load
    // ("page not found / contact the merchant").
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/subscribe";
    const fields: Record<string, string> = {
      creator_profile_id: creatorProfileId,
      tier_id: selectedTier,
      billing_period: billing,
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Monthly / Yearly toggle */}
      {hasYearly && (
        <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 999, padding: 3, alignSelf: "flex-start" }}>
          {(["monthly", "yearly"] as const).map(period => (
            <button
              key={period}
              onClick={() => setBilling(period)}
              style={{
                padding: "6px 16px", borderRadius: 999, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
                background: billing === period ? "#F0B429" : "transparent",
                color: billing === period ? "#09090C" : "rgba(255,255,255,0.5)",
                transition: "all 0.15s",
              }}
            >
              {period === "monthly" ? "Monthly" : "Yearly"}
              {period === "yearly" && (
                <span style={{ marginLeft: 6, fontSize: 10, background: "rgba(52,211,153,0.15)", color: "#34D399", padding: "1px 6px", borderRadius: 99 }}>
                  Save up to {Math.max(...tiers.filter(t => t.price_yearly).map(discountPct), 0)}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tier cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tiers.map(tier => {
          const price = billing === "yearly" && tier.price_yearly ? tier.price_yearly : tier.price_monthly;
          const period = billing === "yearly" && tier.price_yearly ? "yr" : "mo";
          const selected = selectedTier === tier.id;
          const visiblePerks = (tier.perks ?? []).filter(p => norm(p) !== norm(tier.description ?? ""));

          return (
            <button
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                padding: "14px 16px", borderRadius: 10, border: "1.5px solid", cursor: "pointer",
                background: selected ? "var(--surface, #1E2024)" : "var(--surface-2, #16161c)",
                borderColor: selected ? "rgba(240,180,41,0.4)" : "rgba(255,255,255,0.1)",
                textAlign: "left", transition: "all 0.15s",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${selected ? "#F0B429" : "rgba(255,255,255,0.3)"}`, background: selected ? "#F0B429" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#09090C" }} />}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: selected ? "#F0B429" : "#F2F2F0" }}>{tier.name}</span>
                </div>
                {tier.description && (
                  <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, marginLeft: 24 }}>{tier.description}</p>
                )}
                {visiblePerks.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: 24 }}>
                    {visiblePerks.map((perk, i) => (
                      <span key={i} style={{ display: "flex", gap: 6, fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                        <span style={{ color: "var(--accent)", flexShrink: 0 }}>✓</span>
                        <span>{perk}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                <p style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: selected ? "#F0B429" : "rgba(255,255,255,0.7)", lineHeight: 1 }}>
                  ${Number(price).toFixed(2)}
                </p>
                <p style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>/{period}</p>
                {billing === "yearly" && tier.price_yearly && (
                  <p style={{ fontSize: 10, color: "#34D399", marginTop: 2 }}>{discountPct(tier)}% off</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={subscribe}
        disabled={loading || !selectedTier || (loggedIn && !stripeReady)}
        style={{
          width: "100%", background: "#F0B429", color: "#09090C",
          fontWeight: 700, fontSize: 14, padding: "13px 0",
          borderRadius: 999, border: "none", cursor: "pointer",
          opacity: loading || (loggedIn && !stripeReady) ? 0.5 : 1,
        }}
      >
        {loading ? "Redirecting…" : !loggedIn ? "Sign up to subscribe" : `Subscribe · ${billing}`}
      </button>

      {loggedIn && !stripeReady && (
        <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
          Payments coming soon
        </p>
      )}
    </div>
  );
}
