import Link from "next/link";

export default function MerchPage() {
  const s = {
    page: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", fontWeight: 300 } as const,
    header: { borderBottom: "1px solid var(--border)", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 10, background: "var(--bg)" },
    inner: { maxWidth: 760, margin: "0 auto", padding: "48px 28px" },
    card: { background: "var(--surface)", border: "1px solid var(--border)", padding: "28px 32px", marginBottom: 2 } as const,
    h3: { fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, color: "#fff", marginBottom: 10 } as const,
    body: { fontSize: 13, color: "var(--text-soft)", lineHeight: 1.85 } as const,
  };

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text)", textDecoration: "none" }}>
            Spot<span style={{ color: "var(--accent)" }}>light</span>ly
          </Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>/ Merch</span>
        </div>
        <Link href="/dashboard" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "var(--muted)", textDecoration: "none" }}>← Dashboard</Link>
      </header>

      <div style={s.inner}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 12 }}>Merch Store</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-.02em", marginBottom: 12 }}>
          Your <em style={{ fontStyle: "italic", color: "var(--accent)" }}>merch.</em>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-soft)", lineHeight: 1.75, marginBottom: 40, maxWidth: 560 }}>
          Sell branded merchandise directly from your Spotlightly page. You upload the designs, we handle everything else — printing, shipping, and fulfillment through Printful. No inventory. No upfront cost. No Printful account needed.
        </p>

        <div style={{ ...s.card, borderTop: "2px solid var(--accent)" }}>
          <h3 style={s.h3}>How it works</h3>
          <div style={{ ...s.body, lineHeight: 2 }}>
            <span style={{ color: "var(--text)", fontWeight: 500 }}>1.</span> Upload your designs and pick products (t-shirts, hoodies, phone cases, posters, stickers, and more)<br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>2.</span> Set your retail price — Spotlightly shows you the production cost so you know your margin<br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>3.</span> Your merch appears on your public Spotlightly page automatically<br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>4.</span> A fan buys — Stripe processes the payment through Spotlightly<br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>5.</span> Spotlightly automatically places the fulfillment order with Printful<br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>6.</span> Printful prints and ships directly to the fan — you never touch inventory<br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>7.</span> Your earnings hit your next payout cycle
          </div>
        </div>

        <div style={s.card}>
          <h3 style={s.h3}>How you get paid</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, marginBottom: 16 }}>
            {[
              { label: "Fan pays", val: "Your retail price", note: "You set this" },
              { label: "Printful takes", val: "Production cost", note: "Varies by product" },
              { label: "Remaining margin", val: "Retail − production", note: "Split below" },
            ].map((r, i) => (
              <div key={i} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "14px 16px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 4 }}>{r.label}</div>
                <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500, marginBottom: 2 }}>{r.val}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.note}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "14px 16px", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 4 }}>Margin split</div>
              <div style={{ fontSize: 14, color: "var(--text)" }}>
                <span style={{ color: "var(--accent-open)" }}>You keep 85–90%</span>
                <span style={{ color: "var(--muted)", margin: "0 8px" }}>·</span>
                <span style={{ color: "var(--muted)" }}>Spotlightly keeps 10–15%</span>
              </div>
            </div>
          </div>
          <p style={{ ...s.body, marginTop: 14 }}>
            Example: You sell a t-shirt at $35. Printful's production cost is $14. Margin is $21. You receive $17.85–$18.90 per sale. The higher you price, the more you earn per item.
          </p>
        </div>

        <div style={s.card}>
          <h3 style={s.h3}>No account needed — we handle Printful</h3>
          <p style={s.body}>
            Spotlightly manages the Printful relationship on your behalf. You don't need your own Printful account. You don't deal with production costs, shipping labels, or fulfillment logistics. You design, you price, you promote. We do the rest.
          </p>
        </div>

        <div style={{ ...s.card, borderLeft: "3px solid var(--accent-back)", background: "rgba(192,132,252,.03)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase" as const, color: "var(--accent-back)", marginBottom: 10 }}>Coming soon</div>
          <h3 style={{ ...s.h3, color: "#fff" }}>Merch setup is in development</h3>
          <p style={{ ...s.body, marginBottom: 20 }}>
            The design upload tool is being built. To get your merch store live before the self-serve tool ships, contact us and we'll set it up manually — your designs, your products, your prices.
          </p>
          <a href="mailto:merch@spotlightly.app" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase" as const, color: "var(--accent)", display: "inline-block" }}>
            merch@spotlightly.app →
          </a>
        </div>
      </div>
    </div>
  );
}
