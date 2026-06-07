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
  const [copied, setCopied] = useState(false);
  const [returnUrl, setReturnUrl] = useState("/feed");
  const [ref, setRef] = useState<string | null>(null);
  const [myLink, setMyLink] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ verified: number; milestones: number[] } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnUrl(params.get("return") || "/feed");
    setRef(params.get("ref"));
  }, []);

  // Once signed up, pull the new account's own referral code + progress.
  // 401 (email not yet confirmed = no session) falls back to the generic link.
  useEffect(() => {
    if (!done) return;
    fetch("/api/referrals/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.code) setMyLink(`https://spotlightly.app/?ref=${d.code}`);
        if (d) setProgress({ verified: d.verified ?? 0, milestones: d.milestones ?? [] });
      })
      .catch(() => {});
  }, [done]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Enter your name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Enter a valid email."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name.trim(), account_type: "fan", referral_code: ref ?? undefined },
        emailRedirectTo: `${window.location.origin}${returnUrl}`,
      },
    });

    if (error) { setErr(error.message); setLoading(false); return; }

    if (ref && data.user?.id) {
      fetch("/api/referrals/attribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: ref, referredUserId: data.user.id, accountType: "fan" }),
      }).catch(() => {});
    }

    setLoading(false);
    setDone(true);
  }

  const inviteUrl = "https://spotlightly.app";
  const shareUrl = myLink || inviteUrl;
  const shareText =
    "I just joined Spotlightly — creators keep what they earn and you get closer to the people you actually follow. Come join me, or set up your own page:";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: "Spotlightly", text: shareText, url: shareUrl }); } catch {}
    } else {
      copyInvite();
    }
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
            borderTop: "3px solid #6ee7b7",
            borderRadius: 6, padding: "44px 40px", textAlign: "center",
          }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>✦</p>
            <h1 style={{ fontFamily: serif, fontSize: 30, fontWeight: 300, color: "#fff", marginBottom: 10, lineHeight: 1.15 }}>
              You&apos;re in.<br /><em style={{ fontStyle: "italic", color: "#f5c842" }}>Now help fill the room.</em>
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 8 }}>
              Spotlightly gets better the more people are in it. Take thirty seconds and bring two:
              a friend who&apos;d love the creators here, and someone who should have their own page.
            </p>
            <p style={{ fontSize: 13, color: "rgba(232,232,240,0.45)", lineHeight: 1.7, marginBottom: 24 }}>
              Drop your link anywhere — Instagram, TikTok, your group chat. The more people in the room, the bigger every creator&apos;s moment.
            </p>

            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#0E0E12", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 4, padding: "10px 14px", marginBottom: 16,
            }}>
              <span style={{ flex: 1, textAlign: "left", fontFamily: mono, fontSize: 12, color: "#e8e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {shareUrl.replace("https://", "")}
              </span>
              <button onClick={copyInvite} style={{
                fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                color: copied ? "#6ee7b7" : "#09090C", background: copied ? "transparent" : "#6ee7b7",
                border: copied ? "1px solid #6ee7b7" : "none",
                padding: "8px 14px", borderRadius: 3, cursor: "pointer", flexShrink: 0,
              }}>
                {copied ? "Copied ✓" : "Copy link"}
              </button>
            </div>

            {!myLink && (
              <p style={{ fontSize: 11, color: "rgba(232,232,240,0.4)", textAlign: "left", marginTop: -8, marginBottom: 16 }}>
                Confirm your email to unlock your own invite link and start earning rewards.
              </p>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#e8e8f0", background: "#0E0E12", border: "1px solid rgba(255,255,255,0.1)", padding: "11px", borderRadius: 4, textDecoration: "none" }}>
                Share on X
              </a>
              <button onClick={nativeShare}
                style={{ flex: 1, fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#e8e8f0", background: "#0E0E12", border: "1px solid rgba(255,255,255,0.1)", padding: "11px", borderRadius: 4, cursor: "pointer" }}>
                Share &hellip;
              </button>
            </div>

            {progress && (
              <div style={{ marginBottom: 22, textAlign: "left" }}>
                <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
                  Your rewards · {progress.verified} joined so far
                </p>
                {[
                  { n: 1, label: "12 medals" },
                  { n: 3, label: "30 medals + Founding Audience badge" },
                  { n: 5, label: "30 medals + a month of Early Access" },
                  { n: 10, label: "Free Spotlight shirt" },
                ].map((rung) => {
                  const earned = progress.milestones.includes(rung.n);
                  return (
                    <div key={rung.n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", opacity: earned ? 1 : 0.5 }}>
                      <span style={{ fontFamily: mono, fontSize: 11, color: earned ? "#6ee7b7" : "var(--muted)", width: 18, flexShrink: 0 }}>
                        {earned ? "✓" : rung.n}
                      </span>
                      <span style={{ fontSize: 12.5, color: earned ? "#e8e8f0" : "rgba(232,232,240,0.6)" }}>
                        {rung.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => router.push(returnUrl)} style={{
              width: "100%",
              fontFamily: mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase",
              color: "#09090C", background: "#f5c842", padding: "13px", borderRadius: 4,
              border: "none", cursor: "pointer", fontWeight: 600,
            }}>
              Continue to your feed →
            </button>
            <p style={{ fontSize: 11, color: "rgba(232,232,240,0.4)", marginTop: 14 }}>
              Check your email to confirm your account.
            </p>
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
