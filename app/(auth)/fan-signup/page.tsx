"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

export default function FanSignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [returnUrl, setReturnUrl] = useState("/feed");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("return") || "/feed";
    setReturnUrl(p);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Enter your name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Enter a valid email."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setLoading(true);
    setErr(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name.trim(), account_type: "fan" },
        emailRedirectTo: `${window.location.origin}${returnUrl}`,
      },
    });

    if (error) { setErr(error.message); setLoading(false); return; }
    router.push(returnUrl);
  }

  const serif = "Cormorant Garamond, Georgia, serif";
  const mono = "DM Mono, monospace";

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 20px",
      background: `
        radial-gradient(ellipse 60% 40% at 50% 30%, rgba(110,231,183,0.05) 0%, transparent 70%),
        radial-gradient(ellipse 40% 30% at 80% 80%, rgba(245,200,66,0.04) 0%, transparent 60%),
        #09090C
      `,
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Brand */}
        <Link href="/" style={{ display: "block", textAlign: "center", marginBottom: 40, textDecoration: "none" }}>
          <span className="brand-logo" style={{ fontSize: 28 }}>Spot<span>light</span>ly
          </span>
        </Link>

        {done ? (
          <div style={{
            background: "#111118", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, padding: "48px 40px", textAlign: "center",
          }}>
            <p style={{ fontSize: 40, marginBottom: 20 }}>✦</p>
            <h1 style={{ fontFamily: serif, fontSize: 30, fontWeight: 300, color: "#fff", marginBottom: 12 }}>
              You&apos;re in.
            </h1>
            <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7 }}>
              Check your email to confirm your account, then come back and find your people.
            </p>
            <Link href="/login" style={{
              display: "inline-block", marginTop: 28,
              fontFamily: mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase",
              color: "#09090C", background: "#f5c842", padding: "12px 28px", borderRadius: 3,
              textDecoration: "none",
            }}>
              Sign in →
            </Link>
          </div>
        ) : (
          <div style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.08)",
            borderTop: "3px solid #6ee7b7",
            borderRadius: 6, padding: "40px",
          }}>
            <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#6ee7b7", marginBottom: 12 }}>
              Audience account
            </p>
            <h1 style={{ fontFamily: serif, fontSize: 36, fontWeight: 300, color: "#fff", marginBottom: 8, lineHeight: 1.1 }}>
              Get closer to<br /><em style={{ fontStyle: "italic", color: "#f5c842" }}>the creators you love.</em>
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, marginBottom: 32 }}>
              Subscribe directly. No algorithm deciding what you see. Just you and the people whose work you actually follow.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {err && (
                <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 4, padding: "10px 14px", fontSize: 13, color: "#f87171" }}>
                  {err}
                </div>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)" }}>Your name</span>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="What should creators call you?"
                  autoComplete="name" required
                  style={{ background: "#0E0E12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "12px 16px", color: "#e8e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#6ee7b7")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)" }}>Email</span>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email" required
                  style={{ background: "#0E0E12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "12px 16px", color: "#e8e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#6ee7b7")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)" }}>Password</span>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password" required minLength={8}
                  style={{ background: "#0E0E12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "12px 16px", color: "#e8e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#6ee7b7")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </label>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginTop: 4 }}>
                <input type="checkbox" required style={{ marginTop: 3, flexShrink: 0, accentColor: "#6ee7b7", width: 16, height: 16 }} />
                <span style={{ fontSize: 12, color: "rgba(232,232,240,0.45)", lineHeight: 1.6 }}>
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" style={{ color: "#f5c842" }}>Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" target="_blank" style={{ color: "#f5c842" }}>Privacy Policy</Link>.
                  I am 18 or older.
                </span>
              </label>

              <button
                type="submit" disabled={loading}
                style={{
                  background: loading ? "rgba(110,231,183,0.3)" : "#6ee7b7",
                  color: "#09090C", border: "none", borderRadius: 4,
                  padding: "14px", fontFamily: mono, fontSize: 11,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  fontWeight: 600, cursor: loading ? "default" : "pointer",
                  marginTop: 8,
                }}
              >
                {loading ? "Creating account…" : "Join the audience →"}
              </button>
            </form>

            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Link href="/login" style={{ fontFamily: mono, fontSize: 10, color: "#52525b", textDecoration: "none", letterSpacing: "0.1em" }}>
                Already have an account →
              </Link>
              <Link href="/signup" style={{ fontFamily: mono, fontSize: 10, color: "#f5c842", textDecoration: "none", letterSpacing: "0.1em" }}>
                Create as a creator →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
