import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Royalty-Free Music for Creators · Spotlightly",
  description: "Never get a copyright strike again. The best licensed music platforms for creators.",
};

const PLATFORMS = [
  {
    name: "Epidemic Sound",
    tagline: "Best all-round — most creators' first choice",
    price: "$15/mo Personal · $49/mo Commercial",
    affiliate: "https://www.epidemicsound.com/referral/",
    badge: "Most popular",
    badgeColor: "#34D399",
    pros: ["500,000+ tracks and sound effects", "Full license — use on YouTube, TikTok, Twitch, podcasts, ads", "One subscription covers all your channels", "Can retroactively license old videos"],
    bestFor: "Full-time creators publishing regularly across multiple platforms",
    commission: "Recurring commission per referral",
  },
  {
    name: "Artlist",
    tagline: "Best for cinematic and documentary-style content",
    price: "$199/yr Personal · $399/yr Commercial",
    affiliate: "https://artlist.io/referral/",
    badge: "Best quality",
    badgeColor: "#F0B429",
    pros: ["Curated library — every track is high quality", "Annual license covers unlimited downloads", "Film-quality music for premium content", "Lifetime license for tracks downloaded while subscribed"],
    bestFor: "Travel, documentary, lifestyle creators who need high-end music",
    commission: "Per referral",
  },
  {
    name: "Musicbed",
    tagline: "Best for brand deals and commercial work",
    price: "$9.99/mo Subscription",
    affiliate: "https://www.musicbed.com/referral/",
    badge: null,
    pros: ["Premium artists — real label-quality music", "Search by mood, genre, tempo, instruments", "Sync licenses for ads and commercial content", "Loved by video production agencies"],
    bestFor: "Creators doing branded content, ads, or professional video work",
    commission: "Per referral",
  },
  {
    name: "Soundstripe",
    tagline: "Best budget option with strong library",
    price: "$135/yr Creator",
    affiliate: "https://www.soundstripe.com",
    badge: "Best value",
    badgeColor: "#C084FC",
    pros: ["Unlimited downloads on all plans", "SFX library included", "YouTube, Facebook, Instagram, Podcast licensed", "Simple pricing, no track limits"],
    bestFor: "Budget-conscious creators who need solid licensed music",
    commission: "Per referral",
  },
  {
    name: "YouTube Audio Library",
    tagline: "100% free — no license needed",
    price: "Free",
    affiliate: "https://studio.youtube.com/channel/UC/music",
    badge: "Free",
    badgeColor: "#34D399",
    pros: ["Completely free — no subscription", "Safe for YouTube content by default", "Thousands of tracks and sound effects", "Some tracks require attribution"],
    bestFor: "New creators or anyone posting only to YouTube",
    commission: null,
  },
];

const FAQ = [
  {
    q: "Can I use Spotify music in my videos?",
    a: "No. Spotify music is streamed for personal listening only. Using it in videos — even in the background — will result in copyright claims, demonetization, or takedowns. You need a sync license from the rights holder, which is what platforms like Epidemic Sound provide.",
  },
  {
    q: "What happens if I get a copyright strike?",
    a: "On YouTube, three strikes in 90 days results in channel termination. Even one strike can disable monetization on affected videos. On TikTok, videos get muted or removed. A $15/month music license is much cheaper than losing your channel.",
  },
  {
    q: "Do I need a license for each platform separately?",
    a: "Depends on the service. Epidemic Sound's Personal plan covers all platforms under your name. Artlist's annual license covers unlimited projects. Always check if your plan covers the specific platforms you publish on — especially if you're doing paid promotions.",
  },
  {
    q: "What about songs I made myself?",
    a: "Original music you composed yourself is always safe. If you used samples, loops, or beats from a pack, check the license of that pack. Many royalty-free beat packs require attribution or have restrictions on commercial use.",
  },
  {
    q: "Can I use licensed music from these services in a Spotlightly live stream?",
    a: "Live streaming licensing is separate from recorded video. Most platforms offer live streaming rights as an add-on or in higher tiers. Check your specific plan — Epidemic Sound Commercial and Artlist Creator Pro both cover live streaming.",
  },
];

export default function MusicPage() {
  return (
    <>
      <SiteHeader />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 120px" }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Music licensing guide</p>
          <h1 style={{ fontFamily: "Georgia,serif", fontSize: "clamp(34px,5vw,54px)", fontWeight: 300, color: "#fff", lineHeight: 1.05, marginBottom: 16 }}>
            Never get a copyright<br /><em style={{ color: "#F0B429" }}>strike again.</em>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", lineHeight: 1.75, maxWidth: 580 }}>
            The biggest legal risk for creators is music. One background song can trigger a strike, demonetize a video, or end a channel. Here&apos;s the complete guide to licensing it right.
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 16, fontFamily: "monospace", letterSpacing: ".06em" }}>
            DISCLOSURE: We may earn a commission on referrals at no extra cost to you.
          </p>
        </div>

        {/* Warning banner */}
        <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "20px 24px", marginBottom: 48, display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#F87171", marginBottom: 4 }}>Spotify, Apple Music, and streaming platforms are not licensed for creator use.</p>
            <p style={{ fontSize: 13, color: "rgba(248,113,113,0.7)", lineHeight: 1.65 }}>
              Using music from streaming services in your videos — even 5 seconds — can result in automatic copyright claims, demonetization, or channel strikes. You need a separate sync license. That&apos;s what the platforms below provide.
            </p>
          </div>
        </div>

        {/* Platform cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 72 }}>
          {PLATFORMS.map((p, i) => (
            <div key={i} style={{ background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "28px 32px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <h2 style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 400, color: "#fff" }}>{p.name}</h2>
                      {p.badge && (
                        <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: p.badgeColor, background: `${p.badgeColor}15`, border: `1px solid ${p.badgeColor}30`, padding: "3px 10px", borderRadius: 3 }}>
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{p.tagline}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontFamily: "monospace", fontSize: 13, color: "#F0B429", fontWeight: 700, marginBottom: 8 }}>{p.price}</p>
                    <a href={p.affiliate} target="_blank" rel="noopener noreferrer nofollow"
                      style={{ display: "inline-block", background: p.name === "YouTube Audio Library" ? "rgba(255,255,255,0.06)" : "#F0B429", color: p.name === "YouTube Audio Library" ? "rgba(255,255,255,0.7)" : "#09090C", fontWeight: 700, fontSize: 12, padding: "9px 20px", borderRadius: 999, textDecoration: "none", border: p.name === "YouTube Audio Library" ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                      {p.name === "YouTube Audio Library" ? "Open free library" : "Try it free →"}
                    </a>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                  {p.pros.map((pro, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ color: "#34D399", flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{pro}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: "14px 32px", background: "rgba(255,255,255,0.01)" }}>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Best for: </span>
                  {p.bestFor}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 64 }}>
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>Common questions</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {FAQ.map((item, i) => (
              <div key={i} style={{ background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "20px 24px" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#F2F2F0", marginBottom: 8 }}>{item.q}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTAs */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", padding: "40px 0", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <Link href="/gear" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none", padding: "10px 20px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999 }}>
            📦 Creator gear guide
          </Link>
          <Link href="/tools" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none", padding: "10px 20px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999 }}>
            ⚡ Software toolkit
          </Link>
          <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#F0B429", color: "#09090C", fontSize: 13, fontWeight: 700, textDecoration: "none", padding: "10px 24px", borderRadius: 999 }}>
            Start earning on Spotlightly →
          </Link>
        </div>

      </main>
      <Footer />
    </>
  );
}
