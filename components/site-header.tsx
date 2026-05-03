import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export default async function SiteHeader({
  variant = "default",
}: {
  variant?: "default" | "marketing";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className={`sh sh--${variant}`}>
      <div className="sh-inner">
        <Link href="/" className="sh-brand">
          Spot<span>light</span>ly
        </Link>

        <nav className="sh-nav">
          {user ? (
            <>
              <Link href="/dashboard" className="sh-link">
                Dashboard
              </Link>
              <form action="/api/auth/signout" method="post">
                <button type="submit" className="sh-link sh-link-btn">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="sh-link">
                Sign in
              </Link>
              <Link href="/signup" className="sh-cta">
                Become a creator
              </Link>
            </>
          )}
        </nav>
      </div>

      <style>{`
        .sh {
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          background: rgba(10, 10, 15, 0.8);
          border-bottom: 1px solid var(--border);
        }
        .sh--marketing {
          background: transparent;
          border-bottom-color: transparent;
        }
        .sh-inner {
          max-width: var(--container-wide);
          margin: 0 auto;
          padding: var(--s-4) var(--s-6);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--s-6);
        }
        .sh-brand {
          font-family: var(--font-serif);
          font-size: 22px;
          font-weight: 300;
          color: var(--text);
          letter-spacing: -0.01em;
        }
        .sh-brand span { color: var(--accent); }

        .sh-nav {
          display: flex;
          align-items: center;
          gap: var(--s-2);
        }
        .sh-link {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--text-soft);
          padding: 10px 16px;
          background: none;
          border: none;
          transition: color var(--t-fast);
          cursor: pointer;
        }
        .sh-link:hover { color: var(--text); }
        .sh-link-btn { font: inherit; }

        .sh-cta {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--bg);
          background: var(--accent);
          padding: 10px 18px;
          border-radius: var(--r-2);
          font-weight: 500;
          transition: transform var(--t-fast) var(--ease);
        }
        .sh-cta:hover { transform: translateY(-1px); }

        @media (max-width: 600px) {
          .sh-inner { padding: var(--s-3) var(--s-4); }
          .sh-link { padding: 8px 10px; font-size: 10px; }
        }
      `}</style>
    </header>
  );
}
