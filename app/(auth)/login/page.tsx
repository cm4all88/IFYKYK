"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErr(error.message);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="lg">
      <div className="lg-shell">
        <Link href="/" className="lg-brand">
          Spot<span>light</span>ly
        </Link>

        <div className="lg-card">
          <p className="kicker">Sign in</p>
          <h1 className="lg-title">
            Welcome <em>back.</em>
          </h1>

          <form className="lg-form" onSubmit={onSubmit}>
            <div className="lg-field">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </div>

            <div className="lg-field">
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {err && <div className="lg-err">⚠ {err}</div>}

            <button type="submit" className="btn btn--primary lg-submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in →"}
            </button>
          </form>

          <p className="lg-footer">
            New here?{" "}
            <Link href="/signup" className="lg-link">
              Become a creator
            </Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .lg {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--s-6);
          background:
            radial-gradient(ellipse 60% 40% at 50% 30%, rgba(245, 200, 66, 0.05) 0%, transparent 70%),
            var(--bg);
        }
        .lg-shell {
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--s-8);
        }
        .lg-brand {
          font-family: var(--font-serif);
          font-size: 28px;
          color: var(--text);
        }
        .lg-brand span { color: var(--accent); }

        .lg-card {
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-3);
          padding: var(--s-10);
        }
        .lg-title {
          font-family: var(--font-serif);
          font-size: 36px;
          font-weight: 300;
          line-height: 1.1;
          color: #fff;
          margin: var(--s-3) 0 var(--s-8);
        }
        .lg-title em { font-style: italic; color: var(--accent); }

        .lg-form { display: flex; flex-direction: column; gap: var(--s-4); }
        .lg-field { display: flex; flex-direction: column; }

        .lg-err {
          background: var(--red-soft);
          border: 1px solid var(--red-border);
          color: var(--red);
          padding: var(--s-3) var(--s-4);
          border-radius: var(--r-2);
          font-size: 13px;
        }

        .lg-submit {
          margin-top: var(--s-3);
          padding: 16px 24px;
        }

        .lg-footer {
          margin-top: var(--s-8);
          font-size: 13px;
          color: var(--muted);
          text-align: center;
        }
        .lg-link {
          color: var(--accent);
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        @media (max-width: 500px) {
          .lg-card { padding: var(--s-6); }
          .lg-title { font-size: 30px; }
        }
      `}</style>
    </main>
  );
}
