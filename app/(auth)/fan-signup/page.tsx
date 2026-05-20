"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

export default function FanSignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [returnUrl, setReturnUrl] = useState("/");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("return") || "/";
    setReturnUrl(p);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { setErr("Phone number is required."); return; }
    setLoading(true);
    setErr(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "fan", phone: phone.trim() },
      },
    });

    if (error) { setErr(error.message); setLoading(false); return; }
    router.push(returnUrl);
    router.refresh();
  }

  return (
    <div className="lg">
      <div className="lg-shell">
        <Link href="/" className="lg-brand">Spot<span>light</span>ly</Link>
        <div className="lg-card">
          <p className="kicker">Join as a fan</p>
          <h1 className="lg-title">Get closer to your <em>favourites.</em></h1>

          <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.65, marginBottom:"var(--s-6)" }}>
            Creators on Spotlightly verify who their fans are. Your email and phone number
            confirm your identity and let creators maintain a safe, accountable community.
          </p>

          <form className="lg-form" onSubmit={handleSubmit}>
            {err && <div className="lg-err">{err}</div>}

            <div className="lg-field">
              <label className="label">Email</label>
              <input className="input" type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" />
            </div>

            <div className="lg-field">
              <label className="label">Phone number</label>
              <input className="input" type="tel" required autoComplete="tel"
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000" />
              <p style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>
                Required. Creators can see verified fan contact information.
              </p>
            </div>

            <div className="lg-field">
              <label className="label">Password</label>
              <input className="input" type="password" required autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters" minLength={8} />
            </div>

            <button type="submit" className="btn btn--primary lg-submit" disabled={loading}>
              {loading ? "Creating account…" : "Create account →"}
            </button>
          </form>

          <div className="lg-footer">
            Already have an account?{" "}
            <Link href={`/login?return=${encodeURIComponent(returnUrl)}`} className="lg-link">Sign in</Link>
            <br />
            <span style={{ marginTop:8, display:"block", fontSize:12, color:"var(--muted-faint)" }}>
              Want to create content?{" "}
              <Link href="/signup" className="lg-link">Become a creator</Link>
            </span>
          </div>
        </div>

        <p style={{ fontSize:12, color:"var(--muted-faint)", textAlign:"center", maxWidth:340 }}>
          By joining, you agree to our{" "}
          <Link href="/terms" style={{ color:"var(--accent)" }}>Terms of Service</Link> and{" "}
          <Link href="/privacy" style={{ color:"var(--accent)" }}>Privacy Policy</Link>.
          Your contact information is shared with creators whose content you access.
        </p>
      </div>
    </div>
  );
}
