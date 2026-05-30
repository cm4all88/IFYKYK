import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Guide · Spotlightly",
  description: "Everything you need to set up your Spotlightly presence and start earning. Step by step.",
};

const STEPS = [
  {
    num: "01",
    title: "Create your creator account",
    time: "2 minutes",
    what: "Sign up at spotlightly.app/signup. The onboarding advisor will ask what you create — answer honestly, it uses your answers to pre-fill your profile and suggest the right features for your niche.",
    tips: [
      "Pick a handle that matches your existing social presence — fans will find you faster",
      "You can add a Backstage (adult content) profile later from your dashboard — you don't have to decide now",
      "Your 30-day free trial starts the moment you create your account",
    ],
  },
  {
    num: "02",
    title: "Connect Stripe to get paid",
    time: "3–5 minutes",
    what: "Go to Dashboard → Payments → Connect Stripe. You'll be sent to Stripe's secure form. Have your bank account details ready.",
    tips: [
      "You need: legal name, address, SSN (last 4 digits minimum), and bank account + routing number",
      "Stripe creates a sub-account for you — you don't need a separate Stripe account",
      "Until Stripe is connected, your subscribe and tip buttons are disabled for fans",
      "Payouts happen on a rolling basis — Stripe sends money to your bank on the schedule you set",
    ],
  },
  {
    num: "03",
    title: "Build your profile",
    time: "10 minutes",
    what: "Dashboard → Profile. Add your avatar, cover image, bio, and a display name. This is your stage — make it feel like you.",
    tips: [
      "Your bio should answer: what do you make, who is it for, and what do subscribers get?",
      "Cover image: 1500×500px works best — use something that represents your content style",
      "Your public page URL is spotlightly.app/c/your-handle — put it in every social bio",
    ],
  },
  {
    num: "04",
    title: "Set up your subscription tiers",
    time: "5 minutes",
    what: "Dashboard → Channels → Add Channel. Create at least one free tier and one paid tier.",
    tips: [
      "Free tier: name it 'General' or 'Public' — use it for posts that build your audience",
      "Paid tier: name it what fans get, not what it costs. 'Behind the Scenes' beats 'Premium'",
      "Most creators start at $7.99–$14.99/mo — you can always adjust later",
      "Spotlightly takes 0% of subscription revenue. Stripe takes ~2.9%",
    ],
  },
  {
    num: "05",
    title: "Publish your first posts",
    time: "15 minutes",
    what: "Dashboard → Posts → New Post. Publish at least 3 posts before you start promoting — fans who land on an empty page leave.",
    tips: [
      "Start with 2 free posts so new visitors see real content immediately",
      "Your first paid post should clearly show what subscribers are getting — make it worth it",
      "Images upload directly. Videos go to BunnyCDN — large files take a minute or two",
      "You can schedule posts in advance using the scheduling option",
    ],
  },
  {
    num: "06",
    title: "Share your page",
    time: "Ongoing",
    what: "Your page is live at spotlightly.app/c/your-handle the moment you finish onboarding. Put the link everywhere.",
    tips: [
      "Add your Spotlightly link to every social bio: Instagram, TikTok, Twitter, YouTube",
      "Announce it with a post explaining what fans get — don't just drop a link",
      "Your referral link (Dashboard → Refer & Earn) earns you $29 credit for every 5 creator signups",
      "Each new subscriber gets a notification — reply to their first message, it converts to loyalty",
    ],
  },
  {
    num: "07",
    title: "Go live",
    time: "Setup: 15 minutes",
    what: "Dashboard → Go Live. You can stream from your browser or use OBS for a professional setup.",
    tips: [
      "Browser streaming: click 'Stream from browser', allow camera/mic, go live instantly",
      "OBS setup: get your RTMP URL and stream key from the Go Live page, paste into OBS → Settings → Stream → Custom",
      "Download OBS free at obsproject.com — it takes about 10 minutes to set up",
      "Live streams are automatically saved as VODs your subscribers can watch after",
    ],
  },
  {
    num: "08",
    title: "Sell in the marketplace",
    time: "5 minutes per listing",
    what: "Dashboard → Marketplace → List an item. Upload photos and a short video. Set your price. Fans buy directly from your page.",
    tips: [
      "Personal items sell best — worn clothing, signed prints, gear you've actually used",
      "A short video showing the item converts significantly better than photos alone",
      "Add a personal note — the story behind the item is what makes it worth buying",
      "You keep 95%. Spotlightly takes 5%",
    ],
  },
  {
    num: "09",
    title: "Add digital products",
    time: "5 minutes per product",
    what: "Dashboard → Digital Store. Upload any file — presets, PDFs, guides, courses, sample packs, templates.",
    tips: [
      "Spotlightly takes 0% of digital product sales",
      "Fans get a secure one-time download link after payment",
      "Bundle related files into a ZIP for higher perceived value",
      "Price higher than you think — digital products from creators you follow are worth more than random downloads",
    ],
  },
  {
    num: "10",
    title: "Understand your money",
    time: "Read once",
    what: "Your platform fee is based on your subscriber count, charged monthly. Your earnings from fans flow directly through Stripe to your bank.",
    tips: [
      "Starter $29/mo: up to 100 subscribers",
      "Growth $79/mo: up to 500 subscribers",
      "Pro $249/mo: up to 2,500 subscribers",
      "Scale $749/mo: up to 10,000 subscribers",
      "At 1,000 subscribers paying $9.99/mo: you earn ~$9,700/mo, pay $249 to Spotlightly, keep ~$9,450",
    ],
  },
];

