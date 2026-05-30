"use client";

import Link from "next/link";

const NICHES = [
  { slug: "3d-designers",  emoji: "🖨️", name: "3D Print Designers",  desc: "Sell STL files directly. 0% cut on digital downloads." },
  { slug: "etsy-sellers",  emoji: "🧶", name: "Etsy Sellers",         desc: "Own your customer relationships. 5% vs Etsy's 15%." },
  { slug: "authors",       emoji: "📚", name: "Authors & Writers",     desc: "Exclusive chapters, deleted scenes, signed copies." },
  { slug: "fitness",       emoji: "💪", name: "Fitness Creators",      desc: "Sell training programs directly. 0% cut." },
  { slug: "musicians",     emoji: "🎵", name: "Musicians",             desc: "Spotify pays $0.003/stream. Fans pay $7.99/mo." },
  { slug: "artists",       emoji: "🎨", name: "Visual Artists",        desc: "Redbubble takes 80%. You keep 95% here." },
  { slug: "photographers", emoji: "📷", name: "Photographers",         desc: "Sell prints and presets. Keep 100% of digital sales." },
  { slug: "podcasters",    emoji: "🎙️", name: "Podcasters",            desc: "Ad-free episodes, bonus content, live recordings." },
  { slug: "gamers",        emoji: "🎮", name: "Gamers & Streamers",    desc: "Twitch takes 50%. Spotlightly takes 0%." },
  { slug: "educators",     emoji: "🎓", name: "Educators",             desc: "Udemy takes 50-75%. Sell your courses at full price." },
  { slug: "chefs-cooks",   emoji: "👨‍🍳", name: "Chefs & Food Creators", desc: "Sell recipe books directly. 0% cut." },
  { slug: "woodworkers",   emoji: "🪵", name: "Woodworkers",           desc: "Sell build plans, list finished pieces, live workshops." },
];

export default function NicheGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 }}>
      {NICHES.map((n) => (
        <Link
          key={n.slug}
          href={`/for/${n.slug}`}
          style={{
            display: "block",
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #eee)",
            padding: "28px 28px 24px",
            textDecoration: "none",
            color: "inherit",
            transition: "border-color 0.15s, transform 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#B8860B";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border, #eee)";
            (e.currentTarget as HTMLElement).style.transform = "none";
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 12 }}>{n.emoji}</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text, #111)", marginBottom: 8 }}>{n.name}</p>
          <p style={{ fontSize: 13, color: "var(--text-soft, #666)", lineHeight: 1.65, marginBottom: 16 }}>{n.desc}</p>
          <span style={{ fontFamily: "var(--font-mono, DM Mono, monospace)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B8860B" }}>
            See how it works →
          </span>
        </Link>
      ))}
    </div>
  );
}
