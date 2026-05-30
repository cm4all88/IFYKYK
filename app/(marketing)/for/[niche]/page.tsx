import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getNiche, getAllNicheSlugs } from "@/lib/niches";

export async function generateStaticParams() {
  return getAllNicheSlugs().map(slug => ({ niche: slug }));
}

export async function generateMetadata({ params }: { params: { niche: string } }): Promise<Metadata> {
  const niche = getNiche(params.niche);
  if (!niche) return {};
  return {
    title: niche.metaTitle,
    description: niche.metaDesc,
    openGraph: {
      title: niche.metaTitle,
      description: niche.metaDesc,
      url: `https://spotlightly.app/for/${niche.slug}`,
    },
  };
}

export default function NichePage({ params }: { params: { niche: string } }) {
  const niche = getNiche(params.niche);
  if (!niche) notFound();

  const serif = "'Playfair Display', Georgia, serif";
  const mono = "'DM Mono', monospace";
  const sans = "'Inter', system-ui, sans-serif";

  return (
    <main style={{ background: "#fff", color: "#111", fontFamily: sans, fontWeight: 400, lineHeight: 1.7 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;600&family=DM+Mono:wght@500&display=swap');
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #f0f0f0", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
        <Link href="/" className="brand-logo brand-logo--light" style={{ fontSize: 22 }}>Spot<span>light</span>ly
        </Link>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link href="/guide" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", textDecoration: "none" }}>Creator Guide</Link>
          <Link href="/signup" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#09090C", background: "#B8860B", padding: "8px 18px", borderRadius: 3, textDecoration: "none" }}>Start free →</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ padding: "72px 40px 56px", maxWidth: 860, margin: "0 auto", background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(184,134,11,0.06) 0%, transparent 70%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 28 }}>{niche.emoji}</span>
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#B8860B" }}>For {niche.pageName}</span>
        </div>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(36px,5.5vw,56px)", fontWeight: 700, color: "#111", lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 20 }}>
          {niche.headline}
        </h1>
        <p style={{ fontSize: 20, color: "#555", lineHeight: 1.7, marginBottom: 12, fontStyle: "italic" }}>{niche.subhead}</p>
        <p style={{ fontSize: 16, color: "#444", lineHeight: 1.85, maxWidth: 640, marginBottom: 36 }}>{niche.lede}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/signup" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#fff", background: "#111", padding: "14px 28px", borderRadius: 3, textDecoration: "none" }}>
            {niche.cta} →
          </Link>
          <Link href="/guide" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#888", background: "#f5f5f5", padding: "14px 28px", borderRadius: 3, textDecoration: "none" }}>
            See how it works
          </Link>
        </div>
      </div>

      {/* Pain point */}
      <div style={{ background: "#FFF8F0", borderTop: "1px solid #f0e4c0", borderBottom: "1px solid #f0e4c0", padding: "40px", margin: "0" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B8860B", marginBottom: 12 }}>The problem with {niche.pain}</p>
          <p style={{ fontSize: 16, color: "#444", lineHeight: 1.8, maxWidth: 680 }}>{niche.painDetail}</p>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: "60px 40px", maxWidth: 860, margin: "0 auto" }}>
        <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#999", marginBottom: 14 }}>What you can do on Spotlightly</p>
        <h2 style={{ fontFamily: serif, fontSize: "clamp(28px,4vw,40px)", fontWeight: 700, color: "#111", marginBottom: 36, lineHeight: 1.1 }}>
          Six ways to earn from the audience you already have.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 2 }}>
          {niche.features.map((f, i) => (
            <div key={i} style={{ background: i < 2 ? "#FFFDF5" : "#fafafa", border: `1px solid ${i < 2 ? "#f0e4a0" : "#eee"}`, padding: "22px 24px" }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 6 }}>{f.title}</p>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Earnings comparison */}
      <div style={{ background: "#FAFAF8", borderTop: "1px solid #eee", borderBottom: "1px solid #eee", padding: "56px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#999", marginBottom: 14 }}>The math</p>
          <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,3.5vw,36px)", fontWeight: 700, color: "#111", marginBottom: 8, lineHeight: 1.15 }}>
            What {niche.earningExample.scenario} actually earns you.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 28 }}>
            <div style={{ background: "#FFF5F5", border: "1px solid #f0c0c0", borderLeft: "4px solid #cc3333", padding: "24px 28px" }}>
              <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#cc3333", marginBottom: 12 }}>{niche.earningExample.them.platform}</p>
              <p style={{ fontFamily: serif, fontSize: 36, fontWeight: 700, color: "#cc3333", lineHeight: 1, marginBottom: 8 }}>{niche.earningExample.them.youGet}</p>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>{niche.earningExample.them.take} in platform cuts and fees</p>
            </div>
            <div style={{ background: "#F5FFF8", border: "1px solid #b0ddc0", borderLeft: "4px solid #1a7a47", padding: "24px 28px" }}>
              <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1a7a47", marginBottom: 12 }}>Spotlightly</p>
              <p style={{ fontFamily: serif, fontSize: 36, fontWeight: 700, color: "#1a7a47", lineHeight: 1, marginBottom: 8 }}>{niche.earningExample.us.youGet}</p>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>{niche.earningExample.us.fee} flat — you keep everything else</p>
            </div>
          </div>
        </div>
      </div>

      {/* How it works — 3 steps */}
      <div style={{ padding: "60px 40px", maxWidth: 860, margin: "0 auto" }}>
        <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#999", marginBottom: 14 }}>Getting started</p>
        <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,3.5vw,36px)", fontWeight: 700, color: "#111", marginBottom: 36, lineHeight: 1.1 }}>Up and earning in under an hour.</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { num: "01", title: "Claim your handle", desc: "Sign up in 2 minutes. Your page is live at spotlightly.app/c/your-handle immediately. 30-day free trial, no card required." },
            { num: "02", title: "Connect Stripe and set your price", desc: "Takes 5 minutes. You set your own subscription price. Spotlightly charges you a flat monthly fee — never a percentage of what you earn." },
            { num: "03", title: "Post, list, and share", desc: "Upload your content, list your products, share your page. Your existing audience on social media becomes your paying subscriber base." },
          ].map(step => (
            <div key={step.num} style={{ display: "grid", gridTemplateColumns: "64px 1fr", background: "#fafafa", border: "1px solid #eee", overflow: "hidden" }}>
              <div style={{ background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
                <span style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: "#B8860B" }}>{step.num}</span>
              </div>
              <div style={{ padding: "22px 28px" }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#111", marginBottom: 6 }}>{step.title}</p>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Other niches */}
      <div style={{ background: "#FAFAF8", borderTop: "1px solid #eee", padding: "48px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#999", marginBottom: 20 }}>Spotlightly is also built for</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {getAllNicheSlugs().filter(s => s !== niche.slug).map(s => {
              const n = getNiche(s)!;
              return (
                <Link key={s} href={`/for/${s}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#fff", border: "1px solid #e8e8e8", borderRadius: 3, textDecoration: "none", color: "#555", fontSize: 13, fontWeight: 500 }}>
                  <span>{n.emoji}</span> {n.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "72px 40px", textAlign: "center", background: "#fff" }}>
        <h2 style={{ fontFamily: serif, fontSize: "clamp(32px,4.5vw,48px)", fontWeight: 700, color: "#111", lineHeight: 1.1, marginBottom: 14 }}>
          Your audience is already out there.<br />
          <em style={{ color: "#B8860B" }}>Give them somewhere real to go.</em>
        </h2>
        <p style={{ fontSize: 16, color: "#888", marginBottom: 32 }}>30-day free trial. No card required. Your handle, your page, your money.</p>
        <Link href="/signup" style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#fff", background: "#111", padding: "18px 40px", borderRadius: 3, textDecoration: "none", display: "inline-block" }}>
          {niche.cta} →
        </Link>
        <p style={{ fontFamily: mono, fontSize: 10, color: "#ccc", marginTop: 20, letterSpacing: "0.1em" }}>
          Questions? <a href="mailto:support@spotlightly.app" style={{ color: "#aaa", textDecoration: "none" }}>support@spotlightly.app</a>
        </p>
      </div>
    </main>
  );
}
