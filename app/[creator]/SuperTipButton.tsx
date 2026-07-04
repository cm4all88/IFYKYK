"use client";
import { useState } from "react";
import { InlineError } from "./InlineError";

interface Props {
  creatorProfileId: string;
  handle: string;
}

const AMOUNTS = [5, 10, 25, 50, 100];

export default function SuperTipButton({ creatorProfileId, handle }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalAmount = custom ? parseFloat(custom) : amount;

  async function send() {
    if (!finalAmount || finalAmount < 1) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/super-tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorProfileId,
        amountUsd: finalAmount,
        message: message.trim() || null,
        fanDisplayName: displayName.trim() || null,
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { setError(data.error ?? "Something went wrong."); setLoading(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn--secondary" style={{ gap: 6 }}>
        <span>⭐</span> Super Tip
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "32px 28px", width: "100%", maxWidth: 420,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, color: "#fff" }}>
            ⭐ Super Tip @{handle}
          </p>
          <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
          You get a gold Top Supporter badge pinned for 30 days.
        </p>

        {/* Amount picker */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {AMOUNTS.map(a => (
            <button key={a} onClick={() => { setAmount(a); setCustom(""); }} style={{
              padding: "8px 16px", borderRadius: "var(--r-pill)", border: "1px solid",
              borderColor: amount === a && !custom ? "var(--accent-spot)" : "var(--border)",
              background: amount === a && !custom ? "rgba(240,180,41,0.1)" : "var(--surface-2)",
              color: amount === a && !custom ? "var(--accent-spot)" : "var(--muted)",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              ${a}
            </button>
          ))}
        </div>
        <input
          type="number" min="1" max="1000" placeholder="Custom amount"
          value={custom} onChange={e => setCustom(e.target.value)}
          style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "9px 14px", color: "var(--text)", fontSize: 14, outline: "none", marginBottom: 12 }}
        />
        <input
          type="text" placeholder="Your name (shown publicly)"
          value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40}
          style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "9px 14px", color: "var(--text)", fontSize: 14, outline: "none", marginBottom: 12 }}
        />
        <textarea
          placeholder="Add a message (optional)"
          value={message} onChange={e => setMessage(e.target.value)} maxLength={200} rows={2}
          style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "9px 14px", color: "var(--text)", fontSize: 14, outline: "none", resize: "none", marginBottom: 16, fontFamily: "inherit" }}
        />

        <InlineError message={error} />
        <button onClick={send} disabled={loading || !finalAmount || finalAmount < 1} className="btn btn--primary" style={{ width: "100%", borderRadius: "var(--r-pill)", padding: "13px 0" }}>
          {loading ? "Loading…" : `Send $${finalAmount || "—"} Super Tip ⭐`}
        </button>
      </div>
    </div>
  );
}
