"use client";

import { useState } from "react";
import { getNichesByCategory, getAllNicheSlugs, getNiche } from "@/lib/niches";

interface Props {
  selected: string | null;
  onSelect: (slug: string) => void;
  onSkip?: () => void;
}

export default function NichePicker({ selected, onSelect, onSkip }: Props) {
  const [search, setSearch] = useState("");
  const groups = getNichesByCategory();

  const filtered = search.trim()
    ? getAllNicheSlugs()
        .map(s => getNiche(s)!)
        .filter(n =>
          n.name.toLowerCase().includes(search.toLowerCase()) ||
          n.pageName.toLowerCase().includes(search.toLowerCase()) ||
          n.category.toLowerCase().includes(search.toLowerCase())
        )
    : null;

  const mono = "var(--font-mono, DM Mono, monospace)";
  const accent = "var(--accent, #F0B429)";
  const border = "var(--border, rgba(255,255,255,0.08))";
  const surface = "var(--surface, #111118)";
  const muted = "var(--muted, #71717a)";

  return (
    <div>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search your niche…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%", background: surface, border: `1px solid ${border}`,
            borderRadius: 4, padding: "11px 16px 11px 38px",
            color: "var(--text, #e8e8f0)", fontSize: 14, outline: "none",
            boxSizing: "border-box" as const,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = accent)}
          onBlur={e => (e.currentTarget.style.borderColor = border)}
        />
        <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: muted, fontSize: 16 }}>⌕</span>
      </div>

      {/* Filtered results */}
      {filtered ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6, marginBottom: 16 }}>
          {filtered.map(n => (
            <NicheCard key={n.slug} niche={n} selected={selected === n.slug} onSelect={onSelect} />
          ))}
          {filtered.length === 0 && (
            <p style={{ color: muted, fontSize: 13, gridColumn: "1/-1", padding: "20px 0" }}>
              No matches — pick the closest one or skip.
            </p>
          )}
        </div>
      ) : (
        // Grouped categories
        Object.entries(groups).map(([category, niches]) => (
          <div key={category} style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: muted, marginBottom: 10 }}>
              {category}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
              {niches.map(n => (
                <NicheCard key={n.slug} niche={n} selected={selected === n.slug} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))
      )}

      {onSkip && (
        <button
          onClick={onSkip}
          style={{ background: "none", border: "none", color: muted, fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", marginTop: 8, padding: "8px 0" }}
        >
          My niche isn't listed — skip
        </button>
      )}
    </div>
  );
}

function NicheCard({ niche, selected, onSelect }: { niche: any; selected: boolean; onSelect: (s: string) => void }) {
  const accent = "var(--accent, #F0B429)";
  const border = "var(--border, rgba(255,255,255,0.08))";
  const surface = "var(--surface, #111118)";

  return (
    <button
      onClick={() => onSelect(niche.slug)}
      style={{
        padding: "14px 12px", borderRadius: 6, border: "1px solid",
        cursor: "pointer", textAlign: "center",
        background: selected ? "rgba(240,180,41,0.1)" : surface,
        borderColor: selected ? "rgba(240,180,41,0.35)" : border,
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = border; }}
    >
      <div style={{ fontSize: 24, marginBottom: 6 }}>{niche.emoji}</div>
      <p style={{ fontSize: 12, fontWeight: 600, color: selected ? "var(--accent, #F0B429)" : "var(--text, #e8e8f0)", margin: 0, lineHeight: 1.3 }}>
        {niche.name}
      </p>
    </button>
  );
}
