import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Gear Guide · Spotlightly",
  description: "The exact equipment you need to start creating and streaming. Curated by Spotlightly for every budget.",
};

const TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG ?? "spotlightly-20";

function amzLink(asin: string) {
  return `https://www.amazon.com/dp/${asin}?tag=${TAG}`;
}

const BUNDLES = [
  {
    id: "starter",
    name: "Starter",
    price: "~$300",
    tagline: "Everything you need to start. Nothing you don't.",
    color: "#34D399",
    colorSoft: "rgba(52,211,153,0.08)",
    colorBorder: "rgba(52,211,153,0.2)",
    description: "Plug in and start creating today. This setup produces professional-quality audio and clear video for under $300 — more than enough to launch your Spotlightly page.",
    items: [
      { name: "Blue Yeti USB Microphone", role: "Audio", why: "The most popular creator mic ever made. Plug-and-play, four pickup patterns, broadcast quality. Start here.", price: "$129", asin: "B00N1YPXW2", essential: true },
      { name: "Logitech C920x HD Webcam", role: "Video", why: "Full 1080p, auto-focus, Carl Zeiss glass. The most trusted webcam at this price point for 10+ years running.", price: "$70", asin: "B085TFF7M1", essential: true },
      { name: "Ring Light with Tripod Stand", role: "Lighting", why: "Good lighting transforms your content more than any camera upgrade. This 18-inch ring light is where most creators start.", price: "$45", asin: "B082PXJQ9B", essential: true },
    ],
  },
  {
    id: "creator",
    name: "Creator",
    price: "~$800",
    tagline: "The setup serious creators use every day.",
    color: "#F0B429",
    colorSoft: "rgba(240,180,41,0.08)",
    colorBorder: "rgba(240,180,41,0.2)",
    description: "This is the setup that makes fans think you're a professional. Crystal-clear audio, sharp 4K video, and studio lighting that makes you look like you belong in a broadcast studio.",
    items: [
      { name: "Elgato Wave:3 USB Microphone", role: "Audio", why: "Built-in clipguard technology prevents distortion. Clean broadcast sound, wave link software for mixing, looks great on camera too.", price: "$150", asin: "B088GV4FGX", essential: true },
      { name: "Logitech Brio 4K Webcam", role: "Video", why: "4K resolution, HDR, rightlight 3 low-light performance. When your subscribers see this quality, they subscribe faster.", price: "$200", asin: "B0751YB35B", essential: true },
      { name: "Elgato Key Light", role: "Lighting", why: "The professional studio standard. App-controlled color temperature and brightness. Soft, diffused light that makes everything look expensive.", price: "$200", asin: "B07L755X9G", essential: true },
      { name: "Elgato Stream Deck MK.2", role: "Workflow", why: "15 customizable LCD keys. Switch scenes, launch clips, trigger alerts, control audio — all without breaking eye contact with your camera.", price: "$150", asin: "B09738CV2G", essential: false },
      { name: "Elgato Wave Mic Arm Pro", role: "Setup", why: "Get the mic off your desk and in front of your mouth where it belongs. Significantly improves audio quality for any microphone.", price: "$90", asin: "B0DGQMDKH3", essential: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "~$1,500",
    tagline: "The setup top creators use for broadcast-quality results.",
    color: "#C084FC",
    colorSoft: "rgba(192,132,252,0.08)",
    colorBorder: "rgba(192,132,252,0.2)",
    description: "If you're serious about live streaming and professional content, this is the setup that separates you from every other creator in your niche. The same gear used by top Twitch and YouTube creators.",
    items: [
      { name: "Shure SM7B Dynamic Microphone", role: "Audio", why: "The mic that recorded Thriller. Podcast standard. Zero background noise, warm broadcast tone. The mic your audience will notice immediately.", price: "$399", asin: "B0002E4Z8M", essential: true },
      { name: "Focusrite Scarlett Solo (4th Gen)", role: "Audio Interface", why: "Pairs with the SM7B. Converts your XLR mic to USB. Preamp with Air mode adds broadcast clarity. The professional audio chain.", price: "$130", asin: "B09FWDR6FM", essential: true },
      { name: "Sony ZV-E10 Mirrorless Camera", role: "Video", why: "DSLR-quality video over HDMI. Interchangeable lenses, real-time eye tracking, beautiful background blur. Viewers will notice the difference.", price: "$698", asin: "B09BBGPTJP", essential: true },
      { name: "Elgato Key Light (Set of 2)", role: "Lighting", why: "Key light and fill light. Eliminates shadows, creates dimensional studio lighting. Looks like a broadcast set on any background.", price: "$400", asin: "B07L755X9G", essential: true },
      { name: "Elgato Stream Deck XL", role: "Workflow", why: "32 customizable keys. Every scene, every clip, every action one button. Non-negotiable for serious streamers.", price: "$250", asin: "B07RL8H55Z", essential: false },
      { name: "Elgato HD60 X Capture Card", role: "Streaming", why: "Stream at 4K30 or 1080p60. Captures from any console or camera. Required if you're streaming gameplay or using a camera over HDMI.", price: "$180", asin: "B09V1JJ875", essential: false },
    ],
  },
];

const INDIVIDUAL = [
  {
    category: "Microphones",
    emoji: "🎙️",
    products: [
      { name: "Blue Yeti Nano", tagline: "Best budget USB mic", price: "$99", asin: "B07DTTGZ7M" },
      { name: "Shure MV7+ USB/XLR", tagline: "Best USB/XLR hybrid", price: "$249", asin: "B0CG4PZP8D" },
      { name: "Rode PodMic USB", tagline: "Best podcasting mic", price: "$199", asin: "B09K7BMYL9" },
      { name: "HyperX QuadCast S", tagline: "Best gaming/streaming mic", price: "$160", asin: "B08NB8FGKB" },
    ],
  },
  {
    category: "Cameras & Webcams",
    emoji: "📷",
    products: [
      { name: "Logitech C920x", tagline: "Best budget 1080p", price: "$70", asin: "B085TFF7M1" },
      { name: "Elgato Facecam MK.2", tagline: "Best creator webcam", price: "$200", asin: "B0CMVQWVWL" },
      { name: "Logitech Brio 4K", tagline: "Best 4K webcam", price: "$200", asin: "B0751YB35B" },
      { name: "Sony ZV-E10", tagline: "Best mirrorless starter", price: "$698", asin: "B09BBGPTJP" },
    ],
  },
  {
    category: "Lighting",
    emoji: "💡",
    products: [
      { name: "Neewer Ring Light 18\"", tagline: "Best budget lighting", price: "$45", asin: "B082PXJQ9B" },
      { name: "Elgato Key Light Air", tagline: "Best compact key light", price: "$130", asin: "B082CFZG6B" },
      { name: "Elgato Key Light", tagline: "Best studio light", price: "$200", asin: "B07L755X9G" },
      { name: "Godox SL60W LED", tagline: "Best photography light", price: "$89", asin: "B01N8Y6YMR" },
    ],
  },
  {
    category: "Audio Accessories",
    emoji: "🎧",
    products: [
      { name: "Boom Arm Mic Stand", tagline: "Essential for any setup", price: "$30", asin: "B001D0OGN2" },
      { name: "Focusrite Scarlett Solo", tagline: "Best XLR audio interface", price: "$130", asin: "B09FWDR6FM" },
      { name: "Sony MDR-7506 Headphones", tagline: "Industry standard monitoring", price: "$99", asin: "B000AJIF4E" },
      { name: "Acoustic Foam Panels", tagline: "Fix your room acoustics", price: "$50", asin: "B01N2GH2OP" },
    ],
  },
];

export default function GearPage() {
  return (
    <>
      <SiteHeader />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px 120px" }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: 8 }}>Creator gear guide</p>
          <h1 style={{ fontFamily: "var(--font-serif, Cormorant Garamond, Georgia, serif)", fontSize: "clamp(36px,5vw,56px)", fontWeight: 300, color: "#fff", lineHeight: 1.05, marginBottom: 16 }}>
            The exact setup you need.<br /><em style={{ color: "#F0B429" }}>At every budget.</em>
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-soft)", lineHeight: 1.75, maxWidth: 580 }}>
            Curated by Spotlightly for creators at every stage. Audio first — always. These are the exact products top creators use, organized by what actually moves the needle.
          </p>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 16, fontFamily: "var(--font-mono, DM Mono, monospace)", letterSpacing: ".06em" }}>
            DISCLOSURE: We earn a commission on purchases made through these links at no extra cost to you. We only recommend gear we&apos;d use ourselves.
          </p>
        </div>

        {/* Bundle cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 80 }}>
          {BUNDLES.map(bundle => (
            <div key={bundle.id} style={{ background: "#232428", border: `1px solid ${bundle.colorBorder}`, borderRadius: 6, overflow: "hidden" }}>
              {/* Bundle header */}
              <div style={{ background: bundle.colorSoft, borderBottom: `1px solid ${bundle.colorBorder}`, padding: "28px 32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: bundle.color, background: `rgba(0,0,0,0.2)`, border: `1px solid ${bundle.colorBorder}`, padding: "3px 10px", borderRadius: 4 }}>
                      {bundle.name} Bundle
                    </span>
                    <span style={{ fontFamily: "var(--font-serif, Cormorant Garamond, Georgia, serif)", fontSize: 22, fontWeight: 400, color: bundle.color }}>{bundle.price}</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6 }}>{bundle.tagline}</p>
                  <p style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.65, maxWidth: 500 }}>{bundle.description}</p>
                </div>
              </div>

              {/* Bundle items */}
              <div style={{ padding: "8px 0" }}>
                {bundle.items.map((item, i) => (
                  <a
                    key={i}
                    href={amzLink(item.asin)}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: "20px 32px", textDecoration: "none", borderBottom: i < bundle.items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: bundle.colorSoft, border: `1px solid ${bundle.colorBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
                      {item.role === "Audio" ? "🎙️" : item.role === "Video" ? "📷" : item.role === "Lighting" ? "💡" : item.role === "Workflow" ? "⚡" : item.role === "Setup" ? "🔧" : item.role === "Audio Interface" ? "🎛️" : item.role === "Streaming" ? "🎮" : "📦"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#F2F2F0" }}>{item.name}</span>
                        <span style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: bundle.color, background: bundle.colorSoft, border: `1px solid ${bundle.colorBorder}`, padding: "2px 8px", borderRadius: 3 }}>{item.role}</span>
                        {item.essential && <span style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-soft)", padding: "2px 8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3 }}>Essential</span>}
                      </div>
                      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{item.why}</p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <p style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 14, fontWeight: 700, color: bundle.color, marginBottom: 4 }}>{item.price}</p>
                      <p style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-soft)" }}>Amazon →</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Individual products */}
        <div style={{ marginBottom: 80 }}>
          <p style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: 32 }}>Shop by category</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 3 }}>
            {INDIVIDUAL.map(cat => (
              <div key={cat.category} style={{ background: "#232428", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                  <span style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-soft)" }}>{cat.category}</span>
                </div>
                {cat.products.map((p, i) => (
                  <a
                    key={i}
                    href={amzLink(p.asin)}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", textDecoration: "none", borderBottom: i < cat.products.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#F2F2F0", marginBottom: 2 }}>{p.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-soft)" }}>{p.tagline}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 13, color: "#F0B429", fontWeight: 700 }}>{p.price}</p>
                    </div>
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* The one rule */}
        <div style={{ background: "rgba(240,180,41,0.05)", border: "1px solid rgba(240,180,41,0.15)", borderRadius: 6, padding: "32px 40px", marginBottom: 48 }}>
          <p style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(240,180,41,0.5)", marginBottom: 12 }}>The one rule</p>
          <h3 style={{ fontFamily: "var(--font-serif, Cormorant Garamond, Georgia, serif)", fontSize: 24, fontWeight: 300, color: "#fff", marginBottom: 12, lineHeight: 1.1 }}>
            Audio first. Always.
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-soft)", lineHeight: 1.75, maxWidth: 560, margin: 0 }}>
            Viewers will watch 720p video with great audio for hours. They&apos;ll leave 4K video with bad audio in seconds.
            If you&apos;re on a tight budget, spend it on the microphone first. Upgrade everything else later.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-serif, Cormorant Garamond, Georgia, serif)", fontSize: 28, fontWeight: 300, color: "#fff", marginBottom: 12 }}>
            Got your setup? <em style={{ color: "#F0B429" }}>Your stage is waiting.</em>
          </p>
          <a href="/dashboard" style={{ display: "inline-block", background: "#F0B429", color: "#09090C", fontFamily: "var(--font-mono, 'DM Mono', monospace)", fontWeight: 500, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "15px 36px", borderRadius: 4, textDecoration: "none" }}>
            Go to your stage →
          </a>
        </div>

      </main>
      <Footer />
    </>
  );
}
