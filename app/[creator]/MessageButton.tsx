"use client";
import { useState } from "react";

const FRONT_ROW_AMOUNTS = [5, 10, 25, 50];

export default function MessageButton({ creatorProfileId, handle }: { creatorProfileId: string; handle: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isFrontRow, setIsFrontRow] = useState(false);
  const [amount, setAmount] = useState(10);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!content.trim()) return;
    setSending(true);
    const res = await fetch("/api/messages/front-row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorProfileId, content, isFrontRow, amountUsd: isFrontRow ? amount : null }),
    });
    const data = await res.json();

    if (data.error === "Must be signed in") {
      window.location.href = `/fan-signup?return=/${handle}`;
      return;
    }
    if (data.url) { window.location.href = data.url; return; }
    if (data.ok) { setSent(true); setOpen(false); setContent(""); setIsFrontRow(false); }
    setSending(false);
  }

  if (sent) return (
    <div style={{ padding:"10px 18px", background:"rgba(52,211,153,.08)", border:"1px solid rgba(52,211,153,.2)", borderRadius:"var(--r-pill)", fontSize:13, color:"var(--accent-open)", fontFamily:"var(--font-display)", fontWeight:600 }}>
      ✓ Message sent
    </div>
  );

  if (!open) return (
    <button onClick={() => setOpen(true)} className="btn btn--secondary" style={{ borderRadius:"var(--r-pill)", fontSize:13 }}>
      💬 Send a message
    </button>
  );

  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-5)" }}>
      <textarea
        placeholder={`Message @${handle}…`}
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={3}
        style={{ width:"100%", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 14px", color:"var(--text)", fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", marginBottom:"var(--s-3)" }}
      />

      <div style={{ display:"flex", alignItems:"center", gap:"var(--s-3)", marginBottom:"var(--s-4)" }}>
        <button
          onClick={() => setIsFrontRow(!isFrontRow)}
          style={{ display:"flex", alignItems:"center", gap:"var(--s-2)", fontFamily:"var(--font-display)", fontSize:12, fontWeight:600, padding:"7px 14px", border:"1px solid", borderRadius:"var(--r-pill)", cursor:"pointer", transition:"all var(--t-fast)",
            background: isFrontRow ? "rgba(245,200,66,.1)" : "transparent",
            color: isFrontRow ? "var(--accent)" : "var(--muted)",
            borderColor: isFrontRow ? "var(--accent-border)" : "var(--border)",
          }}>
          ⭐ Front Row
        </button>
        {isFrontRow && (
          <span style={{ fontSize:12, color:"var(--muted)" }}>Your message appears at the top of their inbox</span>
        )}
      </div>

      {isFrontRow && (
        <div style={{ display:"flex", gap:"var(--s-2)", marginBottom:"var(--s-4)", flexWrap:"wrap" }}>
          {FRONT_ROW_AMOUNTS.map(a => (
            <button key={a} onClick={() => setAmount(a)}
              style={{ fontFamily:"var(--font-display)", fontSize:13, fontWeight:700, padding:"7px 16px",
                border:"1px solid", borderRadius:"var(--r-pill)", cursor:"pointer",
                background: amount === a ? "var(--accent)" : "var(--surface)",
                color: amount === a ? "#0A0A0D" : "var(--text-soft)",
                borderColor: amount === a ? "var(--accent)" : "var(--border)",
              }}>
              ${a}
            </button>
          ))}
        </div>
      )}

      <div style={{ display:"flex", gap:"var(--s-3)" }}>
        <button onClick={send} disabled={sending || !content.trim()} className="btn btn--primary btn--small" style={{ borderRadius:"var(--r-pill)" }}>
          {sending ? "Sending…" : isFrontRow ? `Send Front Row · $${amount}` : "Send message"}
        </button>
        <button onClick={() => setOpen(false)} className="btn btn--ghost btn--small">Cancel</button>
      </div>

      {isFrontRow && (
        <p style={{ fontSize:11, color:"var(--muted)", marginTop:"var(--s-3)", lineHeight:1.5 }}>
          50% goes to @{handle}. Front Row messages are capped at 3 per creator per day.
        </p>
      )}
    </div>
  );
}
