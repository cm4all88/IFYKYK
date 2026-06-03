"use client";

import { useState } from "react";
import { MEDAL_PACKS, MEDAL_EMOJI } from "@/lib/medals";

export default function MedalButton({
  postId,
  initialCount = 0,
  size = "md",
}: {
  postId: string;
  initialCount?: number;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [balance, setBalance] = useState<number | null>(null);
  const [authed, setAuthed] = useState(true);
  const [view, setView] = useState<"award" | "buy">("award");
  const [busy, setBusy] = useState(false);
  const [justAwarded, setJustAwarded] = useState(false);

  const px = size === "sm" ? 13 : 15;

  async function openPopover() {
    setOpen((o) => !o);
    if (balance === null) {
      try {
        const res = await fetch("/api/medals/balance");
        if (res.status === 401) { setAuthed(false); setBalance(0); return; }
        const data = await res.json();
        setBalance(data.balance ?? 0);
      } catch { setBalance(0); }
    }
  }

  async function award() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/medals/award", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.status === 401) { setAuthed(false); return; }
      const data = await res.json();
      if (data.needsPurchase) { setBalance(data.balance ?? 0); setView("buy"); return; }
      if (data.ok) {
        setBalance(data.balance);
        setCount((c) => c + 1);
        setJustAwarded(true);
        setTimeout(() => { setJustAwarded(false); setOpen(false); }, 1100);
      } else {
        alert(data.error || "Could not award");
      }
    } catch { alert("Something went wrong"); }
    finally { setBusy(false); }
  }

  async function buy(packId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/medals/purchase", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, returnTo: typeof window !== "undefined" ? window.location.pathname : "/feed" }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      alert(data.error || "Could not start checkout");
    } catch { alert("Something went wrong"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPopover(); }}
        aria-label="Award a medal"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: open ? "rgba(242,184,75,0.12)" : "transparent",
          border: "1px solid rgba(242,184,75,0.2)", borderRadius: 4,
          cursor: "pointer", padding: size === "sm" ? "4px 9px" : "5px 11px",
          color: "rgba(242,184,75,0.85)", fontFamily: "var(--font-mono, monospace)",
          fontSize: px - 3, letterSpacing: "0.08em", textTransform: "uppercase",
        }}
      >
        <span style={{ fontSize: px }}>{MEDAL_EMOJI}</span>
        <span>{count > 0 ? count : "Medal"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", right: 0, zIndex: 30,
          background: "#141014", border: "1px solid rgba(242,184,75,0.2)", borderRadius: 8,
          padding: 10, display: "flex", flexDirection: "column", gap: 8, minWidth: 210,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        }}>
          {justAwarded ? (
            <p style={{ fontFamily: "var(--font-display, serif)", fontSize: 18, fontStyle: "italic", color: "#F2B84B", margin: "6px 4px", textAlign: "center" }}>
              {MEDAL_EMOJI} Awarded!
            </p>
          ) : !authed ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text, #f2f2f0)", margin: "2px 4px" }}>Sign in to award medals.</p>
              <a href="/account" style={{ textAlign: "center", background: "rgba(242,184,75,0.9)", color: "#09090C", fontFamily: "var(--font-mono, monospace)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 0", borderRadius: 5, textDecoration: "none" }}>Sign in</a>
            </>
          ) : view === "award" ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 2px" }}>
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Your medals</span>
                <span style={{ fontFamily: "var(--font-display, serif)", fontSize: 20, color: "#F2B84B" }}>{balance ?? "…"}</span>
              </div>
              {(balance ?? 0) >= 1 ? (
                <button onClick={award} disabled={busy} style={{ background: "rgba(242,184,75,0.9)", color: "#09090C", fontFamily: "var(--font-mono, monospace)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "9px 0", borderRadius: 5, border: "none", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
                  {busy ? "…" : `Award 1 medal`}
                </button>
              ) : (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 4px", lineHeight: 1.5 }}>You&rsquo;re out of medals.</p>
              )}
              <button onClick={() => setView("buy")} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "7px 0", borderRadius: 5, cursor: "pointer" }}>
                Get more medals
              </button>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", margin: "2px 4px 0", lineHeight: 1.4 }}>Medals push this creator up the Wall.</p>
            </>
          ) : (
            <>
              <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "2px 4px" }}>Get medals</p>
              {MEDAL_PACKS.map((p) => (
                <button key={p.id} onClick={() => buy(p.id)} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "8px 10px", cursor: busy ? "default" : "pointer", color: "var(--text, #f2f2f0)", opacity: busy ? 0.6 : 1 }}>
                  <span style={{ fontSize: 13 }}>{MEDAL_EMOJI} {p.medals} medals</span>
                  <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: "#F2B84B" }}>${p.price}</span>
                </button>
              ))}
              {(balance ?? 0) >= 1 && (
                <button onClick={() => setView("award")} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 0", cursor: "pointer" }}>← Back</button>
              )}
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", margin: "2px 4px 0", lineHeight: 1.4 }}>No cash value · non-refundable</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
