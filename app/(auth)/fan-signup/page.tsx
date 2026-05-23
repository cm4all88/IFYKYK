"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

export default function FanSignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [returnUrl, setReturnUrl] = useState("/");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("return") || "/";
    setReturnUrl(p);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setLoading(true);
    setErr(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${returnUrl}` },
    });

    if (error) { setErr(error.message); setLoading(false); return; }
    setDone(true);
  }

  return (
    <main style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", background:"radial-gradient(ellipse 60% 40% at 50% 30%, rgba(245,200,66,0.05) 0%, transparent 70%), var(--bg)" }}>
      <div style={{ width:"100%", maxWidth:440, display:"flex", flexDirection:"column", alignItems:"center", gap:"var(--s-8)" }}>
        <Link href="/" style={{ fontFamily:"var(--font-serif)", fontSize:28, color:"var(--text)", textDecoration:"none" }}>
          Spot<span style={{ color:"var(--accent)" }}>light</span>ly
        </Link>

        <div style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-10)" }}>
          {done ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:16 }}>📬</div>
              <h1 style={{ fontFamily:"var(--font-serif)", fontSize:28, fontWeight:300, color:"#fff", marginBottom:12, lineHeight:1.1 }}>Check your email.</h1>
              <p style={{ fontSize:14, color:"rgba(242,242,240,0.55)", lineHeight:1.75 }}>
                We sent a confirmation link to <strong style={{ color:"#fff" }}>{email}</strong>. Click it to activate your account and you&apos;re in.
              </p>
            </div>
          ) : (
            <>
              <p className="kicker">Fan account</p>
              <h1 style={{ fontFamily:"var(--font-serif)", fontSize:32, fontWeight:300, lineHeight:1.1, color:"#fff", margin:"var(--s-3) 0 var(--s-8)" }}>
                Join <em style={{ fontStyle:"italic", color:"var(--accent)" }}>Spotlightly.</em>
              </h1>

              <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"var(--s-4)" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-2)" }}>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required autoFocus />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-2)" }}>
                  <label className="label">Password</label>
                  <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
                  <p style={{ fontSize:11, color:"var(--muted)" }}>At least 8 characters</p>
                </div>

                {err && <div style={{ background:"var(--red-soft)", border:"1px solid var(--red-border)", color:"var(--red)", padding:"var(--s-3) var(--s-4)", borderRadius:"var(--r-2)", fontSize:13 }}>⚠ {err}</div>}

                <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer" }}>
                  <input type="checkbox" required style={{ marginTop:3, flexShrink:0, accentColor:"var(--accent)", width:16, height:16 }} />
                  <span style={{ fontSize:12, color:"var(--muted)", lineHeight:1.6 }}>
                    I am 18 or older and agree to the{" "}
                    <Link href="/terms" target="_blank" style={{ color:"var(--accent)" }}>Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="/privacy" target="_blank" style={{ color:"var(--accent)" }}>Privacy Policy</Link>.
                  </span>
                </label>

                <button type="submit" className="btn btn--primary" disabled={loading} style={{ marginTop:"var(--s-3)", padding:"16px 24px" }}>
                  {loading ? "Creating account…" : "Create account →"}
                </button>
              </form>

              <p style={{ marginTop:"var(--s-6)", fontSize:13, color:"var(--muted)", textAlign:"center" }}>
                Already have an account?{" "}
                <Link href={`/login${returnUrl !== "/" ? `?return=${encodeURIComponent(returnUrl)}` : ""}`} style={{ color:"var(--accent)", fontFamily:"var(--font-mono)", fontSize:12, letterSpacing:".1em", textTransform:"uppercase" }}>
                  Sign in
                </Link>
              </p>
              <p style={{ marginTop:"var(--s-3)", fontSize:12, color:"rgba(255,255,255,0.2)", textAlign:"center" }}>
                Want to be a creator?{" "}
                <Link href="/signup" style={{ color:"rgba(240,180,41,0.5)" }}>Sign up as a creator →</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
