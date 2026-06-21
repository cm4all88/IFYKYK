import React from "react";

type Campaign = { title: string; pct: number } | null;

// The pulse of the page. One thin line that answers "is anything happening here?"
// before a visitor decides to stay. Reads only data already on the page.
export default function NowStrip({
  isLive,
  liveTitle,
  lastActiveLabel,
  postCount = 0,
  campaign,
}: {
  isLive?: boolean;
  liveTitle?: string | null;
  lastActiveLabel?: string | null;
  postCount?: number;
  campaign?: Campaign;
}) {
  const mono = "var(--font-mono, 'DM Mono', monospace)";
  const seg: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: "0.04em",
    color: "var(--text-soft)",
    whiteSpace: "nowrap",
  };
  const dot = (color: string, pulse = false): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
    animation: pulse ? "nowpulse 1.8s ease-out infinite" : "none",
  });
  const divider = (
    <span style={{ color: "var(--border-strong, rgba(255,255,255,0.2))" }}>·</span>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "center",
        padding: "10px 16px",
        marginBottom: 4,
        border: "1px solid var(--border)",
        background: "var(--surface, rgba(255,255,255,0.03))",
        borderRadius: "var(--r-2, 6px)",
      }}
    >
      <style>{`@keyframes nowpulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.55)}70%{box-shadow:0 0 0 7px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}`}</style>

      {isLive ? (
        <span style={{ ...seg, color: "#EF4444", fontWeight: 600 }}>
          <span style={dot("#EF4444", true)} />
          LIVE NOW
          {liveTitle ? (
            <span style={{ color: "var(--text-soft)", fontWeight: 400 }}>· {liveTitle}</span>
          ) : null}
        </span>
      ) : lastActiveLabel ? (
        <span style={seg}>
          <span style={dot("var(--accent)")} />
          Active · last drop {lastActiveLabel}
        </span>
      ) : (
        <span style={seg}>
          <span style={dot("var(--muted)")} />
          Just getting started
        </span>
      )}

      {postCount > 0 && (
        <>
          {divider}
          <span style={seg}>
            {postCount} post{postCount !== 1 ? "s" : ""}
          </span>
        </>
      )}

      {campaign && (
        <>
          {divider}
          <span style={{ ...seg, color: "var(--accent)" }}>
            ◇ Raising for {campaign.title}
            {campaign.pct > 0 ? ` · ${campaign.pct}%` : ""}
          </span>
        </>
      )}
    </div>
  );
}
