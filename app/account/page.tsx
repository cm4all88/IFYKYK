"use client";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      setEmail(user.email ?? "");
      setDisplayName(user.user_metadata?.display_name ?? "");

      // Check if they have a creator profile
      const { data: profile } = await (supabase as any)
        .from("creator_profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("kind", "spotlight")
        .maybeSingle();
      setIsCreator(!!profile);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const updates: any = { data: { display_name: displayName } };
    if (newPassword.length >= 8) updates.password = newPassword;

    const { error } = await supabase.auth.updateUser(updates);
    if (error) { setErr(error.message); setSaving(false); return; }

    setSaved(true);
    setNewPassword("");
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const mono = "DM Mono, monospace";
  const serif = "Cormorant Garamond, Georgia, serif";
  const bg = "#09090C";
  const surface = "#111118";
  const border = "rgba(255,255,255,0.08)";
  const muted = "#71717a";
  const accent = "#F0B429";

  if (loading) return (
    <div style={{ background: bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: muted, fontFamily: mono, fontSize: 11, letterSpacing: "0.15em" }}>Loading…</p>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: "100vh", color: "#e8e8f0" }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${border}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: bg, zIndex: 10 }}>
        <Link href="/" style={{ fontFamily: serif, fontSize: 22, color: "#fff", textDecoration: "none" }}>
          Spot<span style={{ color: accent }}>light</span>ly
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/feed" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, textDecoration: "none" }}>← Feed</Link>
          {isCreator && (
            <Link href="/dashboard" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, textDecoration: "none" }}>Dashboard</Link>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: muted, marginBottom: 12 }}>Account</p>
        <h1 style={{ fontFamily: serif, fontSize: 36, fontWeight: 300, color: "#fff", marginBottom: 40, lineHeight: 1.1 }}>
          Your <em style={{ fontStyle: "italic", color: accent }}>settings.</em>
        </h1>

        {/* Become a creator CTA — for fans only */}
        {!isCreator && (
          <div style={{ background: "rgba(240,180,41,0.06)", border: "1px solid rgba(240,180,41,0.2)", borderLeft: `3px solid ${accent}`, borderRadius: 6, padding: "24px 28px", marginBottom: 28 }}>
            <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>Want to earn from your audience?</p>
            <p style={{ fontSize: 14, color: "rgba(232,232,240,0.7)", lineHeight: 1.7, marginBottom: 16 }}>
              You're currently an audience member. Set up a creator account to start monetizing — subscriptions, tips, marketplace, live streams, and more. 30-day free trial, no card required.
            </p>
            <Link href="/signup" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#09090C", background: accent, padding: "12px 24px", borderRadius: 3, textDecoration: "none", display: "inline-block" }}>
              Become a creator →
            </Link>
          </div>
        )}

        {/* Profile settings */}
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {err && (
            <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 4, padding: "12px 16px", color: "#f87171", fontSize: 13 }}>
              {err}
            </div>
          )}
          {saved && (
            <div style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 4, padding: "12px 16px", color: "#34d399", fontSize: 13, fontFamily: mono, letterSpacing: "0.08em" }}>
              ✓ Saved
            </div>
          )}

          {/* Display name */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: "22px 24px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: muted }}>Display name</span>
              <input
                type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 4, padding: "11px 14px", color: "#fff", fontSize: 15, outline: "none", fontFamily: "inherit" }}
                onFocus={e => (e.currentTarget.style.borderColor = accent)}
                onBlur={e => (e.currentTarget.style.borderColor = border)}
              />
            </label>
          </div>

          {/* Email */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: "22px 24px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: muted }}>Email</span>
              <input
                type="email" value={email} disabled
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: 4, padding: "11px 14px", color: muted, fontSize: 15, outline: "none", fontFamily: "inherit", cursor: "not-allowed" }}
              />
              <span style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>Email cannot be changed here — contact support@spotlightly.app</span>
            </label>
          </div>

          {/* Password */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: "22px 24px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: muted }}>New password</span>
              <input
                type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 4, padding: "11px 14px", color: "#fff", fontSize: 15, outline: "none", fontFamily: "inherit" }}
                onFocus={e => (e.currentTarget.style.borderColor = accent)}
                onBlur={e => (e.currentTarget.style.borderColor = border)}
              />
              {newPassword.length > 0 && newPassword.length < 8 && (
                <span style={{ fontFamily: mono, fontSize: 9, color: "#f87171", letterSpacing: "0.08em" }}>Must be at least 8 characters</span>
              )}
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{ padding: "14px", background: saving ? "rgba(240,180,41,0.4)" : accent, color: "#09090C", border: "none", borderRadius: 4, fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", cursor: saving ? "default" : "pointer" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        {/* Subscriptions section */}
        <div style={{ marginTop: 36, background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: "22px 24px" }}>
          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: muted, marginBottom: 14 }}>Your subscriptions</p>
          <p style={{ fontSize: 14, color: "rgba(232,232,240,0.5)", lineHeight: 1.7 }}>
            To manage or cancel a subscription, contact the creator directly or email <a href="mailto:support@spotlightly.app" style={{ color: accent, textDecoration: "none" }}>support@spotlightly.app</a>
          </p>
        </div>

        {/* Sign out */}
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleSignOut}
            style={{ background: "none", border: "none", fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3f3f46", cursor: "pointer", padding: "8px 0" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
