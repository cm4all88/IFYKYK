"use client";
import { useState } from "react";
import { REWARD_TYPES, type TierReward, type RewardType } from "@/lib/campaign-rewards";

const NEEDS_CODE: Record<RewardType, boolean> = REWARD_TYPES.reduce((acc, r) => {
  acc[r.type] = r.needsCode;
  return acc;
}, {} as Record<RewardType, boolean>);

interface Tier {
  id: string;
  title: string;
  amount: number | string;
  description: string | null;
  rewards: TierReward[] | null;
  backer_limit: number | null;
}

export default function CampaignTiers({
  campaignId,
  campaignTitle,
  tiers,
}: {
  campaignId: string;
  campaignTitle: string;
  tiers: Tier[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function back(tier: Tier) {
    setLoadingId(tier.id);
    try {
      const res = await fetch("/api/campaigns/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, tierId: tier.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.error) alert(data.error);
    } catch {
      alert("Something went wrong. Please try again.");
    }
    setLoadingId(null);
  }

  if (!tiers?.length) return null;

  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        Back a tier
      </span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {tiers.map((t) => {
          const rewards = Array.isArray(t.rewards) ? t.rewards : [];
          return (
            <div
              key={t.id}
              className="ring-gold"
              style={{
                background: "var(--surface-2, #16161c)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-3, 10px)",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                  {t.title}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "var(--accent)" }}>
                  ${Number(t.amount).toLocaleString()}
                </span>
              </div>

              {t.description && (
                <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>
                  {t.description}
                </p>
              )}

              {rewards.length > 0 && (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  {rewards.map((r, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        display: "flex",
                        gap: 7,
                        alignItems: "baseline",
                      }}
                    >
                      <span style={{ color: "var(--accent)", flexShrink: 0 }}>✓</span>
                      <span>
                        {r.label}
                        {NEEDS_CODE[r.type] && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontFamily: "var(--font-mono)",
                              fontSize: 8.5,
                              letterSpacing: ".1em",
                              textTransform: "uppercase",
                              color: "var(--muted)",
                              border: "1px solid var(--border)",
                              borderRadius: 3,
                              padding: "1px 5px",
                            }}
                          >
                            code at redemption
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {t.backer_limit != null && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
                  Limited · {t.backer_limit} available
                </span>
              )}

              <button
                onClick={() => back(t)}
                disabled={loadingId === t.id}
                className="btn btn--primary"
                style={{ borderRadius: "var(--r-pill, 99px)", marginTop: "auto", fontSize: 13 }}
              >
                {loadingId === t.id ? "Redirecting…" : `Back $${Number(t.amount).toLocaleString()}`}
              </button>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
        Or use “Support this campaign” above to give any amount.
      </p>
    </div>
  );
}
