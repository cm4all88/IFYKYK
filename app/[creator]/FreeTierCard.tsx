// The free tier shown on a creator's public page. Name, description, and perks
// are creator-editable (creator_profiles.free_tier_*); sensible defaults render
// when they haven't customized it yet, so every page shows a free option.
export default function FreeTierCard({
  name, blurb, perks, handle, loggedIn,
}: {
  name?: string | null;
  blurb?: string | null;
  perks?: string[] | null;
  handle: string;
  loggedIn: boolean;
}) {
  const title = (name || "").trim() || "General Admission";
  const desc = (blurb || "").trim() || "Follow along for free and never miss a post.";
  const list = (perks || []).filter((p) => p && p.trim());

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-serif, serif)", fontSize: 22, color: "var(--text)", lineHeight: 1.1 }}>{title}</span>
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 999, padding: "3px 10px", flexShrink: 0 }}>Free</span>
      </div>
      <p style={{ fontSize: 14, color: "var(--text-soft, rgba(232,232,240,0.72))", lineHeight: 1.6, margin: "0 0 14px" }}>{desc}</p>
      {list.length > 0 && (
        <ul style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((p, i) => (
            <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: "var(--text-soft, rgba(232,232,240,0.78))", lineHeight: 1.5 }}>
              <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
      {!loggedIn && (
        <a href={`/fan-signup?return=${encodeURIComponent(`/${handle}`)}`} className="btn btn--secondary" style={{ width: "100%", textAlign: "center" }}>
          Join free
        </a>
      )}
    </div>
  );
}
