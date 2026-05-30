import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Product Roadmap · Admin · Spotlightly" };

const ROADMAP: {
  status: "live" | "building" | "soon" | "future" | "parked";
  label: string;
  color: string;
  colorSoft: string;
  items: {
    name: string;
    desc: string;
    effort?: string;
    revenue?: string;
    note?: string;
  }[];
}[] = [
  {
    status: "live",
    label: "Live",
    color: "#34D399",
    colorSoft: "rgba(52,211,153,0.08)",
    items: [
      { name: "Creator subscriptions", desc: "Fans subscribe to creators via Stripe Connect. Flat monthly fee by tier." },
      { name: "Fan tips", desc: "0% cut. Acquisition strategy. Creator keeps everything." },
      { name: "Super Tips", desc: "15% platform cut. Badge, pinned comment, top supporter display." },
      { name: "Locked posts (purchase)", desc: "One-time unlock via Stripe. Platform keeps 100%." },
      { name: "Comment Boosts", desc: "Fan pays $1.99–$9.99 to pin comment 24h. 100% to platform." },
      { name: "Early Access Passes", desc: "$2.99/mo. Fans see posts 30min early. 100% to platform." },
      { name: "Gift subscriptions", desc: "Fan gifts a creator subscription to another user." },
      { name: "Campaigns", desc: "Creator fundraising with Stripe." },
      { name: "Wishlist", desc: "Creator wishlist with Stripe checkout for fans." },
      { name: "Live streaming", desc: "BunnyCDN live streaming from creator dashboard." },
      { name: "Merch (Loudcap)", desc: "Creator merch via Printful, 5% platform fee — you keep the rest." },
      { name: "Backstagely", desc: "Adult content serving domain. CCBill pending approval." },
      { name: "Creator billing tiers", desc: "5 tiers ($29–$3,499/mo). 30-day free trial. Auto-upgrades." },
      { name: "Creator onboarding", desc: "3-step wizard. Profile, Stripe Connect, done." },
      { name: "Fan discovery", desc: "Search, tag filters, location, AI recommendations." },
      { name: "Gear, Tools, Music pages", desc: "Amazon + software affiliate revenue. Passive income." },
      { name: "Fan account page", desc: "Subscriptions, unlocked posts, early access, cancel." },
      { name: "Admin section", desc: "Creators, moderation, subscriptions, flags, credentials." },
    ],
  },
  {
    status: "building",
    label: "In Progress",
    color: "#F0B429",
    colorSoft: "rgba(240,180,41,0.08)",
    items: [
      { name: "CCBill integration", desc: "Pending merchant account approval (2–4 weeks). Backstagely goes live on approval.", effort: "Done — waiting on CCBill", note: "Apply DMCA agent + business bank account first" },
      { name: "Stripe live keys", desc: "In review with Stripe. Swap test keys for live keys on approval.", effort: "Waiting on Stripe review" },
      { name: "Yooits.me integration", desc: "Auto-create Yooits page on creator signup. Subscribe button on Yooits links back to Spotlightly.", effort: "Needs Yooits repo access" },
      { name: "Clipurl.ink integration", desc: "Auto-generate short link for every creator profile and post. Surfaced in dashboard.", effort: "Needs Clipurl repo access" },
    ],
  },
  {
    status: "soon",
    label: "Build Next",
    color: "#C084FC",
    colorSoft: "rgba(192,132,252,0.08)",
    items: [
      { name: "Brand deal marketplace", desc: "Creators list their audience stats. Brands browse and make offers. Platform takes 15–20% of deal value.", effort: "~2 weeks", revenue: "High — top creators do $10k–$100k deals" },
      { name: "Virtual event ticketing", desc: "Creator sells tickets to a live event. Platform collects payment, pays creator after. 10% cut.", effort: "~1 week", revenue: "Creator with 10k fans at $9.99 = $100k gross, $10k to platform" },
      { name: "Fan loyalty points", desc: "Fans earn Spotlight Points for subscribing, tipping, buying merch, gifting. Points unlock platform perks.", effort: "~1 week", revenue: "No direct revenue — retention and engagement driver" },
      { name: "AI content assistant", desc: "Beyond the monetization advisor — caption writing, post ideas, optimal posting time based on subscriber activity.", effort: "~1 week", revenue: "Stickiness. Reduces churn." },
      { name: "Creator referral program", desc: "Creator refers another creator. Gets one month free or revenue share on their first 3 months of fees.", effort: "~3 days", revenue: "Acquisition flywheel. Costs ~$29–$249 per creator acquired." },
    ],
  },
  {
    status: "future",
    label: "Future",
    color: "#60A5FA",
    colorSoft: "rgba(96,165,250,0.08)",
    items: [
      { name: "Agency / manager dashboard", desc: "Talent managers log in and manage multiple creator accounts. Higher tier pricing. B2B SaaS revenue on top of creator platform.", revenue: "B2B revenue, lower churn" },
      { name: "Creator collab marketplace", desc: "Creators find collaborators based on audience overlap and category. Joint posts, split revenue. Platform facilitates, earns goodwill.", revenue: "Indirect — engagement and acquisition" },
      { name: "Aggregated data reports", desc: "Anonymized platform data → 'State of Creator Monetization' quarterly reports. Sold to brands, VCs, media companies.", revenue: "$5k–$50k per report" },
      { name: "Creator advances", desc: "Based on 6+ months subscription history, advance creators $5k–$50k against future flat fees. Recoup from monthly billing.", revenue: "Spread on advance. High risk. Needs capital." },
      { name: "Fan challenges / contests", desc: "Creator runs a challenge. Fans submit entries. Community votes. Engagement tool.", revenue: "Indirect engagement" },
      { name: "Creator residency program", desc: "Selected creators get promoted on explore page and marketing materials. Builds platform brand.", revenue: "Indirect acquisition" },
      { name: "Tipping tournaments", desc: "Limited-time events where fans compete to be top tipper. Leaderboard, prizes from creator.", revenue: "Super tip volume spike during events" },
    ],
  },
  {
    status: "parked",
    label: "Parked / Won't Build",
    color: "#71717A",
    colorSoft: "rgba(113,113,122,0.06)",
    items: [
      { name: "Creator subscription bundles", desc: "Fan subscribes to multiple creators at a discount. DOESN'T WORK — Spotlightly doesn't control subscription payments between fans and creators (Stripe Connect model). Can't discount what we don't handle.", note: "Architecture incompatible. Fans pay creators directly." },
      { name: "Opening Act (teen creator tier)", desc: "Parked after structural conflict analysis. Common ownership of minor creator platform and adult content platform is unresolvable regardless of compliance mitigations.", note: "Potential future separate venture under different ownership." },
    ],
  },
];

