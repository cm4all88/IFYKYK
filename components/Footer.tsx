import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link href="/" className="site-footer-brand">
          Spot<span>light</span>ly
        </Link>
        <nav className="site-footer-nav">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/dmca">DMCA</Link>
          <a href="mailto:support@spotlightly.app">Support</a>
        </nav>
        <p className="site-footer-copy">
          © {new Date().getFullYear()} Tahoma Systems LLC · All rights reserved
        </p>
      </div>

      <style>{`
        .site-footer {
          border-top: 1px solid var(--border);
          padding: var(--s-8) var(--s-6);
          background: var(--bg);
        }
        .site-footer-inner {
          max-width: var(--container-wide);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--s-4);
        }
        .site-footer-brand {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
          font-weight: 300;
          color: var(--text-soft);
          letter-spacing: -0.01em;
        }
        .site-footer-brand span { color: var(--accent); }
        .site-footer-nav {
          display: flex;
          gap: var(--s-6);
        }
        .site-footer-nav a {
          font-family: var(--font-display);
          font-weight: 500;
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--muted);
          transition: color var(--t-fast);
        }
        .site-footer-nav a:hover { color: var(--text); }
        .site-footer-copy {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--muted-faint);
          margin: 0;
        }
        @media (max-width: 600px) {
          .site-footer-inner { flex-direction: column; align-items: flex-start; gap: var(--s-3); }
        }
      `}</style>
    </footer>
  );
}
