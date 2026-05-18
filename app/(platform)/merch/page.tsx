import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export default async function MerchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await (supabase as any).from("creator_profiles").select("handle").eq("user_id", user.id).eq("kind", "spotlight").single() : { data: null };

  const card = "background:var(--surface);border:1px solid var(--border);border-radius:var(--r-3);padding:28px 32px;margin-bottom:2px;";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", fontWeight: 300 }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 10, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text)", textDecoration: "none" }}>
            Spot<span style={{ color: "var(--accent)" }}>light</span>ly
          </Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>/ Merch</span>
        </div>
        <Link href="/dashboard" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "var(--muted)", textDecoration: "none" }}>← Dashboard</Link>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 28px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 12 }}>Merch Store</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-.02em", marginBottom: 8 }}>
          Your <em style={{ fontStyle: "italic", color: "var(--accent)" }}>merch.</em>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-soft)", lineHeight: 1.75, marginBottom: 40, maxWidth: 560 }}>
          Sell your branded merchandise directly from your Spotlightly page. Fulfilled by Printful — you design it, they print and ship it, you earn the margin. No inventory. No upfront cost.
        </p>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: "2px solid var(--accent)", padding: "28px 32px", marginBottom: 2 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400, color: "#fff", marginBottom: 8 }}>How it works</div>
          <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 2 }}>
            <span style={{ color: "var(--text)", fontWeight: 500 }}>1.</span> Create a free account at <a href="https://printful.com" target="_blank" style={{ color: "var(--accent)" }}>printful.com</a><br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>2.</span> Design your products — t-shirts, hoodies, phone cases, posters, stickers, and more<br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>3.</span> Connect your Printful store to your Spotlightly account (below)<br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>4.</span> Your merch appears automatically on your public Spotlightly page<br />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>5.</span> When a fan buys, Printful handles printing + shipping. You get the margin.
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "28px 32px", marginBottom: 2 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400, color: "#fff", marginBottom: 8 }}>Platform fees on merch</div>
          <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.85 }}>
            Spotlightly takes <strong style={{ color: "var(--text)" }}>10–15%</strong> of the creator margin on each merch sale. Printful takes their production cost first, then you receive your margin minus our cut. You set your own retail price — the higher you price above Printful's base cost, the more you earn per item.
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid rgba(245,200,66,.15)", padding: "28px 32px", marginBottom: 24 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 10 }}>Connect Printful</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#fff", marginBottom: 8 }}>Coming soon</div>
          <p style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.75, marginBottom: 20 }}>
            The Printful integration is in active development. To get early access and have your merch store set up personally, contact us at{" "}
            <a href="mailto:merch@spotlightly.app" style={{ color: "var(--accent)" }}>merch@spotlightly.app</a> — we'll help you get it live manually.
          </p>
          <a href="https://printful.com" target="_blank" className="btn btn--secondary" style={{ display: "inline-block", textDecoration: "none", padding: "12px 20px" }}>
            Set up Printful account →
          </a>
        </div>
      </div>
    </div>
  );
}
