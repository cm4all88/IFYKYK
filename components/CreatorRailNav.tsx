"use client";

import { useState } from "react";

type NavLink = { id: string; label: string };

export default function CreatorRailNav({
  isSubscribed,
  tierName,
  canUpgrade,
  links,
}: {
  isSubscribed: boolean;
  tierName: string | null;
  price: number | null;
  canUpgrade: boolean;
  links: NavLink[];
}) {
  const [active, setActive] = useState<string>("all");

  // Filter the page to a single category instead of scrolling to it.
  // "all" (Everything) restores the full three-column page; any other value
  // hides every other [data-cat] block and collapses the shell to one focused
  // column so the chosen category reads in the main area, not the side rail.
  function applyFilter(id: string) {
    setActive(id);
    const shell = document.querySelector(".cp-shell") as HTMLElement | null;
    if (!shell) return;
    const showAll = id === "all";
    shell.querySelectorAll<HTMLElement>("[data-cat]").forEach((el) => {
      const cat = el.getAttribute("data-cat");
      el.classList.toggle("cp-hidden", !(showAll || cat === id));
    });
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 18,
        marginBottom: 16,
      }}
    >
      {/* subscription status — only for subscribers; non-subs subscribe via the tier cards */}
      {isSubscribed && (
        <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
            Your access
          </span>
          <p style={{ fontFamily: "var(--font-serif, serif)", fontSize: 22, color: "var(--text)", margin: "6px 0 0", lineHeight: 1.1 }}>
            {tierName || "Subscribed"}
          </p>
          {canUpgrade && (
            <button
              onClick={() => applyFilter("sec-support")}
              style={{
                marginTop: 12, width: "100%", padding: "10px 0", border: "1px solid var(--accent)",
                background: "var(--accent-soft, rgba(242,184,75,0.08))", color: "var(--accent)",
                fontFamily: "var(--font-display, sans-serif)", fontWeight: 700, fontSize: 13, borderRadius: 9, cursor: "pointer",
              }}
            >
              Upgrade tier ↑
            </button>
          )}
        </div>
      )}

      {/* category filter — shows one part of the page at a time */}
      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
        Show
      </span>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
        {links.map((l) => {
          const isActive = active === l.id;
          return (
            <button
              key={l.id}
              onClick={() => applyFilter(l.id)}
              style={{
                textAlign: "left", border: "none", cursor: "pointer",
                padding: "8px 10px", borderRadius: 7, fontSize: 14,
                fontFamily: "var(--font-display, sans-serif)",
                background: isActive ? "rgba(242,184,75,0.12)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-soft)",
                fontWeight: isActive ? 700 : 400,
                transition: "all .12s ease",
              }}
              onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; } }}
              onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-soft)"; } }}
            >
              {l.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
