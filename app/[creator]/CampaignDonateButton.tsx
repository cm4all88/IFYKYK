"use client";
import { useState } from "react";

export default function CampaignDonateButton({ campaignId, campaignTitle }: { campaignId: string; campaignTitle: string }) {
  const [amount, setAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function donate() {
    const val = parseFloat(amount);
    if (!val || val < 1) return;
    setLoading(true);
    const res = await fetch("/api/campaigns/donate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, amountUsd: val, message }),
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return; }
    if (data.error) { alert(data.error); }
    setLoading(false);
  }

  const AMOUNTS = ["5", "10", "25", "50", "100"];

  if (!open) return (
    <button onClick={() => setOpen(true)} className="btn btn--primary"
      style={{ borderRadius: "var(--r-pill)", padding: "12px 28px" }}>
      Support this campaign →
    </button>
  );

  return (
    <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-6)" }}>
      <p style={{ fontFamily:"var(--font-display)", fontSize:14, fontWeight:700, color:"#fff", marginBottom:"var(--s-4)" }}>
        Support: {campaignTitle}
      </p>

      <div style={{ display:"flex", gap:"var(--s-2)", flexWrap:"wrap", marginBottom:"var(--s-4)" }}>
        {AMOUNTS.map(a => (
          <button key={a} onClick={() => setAmount(a)}
            style={{ fontFamily:"var(--font-display)", fontSize:13, fontWeight:700, padding:"8px 16px",
              border:"1px solid", borderRadius:"var(--r-pill)", cursor:"pointer", transition:"all var(--t-fast)",
              background: amount === a ? "var(--accent)" : "var(--surface)",
              color: amount === a ? "#0A0A0D" : "var(--text-soft)",
              borderColor: amount === a ? "var(--accent)" : "var(--border)",
            }}>
            ${a}
          </button>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ color:"var(--muted)" }}>$</span>
          <input type="number" min="1" placeholder="Other"
            style={{ width:80, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"8px 10px", color:"var(--text)", fontSize:13, outline:"none" }}
            onChange={e => setAmount(e.target.value)} />
        </div>
      </div>

      <input placeholder="Leave a message (optional)"
        style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 14px", color:"var(--text)", fontSize:13, outline:"none", marginBottom:"var(--s-4)" }}
        value={message} onChange={e => setMessage(e.target.value)} />

      <div style={{ display:"flex", gap:"var(--s-3)" }}>
        <button onClick={donate} disabled={loading || !amount || Number(amount) < 1}
          className="btn btn--primary" style={{ borderRadius:"var(--r-pill)" }}>
          {loading ? "Redirecting…" : `Donate $${amount || "–"}`}
        </button>
        <button onClick={() => setOpen(false)} className="btn btn--ghost">Cancel</button>
      </div>
      <p style={{ fontSize:11, color:"var(--muted)", marginTop:"var(--s-3)" }}>
        You&apos;ll get exclusive access to content the creator posts for campaign supporters.
      </p>
    </div>
  );
}
