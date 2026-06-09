import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getComparison, getAllComparisonSlugs } from "@/lib/comparisons";
import COMPARISONS from "@/lib/comparisons";
import { SITE_URL } from "@/lib/site";

export async function generateStaticParams() {
  return getAllComparisonSlugs().map((competitor) => ({ competitor }));
}

export async function generateMetadata({ params }: { params: { competitor: string } }): Promise<Metadata> {
  const c = getComparison(params.competitor);
  if (!c) return {};
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    alternates: { canonical: `/vs/${c.slug}` },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDesc,
      url: `${SITE_URL}/vs/${c.slug}`,
    },
  };
}

export default function ComparePage({ params }: { params: { competitor: string } }) {
  const c = getComparison(params.competitor);
  if (!c) notFound();

  const serif = "'Playfair Display', Georgia, serif";
  const mono = "'DM Mono', monospace";
  const sans = "'Inter', system-ui, sans-serif";
  const gold = "#B8860B";
  const others = COMPARISONS.filter((o) => o.slug !== c.slug);

  return (
    <main style={{ background: "#fff", color: "#111", fontFamily: sans, fontWeight: 400, lineHeight: 1.7 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;600&family=DM+Mono:wght@500&display=swap');`}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #f0f0f0", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
        <Link href="/" className="brand-logo brand-logo--light" style={{ fontSize: 22 }}>Spot<span>light</span>ly</Link>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link href="/guide" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>Creator Guide</Link>
          <Link href="/signup" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#09090C", background: gold, padding: "8px 18px", borderRadius: 3, textDecoration: "none" }}>Start free →</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ padding: "72px 40px 48px", maxWidth: 860, margin: "0 auto", background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(184,134,11,0.06) 0%, transparent 70%)" }}>
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: gold }}>{c.kicker}</span>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(34px,5.2vw,54px)", fontWeight: 700, color: "#111", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "18px 0 18px" }}>
          {c.headline}
        </h1>
        <p style={{ fontSize: 19, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18, fontStyle: "italic" }}>{c.subhead}</p>
        <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.85, maxWidth: 660, marginBottom: 32 }}>{c.lede}</p>
        <Link href="/signup" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#fff", background: "#111", padding: "14px 28px", borderRadius: 3, textDecoration: "none", display: "inline-block" }}>
          Claim your handle →
        </Link>
      </div>

      {/* Comparison table */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "8px 40px 56px" }}>
        <div style={{ border: "1px solid #ececec", borderRadius: 8, overflow: "hidden" }}>
          {/* header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", background: "#fafafa", borderBottom: "1px solid #ececec" }}>
            <div style={{ padding: "16px 18px", fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>&nbsp;</div>
            <div style={{ padding: "16px 18px", fontFamily: serif, fontWeight: 700, fontSize: 17, color: gold, borderLeft: "1px solid #ececec", background: "rgba(184,134,11,0.05)" }}>Spotlightly</div>
            <div style={{ padding: "16px 18px", fontFamily: serif, fontWeight: 700, fontSize: 17, color: "#111", borderLeft: "1px solid #ececec" }}>{c.name}</div>
          </div>
          {c.rows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", borderBottom: i < c.rows.length - 1 ? "1px solid #f2f2f2" : "none" }}>
              <div style={{ padding: "16px 18px", fontSize: 13, fontWeight: 600, color: "#333" }}>{row.label}</div>
              <div style={{ padding: "16px 18px", fontSize: 13, color: "#111", borderLeft: "1px solid #f2f2f2", background: "rgba(184,134,11,0.04)", lineHeight: 1.5 }}>
                {row.usWins && <span style={{ color: gold, marginRight: 6, fontWeight: 700 }}>✓</span>}{row.us}
              </div>
              <div style={{ padding: "16px 18px", fontSize: 13, color: "var(--muted)", borderLeft: "1px solid #f2f2f2", lineHeight: 1.5 }}>{row.them}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#aaa", marginTop: 12, fontFamily: mono }}>
          {c.name} fees: {c.theirFee}. Figures current as of 2026; check each platform for the latest.
        </p>
      </div>

      {/* Fair / honest section */}
      <div style={{ background: "#fafafa", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 40px" }}>
          <h2 style={{ fontFamily: serif, fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 14 }}>The honest part</h2>
          <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.85, maxWidth: 660 }}>{c.fair}</p>
        </div>
      </div>

      {/* Closing CTA */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 40px", textAlign: "center" }}>
        <h2 style={{ fontFamily: serif, fontSize: "clamp(28px,4vw,40px)", fontWeight: 700, color: "#111", lineHeight: 1.1, marginBottom: 16 }}>
          Keep what you earn.
        </h2>
        <p style={{ fontSize: 16, color: "var(--muted)", marginBottom: 28, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
          Build your page, set your price, and keep your subscription revenue. Your audience is already out there — give them somewhere to go.
        </p>
        <Link href="/signup" style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#fff", background: "#111", padding: "16px 36px", borderRadius: 3, textDecoration: "none", display: "inline-block" }}>
          Claim your handle →
        </Link>
      </div>

      {/* Interlinks to other comparisons */}
      <div style={{ borderTop: "1px solid #f0f0f0", padding: "32px 40px 64px", maxWidth: 860, margin: "0 auto" }}>
        <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>Compare more</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {others.map((o) => (
            <Link key={o.slug} href={`/vs/${o.slug}`} style={{ fontSize: 13, fontWeight: 500, color: "#333", textDecoration: "none", border: "1px solid #e8e8e8", borderRadius: 3, padding: "8px 16px" }}>
              Spotlightly vs {o.name}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
