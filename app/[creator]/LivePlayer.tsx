"use client";

interface Props {
  playbackUrl: string;
  title: string;
}

export default function LivePlayer({ playbackUrl, title }: Props) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: "var(--r-3)",
      overflow: "hidden",
      marginBottom: 2,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px",
        background: "rgba(239,68,68,0.06)",
        borderBottom: "1px solid rgba(239,68,68,0.15)",
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#EF4444",
          boxShadow: "0 0 6px #EF4444",
          animation: "pulse 1.5s infinite",
          display: "inline-block",
        }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "#EF4444" }}>
          Live now
        </span>
        <span style={{ fontSize: 13, color: "var(--text-soft)", marginLeft: 4 }}>{title}</span>
      </div>
      <div style={{ position: "relative", paddingTop: "56.25%" }}>
        <iframe
          src={playbackUrl}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
