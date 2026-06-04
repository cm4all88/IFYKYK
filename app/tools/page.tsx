import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Tools · Spotlightly",
  description: "The software every serious creator uses. Honest recommendations, every budget.",
};

const TOOL_SECTIONS = [
  {
    id: "video",
    emoji: "🎬",
    name: "Video Editing",
    lede: "The software that turns raw footage into content fans actually watch.",
    tools: [
      {
        name: "DaVinci Resolve",
        tagline: "Best free editor — used by Hollywood",
        price: "Free (Studio: $295 one-time)",
        why: "Genuinely professional color grading, audio, and editing. The free version beats most paid alternatives. Start here.",
        affiliate: "https://www.blackmagicdesign.com/products/davinciresolve",
        badge: "Free",
        badgeColor: "#34D399",
      },
      {
        name: "CapCut Pro",
        tagline: "Best for short-form — TikTok, Reels, Shorts",
        price: "$9.99/mo",
        why: "AI-powered captions, auto-cut to beat, trending templates. Built for social-first creators. Mobile and desktop.",
        affiliate: "https://www.capcut.com",
        badge: null,
      },
      {
        name: "Adobe Premiere Pro",
        tagline: "Industry standard for YouTube & long-form",
        price: "$55/mo",
        why: "The professional standard. Every editor knows it, every studio uses it. Worth it at scale.",
        affiliate: "https://www.adobe.com/products/premiere.html",
        badge: "Pro pick",
        badgeColor: "#F0B429",
      },
      {
        name: "Final Cut Pro",
        tagline: "Best for Mac creators",
        price: "$299 one-time",
        why: "Fastest rendering on Apple Silicon. If you're on a Mac and serious about video, this pays for itself fast.",
        affiliate: "https://www.apple.com/final-cut-pro/",
        badge: "Mac only",
        badgeColor: "#C084FC",
      },
    ],
  },
  {
    id: "design",
    emoji: "🎨",
    name: "Design & Graphics",
    lede: "Thumbnails, channel art, social graphics — design that makes fans click.",
    tools: [
      {
        name: "Canva Pro",
        tagline: "Best for non-designers — thumbnails, social posts",
        price: "$15/mo",
        why: "Magic resize, brand kit, thousands of creator templates. The tool most creators use every single day.",
        affiliate: "https://www.canva.com/pro/",
        badge: "Most popular",
        badgeColor: "#34D399",
      },
      {
        name: "Adobe Express",
        tagline: "Best for quick branded content",
        price: "$10/mo",
        why: "AI-powered templates, Firefly image generation built in. Fast and polished.",
        affiliate: "https://www.adobe.com/express/",
        badge: null,
      },
      {
        name: "Figma",
        tagline: "Best for advanced creators and brand systems",
        price: "$15/mo",
        why: "If you have a team or want pixel-perfect control over your visual brand. Overkill for most, perfect for some.",
        affiliate: "https://www.figma.com",
        badge: null,
      },
    ],
  },
  {
    id: "streaming",
    emoji: "📡",
    name: "Streaming Software",
    lede: "The software between your setup and your audience.",
    tools: [
      {
        name: "OBS Studio",
        tagline: "Best free streaming software — industry standard",
        price: "Free",
        why: "Every serious streamer starts here. Open source, endlessly customizable, zero cost. No reason not to use it.",
        affiliate: "https://obsproject.com",
        badge: "Free",
        badgeColor: "#34D399",
      },
      {
        name: "Streamlabs",
        tagline: "Best for beginners — OBS with training wheels",
        price: "Free (Ultra: $19/mo)",
        why: "Alerts, widgets, and themes built in. Easier than OBS with most of the same power. Good starting point.",
        affiliate: "https://streamlabs.com",
        badge: null,
      },
      {
        name: "Elgato 4K Capture Card",
        tagline: "Required for console streaming",
        price: "$180",
        why: "If you're streaming gameplay from PlayStation or Xbox, you need a capture card. This is the best one.",
        affiliate: `https://www.amazon.com/dp/B09V1JJ875?tag=${process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG ?? "spotlightly-20"}`,
        badge: null,
      },
    ],
  },
  {
    id: "productivity",
    emoji: "⚡",
    name: "Creator Productivity",
    lede: "Tools that save you hours every week.",
    tools: [
      {
        name: "Notion",
        tagline: "Best content planning and organization",
        price: "Free (Plus: $10/mo)",
        why: "Content calendar, brand guidelines, brand deals tracker, video scripts — all in one place. Every creator should use this.",
        affiliate: "https://notion.so",
        badge: "Free to start",
        badgeColor: "#34D399",
      },
      {
        name: "Buffer",
        tagline: "Best social media scheduler",
        price: "Free (Essentials: $6/mo)",
        why: "Schedule posts across TikTok, Instagram, YouTube, X from one dashboard. Batch your content, post automatically.",
        affiliate: "https://buffer.com",
        badge: null,
      },
      {
        name: "Later",
        tagline: "Best visual Instagram scheduler",
        price: "$18/mo",
        why: "Drag-and-drop calendar, visual grid planner, best-time-to-post analytics. Built for Instagram-first creators.",
        affiliate: "https://later.com",
        badge: null,
      },
      {
        name: "Descript",
        tagline: "Best AI-powered video and podcast editing",
        price: "Free (Hobbyist: $24/mo)",
        why: "Edit video by editing text. Remove filler words automatically. Transcribe podcasts. Genuinely revolutionary for creators.",
        affiliate: "https://www.descript.com",
        badge: "AI-powered",
        badgeColor: "#C084FC",
      },
    ],
  },
  {
    id: "storage",
    emoji: "☁️",
    name: "Storage & Backup",
    lede: "Lose your footage once and you'll wish you had this.",
    tools: [
      {
        name: "Backblaze",
        tagline: "Best unlimited cloud backup",
        price: "$9/mo",
        why: "Unlimited storage backup for one computer. Every creator who shoots video needs this. Lose your footage once and you'll understand.",
        affiliate: "https://www.backblaze.com",
        badge: "Essential",
        badgeColor: "#F0B429",
      },
      {
        name: "Google One (2TB)",
        tagline: "Best Google Drive storage upgrade",
        price: "$10/mo",
        why: "If you already live in Google Docs/Drive for scripts and planning, this gives you 2TB for photos and video backup.",
        affiliate: "https://one.google.com",
        badge: null,
      },
      {
        name: "Dropbox Plus",
        tagline: "Best team collaboration storage",
        price: "$10/mo",
        why: "If you work with editors, this makes file sharing simple. Smart sync means your full library doesn't take local space.",
        affiliate: "https://www.dropbox.com/plus",
        badge: null,
      },
    ],
  },
];

