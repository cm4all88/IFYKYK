import Link from "next/link";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "One Platform Instead of Five — All-in-One Creator Platform",
  description:
    "Stop paying Patreon, OnlyFans, Ko-fi, GoFundMe, and Poshmark five separate cuts. Spotlightly is one platform for subscriptions, tips, crowdfunding, a marketplace, and merch — for the audience you already have.",
  alternates: { canonical: "/all-in-one" },
  openGraph: {
    title: "One platform instead of five — Spotlightly",
    description: "Subscriptions, tips, crowdfunding, a marketplace, and merch — in one place, for the audience you already have.",
    url: `${SITE_URL}/all-in-one`,
  },
};

const serif = "'Playfair Display', Georgia, serif";
const mono = "'DM Mono', monospace";
const sans = "'Inter', system-ui, sans-serif";
const gold = "#B8860B";

const REPLACES: { purpose: string; instead: string; does: string; href?: string }[] = [
  {
    purpose: "Memberships & subscriptions",
    instead: "Instead of Patreon or Fanfix taking 10–20%",
    does: "Build subscription tiers and post exclusive, members-only content — and keep your subscription revenue.",
    href: "/vs/patreon",
  },
  {
    purpose: "Adult content",
    instead: "Instead of OnlyFans, Fansly, or Fanvue taking up to 20%",
    does: "A private Backstage page for adult content, kept separate from your main identity unless you choose to link it.",
    href: "/vs/onlyfans",
  },
  {
    purpose: "Tips",
    instead: "Instead of Ko-fi or Buy Me a Coffee",
    does: "Let your audience tip you directly — and Spotlightly takes nothing from standard tips.",
    href: "/vs/kofi",
  },
  {
    purpose: "Crowdfunding a goal",
    instead: "Instead of GoFundMe",
    does: "Run a campaign to fund a trip, new gear, or a project — and the people backing you are your actual audience, not strangers.",
  },
  {
    purpose: "Selling your stuff",
    instead: "Instead of Poshmark or Depop",
    does: "A built-in marketplace to sell items and digital products straight to your followers.",
  },
  {
    purpose: "Merch",
    instead: "Instead of wiring up a separate print-on-demand store",
    does: "Design and sell merch with printing and shipping handled for you — no inventory, no upfront cost.",
  },
];

export default function AllInOnePage() {
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
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: gold }}>One platform</span>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(34px,5.2vw,54px)", fontWeight: 700, color: "#111", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "18px 0 18px" }}>
          Everything you're juggling, in one place.
        </h1>
        <p style={{ fontSize: 19, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18, fontStyle: "italic" }}>
          Most creators pay five platforms five separate cuts. You shouldn't have to.
        </p>
        <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.85, maxWidth: 660, marginBottom: 32 }}>
          Subscriptions, tips, crowdfunding, a marketplace, merch — all under one login, one payout, and one audience. Spotlightly replaces the stack of single-purpose tools you're stitching together now, so the people supporting you only have one place to go.
        </p>
        <Link href="/signup" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#fff", background: "#111", padding: "14px 28px", borderRadius: 3, textDecoration: "none", display: "inline-block" }}>
          Claim your handle →
        </Link>
      </div>

      {/* Replaces grid */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "8px 40px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 2, border: "1px solid #ececec", borderRadius: 8, overflow: "hidden", background: "#ececec" }}>
          {REPLACES.map((r, i) => (
            <div key={i} style={{ background: "#fff", padding: "26px 24px" }}>
              <h3 style={{ fontFamily: serif, fontSize: 19, fontWeight: 700, color: "#111", marginBottom: 4 }}>{r.purpose}</h3>
              <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: gold, marginBottom: 12 }}>{r.instead}</p>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, marginBottom: r.href ? 12 : 0 }}>{r.does}</p>
              {r.href && (
                <Link href={r.href} style={{ fontSize: 12, fontWeight: 600, color: "#111", textDecoration: "underline" }}>See the comparison →</Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Why one place */}
      <div style={{ background: "#fafafa", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 40px" }}>
          <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, color: "#111", marginBottom: 14 }}>Why one place matters</h2>
          <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.85, maxWidth: 660, marginBottom: 16 }}>
            When your income is scattered across five platforms, so is your audience — and every one of them takes a cut, holds your money on a different schedule, and owns a piece of your relationship with your fans. Your supporters have to follow you to five different places to support you in five different ways.
          </p>
          <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.85, maxWidth: 660 }}>
            On Spotlightly it's one page, one login, one payout, one audience. You keep your subscription revenue, you keep your relationship with your fans, and you keep the whole picture of your business in one view.
          </p>
        </div>
      </div>

      {/* Closing CTA */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 40px", textAlign: "center" }}>
        <h2 style={{ fontFamily: serif, fontSize: "clamp(28px,4vw,40px)", fontWeight: 700, color: "#111", lineHeight: 1.1, marginBottom: 16 }}>
          One home for the whole thing.
        </h2>
        <p style={{ fontSize: 16, color: "var(--muted)", marginBottom: 28, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
          Bring your audience to one place and stop paying for five. Your stage is waiting.
        </p>
        <Link href="/signup" style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#fff", background: "#111", padding: "16px 36px", borderRadius: 3, textDecoration: "none", display: "inline-block" }}>
          Claim your handle →
        </Link>
      </div>
    </main>
  );
}
