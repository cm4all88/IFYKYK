"use client";
import { useEffect, useState } from "react";

export default function SuccessBanner() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("subscribed") === "1") setMsg("🎉 You're subscribed! Enjoy the content.");
    if (p.get("tipped") === "1") setMsg("💛 Tip sent! Thanks for supporting this creator.");
    if (msg) {
      const t = setTimeout(() => setMsg(null), 6000);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      return () => clearTimeout(t);
    }
  }, []);

  if (!msg) return null;

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 100, background: "var(--surface)", border: "1px solid var(--accent-border)",
      borderRadius: "var(--r-pill)", padding: "14px 24px",
      fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "#fff",
      boxShadow: "0 8px 40px rgba(240,180,41,0.25), 0 2px 8px rgba(0,0,0,0.4)",
      backdropFilter: "blur(12px)", whiteSpace: "nowrap",
      animation: "banner-in 0.3s var(--ease)",
    }}>
      {msg}
      <style>{`
        @keyframes banner-in {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