export default function ToolsPage() {
  return (
    <>
      <SiteHeader />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px 120px" }}>

        <div style={{ marginBottom: 56 }}>
          <p style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(242,184,75,0.6)", marginBottom: 8 }}>Creator software toolkit</p>
          <h1 style={{ fontFamily: "var(--font-serif, Cormorant Garamond, Georgia, serif)", fontSize: "clamp(36px,5vw,56px)", fontWeight: 300, color: "#fff", lineHeight: 1.05, marginBottom: 16 }}>
            The software stack.<br /><em style={{ color: "#F0B429" }}>Built for creators.</em>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(242,242,240,0.7)", lineHeight: 1.75, maxWidth: 560 }}>
            Every tool here is used by working creators. No bloated suites, no software you&apos;ll install and never open. Just what actually moves the needle.
          </p>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 16, fontFamily: "var(--font-mono, DM Mono, monospace)", letterSpacing: ".06em" }}>
            DISCLOSURE: We may earn a commission on purchases through some links at no extra cost to you.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          {TOOL_SECTIONS.map(section => (
            <div key={section.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 22 }}>{section.emoji}</span>
                <div>
                  <h2 style={{ fontFamily: "var(--font-serif, Cormorant Garamond, Georgia, serif)", fontSize: 26, fontWeight: 300, color: "#fff", lineHeight: 1 }}>{section.name}</h2>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{section.lede}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 3 }}>
                {section.tools.map((tool, i) => (
                  <a key={i} href={tool.affiliate} target="_blank" rel="noopener noreferrer nofollow"
                    style={{ display: "block", background: "#232428", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "3px solid rgba(242,184,75,0.2)", borderRadius: 6, padding: "24px", textDecoration: "none", transition: "border-color 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#F2F2F0" }}>{tool.name}</span>
                          {tool.badge && (
                            <span style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: tool.badgeColor, background: `${tool.badgeColor}15`, border: `1px solid ${tool.badgeColor}30`, padding: "2px 8px", borderRadius: 3 }}>
                              {tool.badge}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: "var(--muted)" }}>{tool.tagline}</p>
                      </div>
                      <span style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 13, color: "#F0B429", fontWeight: 700, flexShrink: 0 }}>{tool.price}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.65 }}>{tool.why}</p>
                    <p style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(242,184,75,0.7)", marginTop: 12 }}>Get it →</p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 80, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-serif, Cormorant Garamond, Georgia, serif)", fontSize: 28, fontWeight: 300, color: "#fff", marginBottom: 12 }}>
            Need physical gear too? <em style={{ color: "#F0B429" }}>We&apos;ve got that covered.</em>
          </p>
          <a href="/gear" style={{ display: "inline-block", background: "transparent", color: "#F0B429", fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "12px 28px", borderRadius: 4, textDecoration: "none", border: "1px solid rgba(242,184,75,0.35)" }}>
            See the gear guide →
          </a>
        </div>

      </main>
      <Footer />
    </>
  );
}