const STATUS_ORDER = ["live", "building", "soon", "future", "parked"];

export default async function RoadmapPage() {
  if (!(await isAdmin())) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", fontWeight: 300 }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="brand-logo" style={{ fontSize: 22 }}>Spot<span>light</span>ly
          </Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>/ Admin / Roadmap</span>
        </div>
        <Link href="/admin" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--muted)", textDecoration: "none" }}>← Admin</Link>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 28px 100px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Product Roadmap</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1, marginBottom: 8 }}>
          What gets built, <em style={{ color: "var(--accent)" }}>in what order.</em>
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, maxWidth: 560, marginBottom: 48 }}>
          Single source of truth for every idea, feature, and product decision. Parked section documents what we explicitly decided not to build and why.
        </p>

        {/* Summary counts */}
        <div style={{ display: "flex", gap: 3, marginBottom: 48, flexWrap: "wrap" }}>
          {ROADMAP.map(section => (
            <div key={section.status} style={{ background: section.colorSoft, border: `1px solid ${section.color}30`, borderRadius: 8, padding: "14px 20px", minWidth: 120 }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: section.color, lineHeight: 1, marginBottom: 4 }}>{section.items.length}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: section.color }}>{section.label}</p>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          {ROADMAP.map(section => (
            <div key={section.status}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: section.color, flexShrink: 0 }} />
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: section.color }}>{section.label}</h2>
                <div style={{ flex: 1, height: 1, background: `${section.color}20` }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: section.color, opacity: 0.5 }}>{section.items.length} items</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {section.items.map((item, i) => (
                  <div key={i} style={{ background: section.colorSoft, border: `1px solid ${section.color}18`, borderRadius: 8, padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{item.name}</p>
                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>{item.desc}</p>
                        {item.note && (
                          <p style={{ fontSize: 12, color: section.color, marginTop: 6, fontStyle: "italic", opacity: 0.7 }}>⚠ {item.note}</p>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, alignItems: "flex-end" }}>
                        {item.effort && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: section.color, background: `${section.color}15`, border: `1px solid ${section.color}25`, padding: "3px 10px", borderRadius: 99 }}>
                            {item.effort}
                          </span>
                        )}
                        {item.revenue && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", color: "rgba(255,255,255,0.3)", maxWidth: 180, textAlign: "right", lineHeight: 1.4 }}>
                            {item.revenue}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
