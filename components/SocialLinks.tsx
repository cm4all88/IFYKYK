// Renders a creator's saved social_links as a clean row of icon links.
// Keys match the dashboard editor: social_instagram, social_tiktok, etc.
import React from "react";

const sw = 1.7;
const ico = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const PLATFORMS: { key: string; label: string; color: string; href: (v: string) => string; icon: React.ReactNode }[] = [
  { key: "social_instagram", label: "Instagram", color: "#E1306C",
    icon: ico(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r="0.6" fill="currentColor" stroke="none" /></>) , href: v => v },
  { key: "social_tiktok", label: "TikTok", color: "#69C9D0",
    icon: ico(<><path d="M9.5 12.5a3 3 0 1 0 3 3V5" /><path d="M12.5 5a4.5 4.5 0 0 0 4.5 4.3" /></>), href: v => v },
  { key: "social_youtube", label: "YouTube", color: "#FF0000",
    icon: ico(<><rect x="2.5" y="6" width="19" height="12" rx="3.5" /><path d="M10.5 9.5l4.5 2.5-4.5 2.5z" /></>), href: v => v },
  { key: "social_twitter", label: "X", color: "#fff",
    icon: ico(<><path d="M5 5l14 14M19 5L5 19" /></>), href: v => v },
  { key: "social_twitch", label: "Twitch", color: "#9146FF",
    icon: ico(<><path d="M5 4h14v9l-4 4h-3l-3 3v-3H5z" /><path d="M10 8.5v3.5M15 8.5v3.5" /></>), href: v => v },
  { key: "social_snapchat", label: "Snapchat", color: "#FFFC00",
    icon: ico(<><path d="M12 3.5C8.7 3.5 6.3 6.2 6.3 9.2V15.4Q8.2 18.2 10.1 15.4 12 18.2 13.9 15.4 15.8 18.2 17.7 15.4V9.2C17.7 6.2 15.3 3.5 12 3.5Z" /></>), href: v => v },
  { key: "social_discord", label: "Discord", color: "#5865F2",
    icon: ico(<><path d="M8 6h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3l-2 2v-2H8a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" /><circle cx="10" cy="12" r="0.7" fill="currentColor" stroke="none" /><circle cx="14" cy="12" r="0.7" fill="currentColor" stroke="none" /></>), href: v => v },
  { key: "social_substack", label: "Substack", color: "#FF6719",
    icon: ico(<><path d="M5 5h14M5 9h14M5 13v6l7-3 7 3v-6z" /></>), href: v => v },
  { key: "social_website", label: "Website", color: "#F2B84B",
    icon: ico(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 4 3 14 0 18M12 3c-3 4-3 14 0 18" /></>), href: v => v },
];

function pick(links: Record<string, string>, key: string) {
  const bare = key.replace(/^social_/, "");
  return links[key] ?? links[bare] ?? "";
}

function normalize(v: string) {
  const t = (v || "").trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export default function SocialLinks({ links }: { links?: Record<string, string> | null }) {
  if (!links) return null;
  const items = PLATFORMS.filter(p => { const v = pick(links, p.key); return v && String(v).trim(); });
  if (items.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "0 0 18px" }}>
      <style>{`.sl-link{color:rgba(255,255,255,0.72);transition:transform .15s ease,color .15s ease,border-color .15s ease;}
.sl-link:hover{transform:translateY(-2px);color:var(--hover);border-color:var(--hover);}`}</style>
      {items.map(p => (
        <a
          key={p.key}
          className="sl-link"
          href={normalize(pick(links, p.key))}
          target="_blank"
          rel="noopener noreferrer me"
          aria-label={p.label}
          title={p.label}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
            // @ts-ignore custom prop for hover color
            ["--hover" as any]: p.color,
          }}
        >
          <span style={{ display: "flex", color: "inherit" }}>{p.icon}</span>
        </a>
      ))}
    </div>
  );
}
