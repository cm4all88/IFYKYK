"use client";

type NavLink = { id: string; label: string };

export default function CreatorRailNav({
  isSubscribed,
  tierName,
  price,
  canUpgrade,
  links,
}: {
  isSubscribed: boolean;
  tierName: string | null;
  price: number | null;
  canUpgrade: boolean;
  links: NavLink[];
}) {
  function jump(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
      {/* subscription status */}
      <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
          Your access
        </span>
        {isSubscribed ? (
          <>
            <p style={{ fontFamily: "var(--font-serif, serif)", fontSize: 22, color: "var(--text)", margin: "6px 0 0", lineHeight: 1.1 }}>
              {tierName || "Subscribed"}
            </p>
            {canUpgrade && (
              <button
                onClick={() => jump("sec-support")}
                style={{
                  marginTop: 12, width: "100%", padding: "10px 0", border: "1px solid var(--accent)",
                  background: "var(--accent-soft, rgba(242,184,75,0.08))", color: "var(--accent)",
                  fontFamily: "var(--font-display, sans-serif)", fontWeight: 700, fontSize: 13, borderRadius: 9, cursor: "pointer",
                }}
              >
                Upgrade tier ↑
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "var(--text-soft)", margin: "6px 0 0", lineHeight: 1.4 }}>
              {price ? <>Subscribe from <strong style={{ color: "var(--text)" }}>${price.toFixed(2)}/mo</strong></> : "Not subscribed yet"}
            </p>
            <button
              onClick={() => jump("sec-support")}
              style={{
                marginTop: 12, width: "100%", padding: "11px 0", border: "none",
                background: "linear-gradient(180deg, #F5C55A, #F2B84B)", color: "#09090C",
                fontFamily: "var(--font-display, sans-serif)", fontWeight: 800, fontSize: 14, borderRadius: 9, cursor: "pointer",
                boxShadow: "0 8px 22px rgba(242,184,75,0.22)",
              }}
            >
              Subscribe
            </button>
          </>
        )}
      </div>

      {/* section navigation */}
      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
        On this page
      </span>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => jump(l.id)}
            style={{
              textAlign: "left", background: "transparent", border: "none", cursor: "pointer",
              padding: "8px 8px", borderRadius: 7, color: "var(--text-soft)", fontSize: 14,
              fontFamily: "var(--font-display, sans-serif)", transition: "all .12s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-soft)"; }}
          >
            {l.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
