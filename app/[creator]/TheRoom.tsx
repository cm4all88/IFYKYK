import React from "react";

type Supporter = { name: string; amount: number };

// "People are here." Shown before the price, between the stage and the set.
// Built entirely from signals the page already has: top super-tippers,
// subscriber count, medals, likes.
export default function TheRoom({
  subscriberCount = 0,
  totalLikes = 0,
  medalCount = 0,
  isFounder = false,
  topSupporters = [],
}: {
  subscriberCount?: number;
  totalLikes?: number;
  medalCount?: number;
  isFounder?: boolean;
  topSupporters?: Supporter[];
  handle?: string;
}) {
  const mono = "var(--font-mono, 'DM Mono', monospace)";
  const serif = "var(--font-serif, 'Cormorant Garamond', Georgia, serif)";
  const hasSignals =
    subscriberCount > 0 || totalLikes > 0 || medalCount > 0 || topSupporters.length > 0;

  const kicker: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 9,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "var(--muted)",
    display: "block",
    textAlign: "center",
    marginBottom: 14,
  };
  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    fontFamily: mono,
    fontSize: 11,
    color: "var(--text-soft)",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "28px 24px" }}>
      <span style={kicker}>The room</span>

      {hasSignals ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {isFounder && (
              <span
                style={{
                  ...pill,
                  background: "rgba(168,85,247,0.10)",
                  borderColor: "rgba(168,85,247,0.35)",
                  color: "#d7b8ff",
                }}
              >
                ★ Founding Creator
              </span>
            )}
            {subscriberCount > 0 && (
              <span style={pill}>{subscriberCount.toLocaleString()} in the audience</span>
            )}
            {totalLikes > 0 && (
              <span style={pill}>
                <span style={{ color: "var(--accent)" }}>♥</span> {totalLikes.toLocaleString()} likes
              </span>
            )}
            {medalCount > 0 && (
              <span style={pill}>
                🏅 {medalCount.toLocaleString()} {medalCount === 1 ? "medal" : "medals"}
              </span>
            )}
          </div>

          {topSupporters.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                Loudest fans
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                {topSupporters.slice(0, 5).map((s, i) => (
                  <span
                    key={i}
                    style={{ ...pill, borderColor: "var(--accent-border)", color: "var(--text)" }}
                  >
                    <span style={{ color: "var(--accent)" }}>★</span> {s.name || "A fan"}
                    {s.amount ? (
                      <span style={{ color: "var(--muted)" }}> ${Math.round(s.amount)}</span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          )}

          {medalCount > 0 && (
            <a
              href="/wall"
              style={{
                fontFamily: mono,
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              See the wall →
            </a>
          )}
        </div>
      ) : (
        <p
          style={{
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 17,
            fontStyle: "italic",
            fontFamily: serif,
            margin: 0,
          }}
        >
          The room is just opening. Be the first one in.
        </p>
      )}
    </div>
  );
}
