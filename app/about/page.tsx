import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import Link from "next/link";
export const metadata = { title: "About · Spotlightly", description: "The creator platform built for your whole career." };

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main style={{ minHeight:"100vh" }}>
        <div style={{ maxWidth:760, margin:"0 auto", padding:"var(--s-16) var(--s-6) var(--s-20)" }}>
          <p className="kicker" style={{ marginBottom:"var(--s-4)" }}>About</p>

          <h1 style={{ fontFamily:"var(--font-display)", fontSize:"clamp(40px,6vw,72px)", fontWeight:800, letterSpacing:"-0.04em", color:"#fff", lineHeight:1, marginBottom:"var(--s-6)" }}>
            Every creator deserves<br />a spotlight.
          </h1>

          <div style={{ fontFamily:"var(--font-serif)", fontSize:"clamp(20px,3vw,28px)", fontStyle:"italic", fontWeight:300, color:"var(--text-soft)", lineHeight:1.4, marginBottom:"var(--s-12)", maxWidth:560 }}>
            We built the whole venue.
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-6)", marginBottom:"var(--s-12)" }}>
            <p style={{ fontSize:17, lineHeight:1.8, color:"var(--text-soft)" }}>
              Spotlightly started from a simple observation: the creator economy has a tax problem. Every major platform takes a percentage of everything creators earn — forever. The more you grow, the more they keep. That's backwards.
            </p>
            <p style={{ fontSize:17, lineHeight:1.8, color:"var(--text-soft)" }}>
              We built Spotlightly around a different model. A flat monthly fee based on your subscriber count, and zero percent of your earnings. Your subscriptions, your tips, your revenue — yours. The platform makes money when your fans want to go deeper, not by taxing what you already built.
            </p>
            <p style={{ fontSize:17, lineHeight:1.8, color:"var(--text-soft)" }}>
              The other thing we noticed: creators who want to post adult content often have professional lives they need to protect. Teachers, nurses, corporate employees, people with public personas. They were either forced to choose, or forced into platforms that don't give them real privacy. We built the dual identity architecture specifically for them — one login, one wallet, two completely separate public presences, zero public connection between them unless the creator chooses it.
            </p>
            <p style={{ fontSize:17, lineHeight:1.8, color:"var(--text-soft)" }}>
              Spotlightly is built and operated by <strong style={{ color:"var(--text)" }}>Tahoma Systems LLC</strong>, based in Seattle, Washington.
            </p>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:2, marginBottom:"var(--s-12)" }}>
            {[
              { label:"The platform", val:"Spotlightly" },
              { label:"The company", val:"Tahoma Systems LLC" },
              { label:"Location", val:"Seattle, WA" },
              { label:"Founded", val:"2026" },
              { label:"Creator fee", val:"Flat monthly" },
              { label:"Earnings cut", val:"0%" },
            ].map(item => (
              <div key={item.label} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-5) var(--s-4)" }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>{item.label}</div>
                <div style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, color:"#fff" }}>{item.val}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop:"1px solid var(--border)", paddingTop:"var(--s-8)" }}>
            <p className="kicker" style={{ marginBottom:"var(--s-4)" }}>Contact</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-2)" }}>
              {[
                { label:"General", email:"hello@spotlightly.app" },
                { label:"Support", email:"support@spotlightly.app" },
                { label:"Legal", email:"legal@spotlightly.app" },
                { label:"Privacy", email:"privacy@spotlightly.app" },
                { label:"Merch setup", email:"merch@spotlightly.app" },
              ].map(c => (
                <div key={c.email} style={{ display:"flex", gap:"var(--s-4)", alignItems:"center", fontSize:14 }}>
                  <span style={{ color:"var(--muted)", width:80, flexShrink:0 }}>{c.label}</span>
                  <a href={`mailto:${c.email}`} style={{ color:"var(--accent)", fontFamily:"var(--font-mono)", fontSize:13 }}>{c.email}</a>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop:"var(--s-10)", display:"flex", gap:"var(--s-4)", flexWrap:"wrap" }}>
            <Link href="/dashboard" className="btn btn--primary">Go to your stage →</Link>
            <Link href="/terms" className="btn btn--secondary">Terms of Service</Link>
            <Link href="/privacy" className="btn btn--secondary">Privacy Policy</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
