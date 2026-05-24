"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

const CATEGORIES = [
  { id: "tshirt",     label: "T-Shirts",    emoji: "👕" },
  { id: "hoodie",     label: "Hoodies",     emoji: "🧥" },
  { id: "hat",        label: "Hats",        emoji: "🧢" },
  { id: "mug",        label: "Mugs",        emoji: "☕" },
  { id: "poster",     label: "Posters",     emoji: "🖼️" },
  { id: "tote",       label: "Tote Bags",   emoji: "👜" },
  { id: "phone_case", label: "Phone Cases", emoji: "📱" },
];

export default function MerchPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  const [loudcapConfigured, setLoudcapConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await (supabase as any)
        .from("creator_profiles")
        .select("id, handle, display_name")
        .eq("user_id", user.id)
        .eq("kind", "spotlight")
        .maybeSingle();

      setCreatorProfile(profile);

      if (profile) {
        const { data: prods } = await (supabase as any)
          .from("merch_products")
          .select("*")
          .eq("creator_profile_id", profile.id)
          .order("created_at", { ascending: false });
        setProducts(prods ?? []);
      }

      // Check if Loudcap is configured
      const res = await fetch("/api/merch/status");
      const data = await res.json();
      setLoudcapConfigured(data.configured);

      setLoading(false);
    })();
  }, []);

  const s = {
    page: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", fontWeight: 300 } as const,
    header: { borderBottom: "1px solid var(--border)", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 10, background: "var(--bg)" },
    inner: { maxWidth: 840, margin: "0 auto", padding: "48px 28px" },
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
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 12 }}>Merch · Powered by Loudcap</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-.02em", marginBottom: 12 }}>
          Your <em style={{ fontStyle: "italic", color: "var(--accent)" }}>merch.</em>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-soft)", lineHeight: 1.75, marginBottom: 28, maxWidth: 520 }}>
          Upload your design. Pick your products. Loudcap handles printing, packaging, and shipping to your fans worldwide.
          You keep {((1 - 0.1) * 100).toFixed(0)}% of profit after fulfillment costs.
        </p>

        <a href="/merch/create" style={{ display:"inline-flex", alignItems:"center", gap:10, background:"var(--accent)", color:"#09090C", fontWeight:700, fontSize:14, padding:"13px 24px", borderRadius:999, textDecoration:"none", marginBottom:32 }}>
          🎨 Open Merch Designer →
        </a>

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
        ) : loudcapConfigured === false ? (
          // Loudcap not configured yet
          <div style={{ background: "rgba(240,180,41,0.06)", border: "1px solid rgba(240,180,41,0.2)", borderRadius: 12, padding: "40px 40px" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🤝</div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: "#fff", marginBottom: 12 }}>Loudcap is coming.</h2>
            <p style={{ fontSize: 14, color: "var(--text-soft)", lineHeight: 1.75, maxWidth: 480, marginBottom: 28 }}>
              Spotlightly merch is fulfilled exclusively by <strong style={{ color: "#fff" }}>Loudcap</strong> — a premium merch partner that handles production, quality control, and worldwide shipping on your behalf.
              Merch goes live as soon as the integration is complete.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
              {[
                "No minimum order quantities",
                "Ships worldwide",
                "Quality-checked before dispatch",
                "10% platform fee — you keep the rest",
                "Your branding on every package",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: "#34D399", fontSize: 16, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 14, color: "var(--text-soft)" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ) : products.length === 0 ? (
          // Configured but no products yet
          <div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "48px 40px", textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>👕</div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 300, color: "#fff", marginBottom: 10 }}>No merch yet.</h2>
              <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>Upload your first design and go live in minutes.</p>
              <Link href="/merch/new" style={{ display: "inline-block", background: "var(--accent)", color: "#09090C", fontWeight: 700, fontSize: 13, padding: "12px 28px", borderRadius: 999, textDecoration: "none" }}>
                Create your first product →
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 3 }}>
              {CATEGORIES.map(cat => (
                <div key={cat.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "20px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{cat.emoji}</div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{cat.label}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)" }}>Available</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Has products
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--muted)" }}>
                {products.length} product{products.length !== 1 ? "s" : ""} live
              </p>
              <Link href="/merch/new" style={{ background: "var(--accent)", color: "#09090C", fontWeight: 700, fontSize: 12, padding: "8px 18px", borderRadius: 999, textDecoration: "none", fontFamily: "var(--font-mono)", letterSpacing: ".05em" }}>
                + Add product
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 3 }}>
              {products.map((p: any) => (
                <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ height: 160, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.mockup_urls?.[0]
                      ? <img src={p.mockup_urls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 48 }}>{CATEGORIES.find(c => c.id === p.category)?.emoji ?? "👕"}</span>
                    }
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{p.name}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>${Number(p.retail_price).toFixed(2)}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
                        color: p.status === "active" ? "#34D399" : "var(--muted)",
                        background: p.status === "active" ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${p.status === "active" ? "rgba(52,211,153,0.2)" : "var(--border)"}`,
                        padding: "2px 8px", borderRadius: 99 }}>
                        {p.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                      You earn: <strong style={{ color: "#fff" }}>${Number(p.creator_earns).toFixed(2)}</strong> per sale
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
