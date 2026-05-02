import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spotlightly — Your work. Your moment. Your money.",
  description:
    "The creator platform that keeps 0% of your earnings. Flat monthly fee. You own your audience, your content, and every dollar.",
};

export default function HomePage() {
  return (
    <main>
      {/* 
        ── HERO ────────────────────────────────────────────────
        Import and use your React components here.
        The full UI is in /mnt/user-data/outputs/spotlightly-homepage.jsx
        Convert to proper TSX components and drop them in.
        ────────────────────────────────────────────────────────
      */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 32px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 720 }}>
          <h1
            style={{
              fontSize: "clamp(40px, 6vw, 80px)",
              fontWeight: 900,
              letterSpacing: "-0.045em",
              lineHeight: 1.02,
              color: "var(--text)",
              marginBottom: 24,
            }}
          >
            Your work.
            <br />
            Your moment.
            <br />
            <span style={{ color: "var(--amber)" }}>Your money.</span>
          </h1>
          <p
            style={{
              fontSize: 20,
              color: "var(--text-sec)",
              lineHeight: 1.65,
              marginBottom: 40,
              maxWidth: 560,
              margin: "0 auto 40px",
            }}
          >
            The only creator platform that takes 0% of your earnings. Flat
            monthly fee. You keep every dollar your subscribers pay you.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/signup"
              style={{
                background: "var(--amber)",
                color: "#fff",
                padding: "16px 36px",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 4px 20px rgba(212,104,10,0.4)",
              }}
            >
              Start for $29/mo →
            </a>
            <a
              href="/how-it-works"
              style={{
                background: "var(--surface)",
                color: "var(--text)",
                padding: "16px 32px",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 500,
                textDecoration: "none",
                border: "1px solid var(--border)",
              }}
            >
              See how it works
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
