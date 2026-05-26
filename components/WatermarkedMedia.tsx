"use client";

interface Props {
  url: string;
  mediaType: "image" | "video";
  watermarkText: string;
  onClick?: () => void;
}

export default function WatermarkedMedia({ url, mediaType, watermarkText, onClick }: Props) {
  return (
    <div style={{ position: "relative", display: "inline-block", width: "100%" }} onClick={onClick}>
      {mediaType === "image" ? (
        <img src={url} alt="" style={{ width: "100%", display: "block", borderRadius: "var(--r-2)" }} />
      ) : (
        url.includes("iframe.mediadelivery.net") ? (
          <div style={{ position: "relative", paddingTop: "56.25%" }}>
            <iframe src={`${url}&responsive=true`}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", borderRadius: "var(--r-2)" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen />
          </div>
        ) : (
          <video src={url} controls style={{ width: "100%", borderRadius: "var(--r-2)" }} />
        )
      )}

      {/* Watermark overlay — repeated diagonal pattern */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center",
        overflow: "hidden", borderRadius: "var(--r-2)",
      }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{
            width: "33.33%", padding: "12% 0",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontFamily: "var(--font-mono, DM Mono, monospace)",
              fontSize: 11,
              color: "rgba(255,255,255,0.15)",
              transform: "rotate(-30deg)",
              whiteSpace: "nowrap",
              userSelect: "none",
              letterSpacing: "0.06em",
            }}>
              {watermarkText}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
