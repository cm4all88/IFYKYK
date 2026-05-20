"use client";
import { useState } from "react";

export default function WishlistItemCard({ item }: { item: any }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function gift() {
    setLoading(true);
    const res = await fetch("/api/wishlist/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, buyerMessage: message }),
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return; }
    if (data.error === "Must be signed in to gift") {
      window.location.href = `/fan-signup?return=${window.location.pathname}`;
      return;
    }
    alert(data.error || "Something went wrong");
    setLoading(false);
  }

  const serviceFee = Math.max(3, Math.round(Number(item.price) * 0.12 * 100) / 100);
  const total = Number(item.price) + serviceFee;

  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", overflow:"hidden", transition:"border-color var(--t-fast), transform var(--t-fast)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>

      {item.image_url ? (
        <img src={item.image_url} alt={item.name} style={{ width:"100%", height:140, objectFit:"cover", display:"block" }} />
      ) : (
        <div style={{ width:"100%", height:100, background:"var(--surface-2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>🎁</div>
      )}

      <div style={{ padding:"var(--s-4)" }}>
        <div style={{ fontFamily:"var(--font-display)", fontSize:13, fontWeight:700, color:"#fff", marginBottom:4, lineHeight:1.3 }}>{item.name}</div>
        {item.store_name && <div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".1em", textTransform:"uppercase", color:"var(--muted)", marginBottom:"var(--s-3)" }}>{item.store_name}</div>}
        {item.description && <div style={{ fontSize:11, color:"var(--text-faint)", lineHeight:1.5, marginBottom:"var(--s-3)" }}>{item.description}</div>}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"var(--s-3)" }}>
          <span style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:800, color:"var(--accent-bright)" }}>${Number(item.price).toFixed(2)}</span>
          {item.store_url && <a href={item.store_url} target="_blank" rel="noopener" style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".12em", textTransform:"uppercase", color:"var(--muted)" }}>View →</a>}
        </div>

        {!open ? (
          <button onClick={() => setOpen(true)} className="btn btn--primary btn--small" style={{ width:"100%", borderRadius:"var(--r-pill)", fontSize:12 }}>
            🎁 Gift this
          </button>
        ) : (
          <div>
            <input placeholder="Leave a message (optional)"
              style={{ width:"100%", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-1)", padding:"8px 10px", color:"var(--text)", fontSize:12, outline:"none", marginBottom:"var(--s-2)" }}
              value={message} onChange={e => setMessage(e.target.value)} />
            <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", marginBottom:"var(--s-2)", letterSpacing:".06em" }}>
              Item ${Number(item.price).toFixed(2)} + ${ serviceFee.toFixed(2)} service = ${total.toFixed(2)} total
            </div>
            <div style={{ display:"flex", gap:"var(--s-2)" }}>
              <button onClick={gift} disabled={loading} className="btn btn--primary btn--small" style={{ flex:1, borderRadius:"var(--r-pill)", fontSize:11 }}>
                {loading ? "…" : `Gift $${total.toFixed(2)}`}
              </button>
              <button onClick={() => setOpen(false)} style={{ background:"none", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:"var(--r-1)", padding:"6px 10px", cursor:"pointer", fontSize:11 }}>✕</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