export default function GuidePage() {
  const serif = "Cormorant Garamond, Georgia, serif";
  const mono = "DM Mono, monospace";
  const sans = "Plus Jakarta Sans, DM Sans, sans-serif";

  return (
    <main style={{ minHeight: "100vh", background: "#09090C", color: "#e8e8f0", fontFamily: sans, fontWeight: 300 }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" className="brand-logo" style={{ fontSize: 24 }}>Spot<span>light</span>ly
        </Link>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <Link href="/help" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#71717a", textDecoration: "none" }}>Help</Link>
          <Link href="/signup" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#09090C", background: "#F0B429", padding: "8px 18px", borderRadius: 3, textDecoration: "none" }}>Start free →</Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{
        padding: "80px 40px 60px", maxWidth: 860, margin: "0 auto",
        background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(240,180,41,0.07) 0%, transparent 70%)",
      }}>
        <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", color: "#71717a", marginBottom: 16 }}>Creator Guide</p>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(40px,6vw,64px)", fontWeight: 300, color: "#fff", lineHeight: 1.05, marginBottom: 20, letterSpacing: "-0.02em" }}>
          From signup to<br /><em style={{ fontStyle: "italic", color: "#F0B429" }}>your first $1,000.</em>
        </h1>
        <p style={{ fontSize: 17, color: "rgba(232,232,240,0.65)", lineHeight: 1.75, maxWidth: 600, marginBottom: 40 }}>
          Ten steps. Plain language. Everything you need to go from brand new to fully set up and earning. Save this page — come back to any step at any time.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/signup" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#09090C", background: "#F0B429", padding: "14px 28px", borderRadius: 3, textDecoration: "none" }}>
            Start for free →
          </Link>
          <Link href="/help" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#71717a", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "14px 28px", borderRadius: 3, textDecoration: "none" }}>
            Help center
          </Link>
        </div>
      </div>

      {/* Steps */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 40px 100px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr", background: "#0E0E12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" }}>
              {/* Number column */}
              <div style={{ background: "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "28px 0 28px" }}>
                <span style={{ fontFamily: serif, fontSize: 32, fontWeight: 300, color: "#F0B429", lineHeight: 1 }}>{step.num}</span>
                <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3f3f46", marginTop: 8, textAlign: "center", padding: "0 8px" }}>{step.time}</span>
              </div>

              {/* Content */}
              <div style={{ padding: "28px 32px" }}>
                <h2 style={{ fontFamily: serif, fontSize: 24, fontWeight: 400, color: "#fff", marginBottom: 12, lineHeight: 1.2 }}>{step.title}</h2>
                <p style={{ fontSize: 15, color: "rgba(232,232,240,0.65)", lineHeight: 1.7, marginBottom: 20 }}>{step.what}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {step.tips.map((tip, ti) => (
                    <div key={ti} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ color: "#F0B429", flexShrink: 0, marginTop: 3, fontSize: 12 }}>✦</span>
                      <span style={{ fontSize: 13, color: "rgba(232,232,240,0.55)", lineHeight: 1.65 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 48, background: "#0E0E12", border: "1px solid rgba(240,180,41,0.2)", borderRadius: 6, padding: "48px 40px", textAlign: "center" }}>
          <h2 style={{ fontFamily: serif, fontSize: 36, fontWeight: 300, color: "#fff", marginBottom: 12 }}>
            Your stage is <em style={{ fontStyle: "italic", color: "#F0B429" }}>waiting.</em>
          </h2>
          <p style={{ fontSize: 15, color: "rgba(232,232,240,0.55)", marginBottom: 28 }}>30-day free trial. No card required to start.</p>
          <Link href="/signup" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#09090C", background: "#F0B429", padding: "16px 36px", borderRadius: 3, textDecoration: "none", display: "inline-block" }}>
            Claim your handle →
          </Link>
          <p style={{ fontFamily: mono, fontSize: 10, color: "#52525b", marginTop: 20, letterSpacing: "0.08em" }}>
            Questions? <a href="mailto:support@spotlightly.app" style={{ color: "#71717a", textDecoration: "none" }}>support@spotlightly.app</a>
          </p>
        </div>
      </div>

    </main>
  );
}
