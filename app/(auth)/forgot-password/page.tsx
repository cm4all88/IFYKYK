"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setErr(error.message); setLoading(false); return; }
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="lg">
      <div className="lg-shell">
        <Link href="/" className="lg-brand">Spot<span>light</span>ly</Link>
        <div className="lg-card">
          <p className="kicker">Account recovery</p>
          {sent ? (
            <>
              <h1 className="lg-title">Check your <em>inbox.</em></h1>
              <p style={{ fontSize: 14, color: "var(--text-soft)", lineHeight: 1.75, marginTop: 8 }}>
                We sent a password reset link to <strong style={{ color: "var(--text)" }}>{email}</strong>.
                Check your spam folder if it doesn't arrive within a few minutes.
              </p>
              <div className="lg-footer" style={{ marginTop: 24 }}>
                <Link href="/login" className="lg-link">Back to sign in</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="lg-title">Reset your <em>password.</em></h1>
              <form className="lg-form" onSubmit={handleSubmit}>
                {err && <div className="lg-err">{err}</div>}
                <div className="lg-field">
                  <label className="label">Email address</label>
                  <input className="input" type="email" required autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="The email on your account" />
                </div>
                <button type="submit" className="btn btn--primary lg-submit" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <div className="lg-footer">
                <Link href="/login" className="lg-link">Back to sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
