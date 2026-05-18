import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import ThemeToggle from "@/components/ThemeToggle";

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
          <ThemeToggle />
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
          position: sticky; top: 0; z-index: 50;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          background: rgba(9,9,12,0.85);
          border-bottom: 1px solid var(--border);
        }
        .sh--marketing {
          background: transparent;
          border-bottom-color: transparent;
        }
        .sh-inner {
          max-width: var(--container-wide);
          margin: 0 auto;
          padding: 16px var(--s-6);
          display: flex; align-items: center; justify-content: space-between; gap: var(--s-6);
        }
        .sh-brand {
          font-family: var(--font-serif);
          font-size: 24px;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: var(--text);
        }
        .sh-brand span { color: var(--accent); }
        .sh-nav { display: flex; align-items: center; gap: var(--s-2); }
        .sh-link {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 500;
          color: var(--text-soft);
          padding: 9px 14px;
          background: none; border: none;
          transition: color var(--t-fast);
          cursor: pointer;
        }
        .sh-link:hover { color: var(--text); }
        .sh-link-btn { font: inherit; }
        .sh-cta {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          color: #0A0A0D;
          background: var(--accent);
          padding: 9px 18px;
          border-radius: var(--r-pill);
          transition: all var(--t-fast);
          box-shadow: 0 0 0 1px rgba(240,180,41,0.3) inset;
        }
        .sh-cta:hover {
          background: var(--accent-bright);
          box-shadow: 0 4px 20px rgba(240,180,41,0.35);
          transform: translateY(-1px);
        }
        @media (max-width:600px) {
          .sh-inner { padding: var(--s-3) var(--s-4); }
          .sh-link { padding: 7px 10px; font-size: 12px; }
        }
      `}</style>
    </header>
  );
}
