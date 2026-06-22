"use client";
import { useEffect, useState } from "react";

export default function BackerCodeBanner() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("backer_code");
    if (c) setCode(c);
  }, []);

  if (!code) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 200,
        maxWidth: 520,
        width: "calc(100% - 32px)",
        background: "var(--surface, #16161c)",
        border: "1px solid var(--accent-border, rgba(240,180,41,.3))",
        borderRadius: "var(--r-3, 10px)",
        padding: "16px 18px",
        boxShadow: "0 12px 40px rgba(0,0,0,.5)",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--muted)",
            margin: "0 0 6px",
          }}
        >
          Thanks for backing. Save your code.
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 20,
            fontWeight: 500,
            color: "var(--accent, #F0B429)",
            letterSpacing: ".08em",
            margin: 0,
          }}
        >
          {code}
        </p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "6px 0 0" }}>
          Show this to the creator to redeem your perk. It is also saved to your backing.
        </p>
      </div>
      <button
        onClick={() => setCode(null)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          borderRadius: "var(--r-1, 6px)",
          padding: "6px 12px",
          fontSize: 12,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Got it
      </button>
    </div>
  );
}
