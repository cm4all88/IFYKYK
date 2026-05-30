"use client";
import { useState } from "react";
import Link from "next/link";

const QUICK_STEPS = [
  { num: "01", label: "Connect Stripe", desc: "Dashboard → Payments → Connect Stripe", href: "/dashboard?pane=payments" },
  { num: "02", label: "Set your price", desc: "Dashboard → Channels → Add a tier", href: "/dashboard?pane=channels" },
  { num: "03", label: "Write your bio", desc: "Dashboard → Profile → Edit", href: "/dashboard?pane=profile" },
  { num: "04", label: "First post", desc: "Dashboard → Posts → New Post", href: "/dashboard?pane=posts" },
  { num: "05", label: "Share your page", desc: "spotlightly.app/c/your-handle", href: "/dashboard?pane=overview" },
];

const SECTIONS = [
  {
    emoji: "💳",
    title: "Getting paid — Stripe Connect",
    steps: [
      "Go to Dashboard → Payments → Connect Stripe",
      "You'll be redirected to Stripe's onboarding — takes about 3 minutes",
      "Stripe will ask for your legal name, address, SSN (last 4 digits), and bank account",
      "When you're done, you come back to Spotlightly and your payment buttons go live immediately",
    ],
    note: "You do NOT need your own Stripe account. Spotlightly creates a sub-account for you. Payouts go to your bank on your own schedule.",
  },
  {
    emoji: "💰",
    title: "Setting your subscription price",
    steps: [
      "Go to Dashboard → Channels → Add Channel",
      "Give it a name (e.g. 'General', 'VIP', 'Behind the Scenes')",
      "Set a monthly price — most creators charge $5–$25/mo",
      "Add a description telling fans what they get",
      "Save — it appears on your public page immediately",
    ],
    note: "Spotlightly takes 0% of your subscription revenue. Stripe takes 2.9% + 30¢ per transaction. A $9.99 subscription = ~$9.40 in your bank.",
  },
  {
    emoji: "📝",
    title: "Posting content",
    steps: [
      "Dashboard → Posts → New Post",
      "Write your caption and upload your image or video",
      "Choose Free (everyone sees it) or Premium (subscribers only)",
      "Assign it to a channel if you have multiple tiers",
      "Hit Publish — it's live instantly",
    ],
    note: "Free posts build your audience. Premium posts are blurred with a subscribe prompt for non-subscribers. Mix both — free content gets you discovered, paid content earns.",
  },
  {
    emoji: "🎥",
    title: "Going live",
    steps: [
      "Dashboard → Go Live → enter a title → Start Stream",
      "You'll get an RTMP URL and stream key",
      "Open OBS Studio (free at obsproject.com)",
      "In OBS: Settings → Stream → Custom → paste your RTMP URL and stream key",
      "Click Apply → Start Streaming",
    ],
    note: "You can also stream directly from your browser without OBS — just click 'Stream from browser' instead of copying the RTMP details.",
  },
  {
    emoji: "🛍️",
    title: "Selling items in your marketplace",
    steps: [
      "Dashboard → Marketplace → List an item",
      "Upload photos (up to 8) and an optional short video",
      "Set your price, condition, and a personal note",
      "Mark as Subscribers Only if you want to limit access",
      "It shows up on your public page immediately",
    ],
    note: "Spotlightly takes 5% of marketplace sales. You keep 95%. Great for signed merch, worn clothing, prints, gear — anything physical and personal.",
  },
  {
    emoji: "📦",
    title: "Digital products",
    steps: [
      "Dashboard → Digital Store → Add Product",
      "Upload your file (PDF, ZIP, presets, courses — anything)",
      "Set a price and description",
      "Fans buy it once and get a secure download link",
    ],
    note: "Spotlightly takes 0% of digital product sales. Stripe takes their 2.9% + 30¢. Everything else is yours.",
  },
  {
    emoji: "✦",
    title: "Tips and Super Tips",
    steps: [
      "Tips are enabled by default — fans see a tip button on your page",
      "Standard tips: Spotlightly takes 0%. You keep 100% minus Stripe's fee",
      "Super Tips: fans pay extra for a gold badge and 30-day 'Top Supporter' status",
      "Super Tips: Spotlightly takes 15%. You keep 85%",
    ],
    note: "You never have to do anything to enable tips — they just work once Stripe is connected.",
  },
  {
    emoji: "💬",
    title: "Messages — Front Row",
    steps: [
      "Fans message you through a button on your public page",
      "Standard messages go to Dashboard → Messages",
      "Front Row Messages are paid priority messages fans can send",
      "You receive 50% of the Front Row fee",
      "Replying is always your choice — there's no obligation",
    ],
    note: "Front Row messages are capped at 3 per fan per creator per 24 hours.",
  },
  {
    emoji: "🔗",
    title: "Referring other creators",
    steps: [
      "Dashboard → Refer & Earn",
      "Copy your referral link",
      "Share it with other creators",
      "For every 5 creators who sign up through your link, you get a $29 credit",
    ],
    note: "Credits apply to your monthly platform fee. Refer 5 creators → one month free.",
  },
  {
    emoji: "💵",
    title: "What Spotlightly costs you",
    steps: [
      "Starter: $29/mo — up to 100 subscribers",
      "Growth: $79/mo — up to 500 subscribers",
      "Pro: $249/mo — up to 2,500 subscribers",
      "Scale: $749/mo — up to 10,000 subscribers",
      "Legend: $3,499/mo — unlimited",
    ],
    note: "You get a 30-day free trial. No card required upfront. Spotlightly takes 0% of your subscription revenue and 0% of tips. OnlyFans takes 20% of everything — at 1,000 subscribers that's $2,000/month they keep.",
  },
  {
    emoji: "🎭",
    title: "Opening a Backstage (adult content)",
    steps: [
      "Dashboard → Open a Backstage",
      "Complete age verification (Veriff — about 5 minutes, need government ID)",
      "Your Backstage is a completely separate public profile",
      "Choose to link it to your Spotlight or keep it invisible — your call",
      "Apply for a CCBill merchant account at ccbill.com for Backstage payments",
    ],
    note: "Your employer, family, and mainstream followers will never see the connection to your Backstage unless you choose to show it.",
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.steps.some(st => st.toLowerCase().includes(search.toLowerCase())) ||
        s.note?.toLowerCase().includes(search.toLowerCase())
      )
    : SECTIONS;

  const mono = "DM Mono, monospace";
  const serif = "Cormorant Garamond, Georgia, serif";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontFamily: serif, fontSize: 22, color: "var(--text)", textDecoration: "none" }}>Spot<span style={{ color: "var(--accent)" }}>light</span>ly</Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>/ Help</span>
        </div>
        <Link href="/dashboard" style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>← Dashboard</Link>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 28px 80px" }}>

        <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Creator Help</p>
        <h1 style={{ fontFamily: serif, fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-.02em", marginBottom: 8 }}>
          How to <em style={{ fontStyle: "italic", color: "var(--accent)" }}>get live.</em>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-soft, #71717a)", lineHeight: 1.75, marginBottom: 40, maxWidth: 560 }}>
          Plain language. No fluff. Everything you need to go from signup to earning.
        </p>

        {/* Quick start */}
        <div style={{ background: "var(--surface)", border: "1px solid rgba(245,200,66,.2)", borderLeft: "3px solid var(--accent)", borderRadius: 4, padding: "28px 32px", marginBottom: 32 }}>
          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 20 }}>Quick start — 5 steps to live</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {QUICK_STEPS.map((s) => (
              <Link key={s.num} href={s.href} style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "12px 16px", textDecoration: "none",
                background: "rgba(255,255,255,0.02)", borderRadius: 4,
                transition: "background 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              >
                <span style={{ fontFamily: mono, fontSize: 11, color: "var(--accent)", width: 24, flexShrink: 0 }}>{s.num}</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#fff", margin: 0 }}>{s.label}</p>
                  <p style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", margin: "2px 0 0", letterSpacing: ".05em" }}>{s.desc}</p>
                </div>
                <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 14, opacity: 0.5 }}>→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Search help topics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 4, padding: "12px 16px 12px 40px",
              color: "var(--text)", fontFamily: "inherit", fontSize: 14, outline: "none",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
          />
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 16 }}>⌕</span>
        </div>

        {/* Accordion sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No results for "{search}"</p>
          )}
          {filtered.map((s, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 14,
                    padding: "20px 28px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{s.emoji}</span>
                  <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 400, color: "#fff", flex: 1 }}>{s.title}</span>
                  <span style={{ color: "var(--muted)", fontSize: 18, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
                </button>

                {isOpen && (
                  <div style={{ padding: "0 28px 28px 28px", borderTop: "1px solid var(--border)" }}>
                    <ol style={{ margin: "20px 0 0", paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                      {s.steps.map((step, si) => (
                        <li key={si} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <span style={{ fontFamily: mono, fontSize: 10, color: "var(--accent)", flexShrink: 0, marginTop: 2, width: 20 }}>{String(si + 1).padStart(2, "0")}</span>
                          <span style={{ fontSize: 14, color: "var(--text-soft, #a1a1aa)", lineHeight: 1.7 }}>{step}</span>
                        </li>
                      ))}
                    </ol>
                    {s.note && (
                      <div style={{ marginTop: 20, padding: "14px 18px", background: "rgba(245,200,66,0.05)", borderLeft: "2px solid rgba(245,200,66,0.3)", borderRadius: 2 }}>
                        <p style={{ fontSize: 13, color: "var(--text-soft, #a1a1aa)", lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>{s.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid rgba(245,200,66,.2)", padding: "24px 32px", marginTop: 2, textAlign: "center", borderRadius: 4 }}>
          <p style={{ fontSize: 14, color: "var(--text-soft, #71717a)", marginBottom: 12 }}>Still stuck? We actually respond.</p>
          <a href="mailto:support@spotlightly.app" style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--accent)", textDecoration: "none" }}>support@spotlightly.app</a>
        </div>

      </div>
    </div>
  );
}
