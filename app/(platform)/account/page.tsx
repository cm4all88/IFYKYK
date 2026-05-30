"use client";
import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import "@/app/design.css";

type Pane = "profile" | "subscriptions" | "library" | "activity" | "settings";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtMoney(n: any) { return `$${parseFloat(n ?? 0).toFixed(2)}`; }

function Av({ url, name, size = 40, onClick }: { url?: string | null; name?: string; size?: number; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        background: "var(--accent-soft)", border: "2px solid var(--accent-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: onClick ? "pointer" : "default", position: "relative",
      }}
    >
      {url
        ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontFamily: "var(--font-serif)", fontSize: size * 0.42, color: "var(--accent)" }}>
            {(name ?? "?")[0].toUpperCase()}
          </span>
      }
      {onClick && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
        >
          <span style={{ fontSize: size * 0.28, color: "#fff" }}>✎</span>
        </div>
      )}
    </div>
  );
}

function CancelDialog({ sub, onCancel, onClose }: { sub: any; onCancel: () => void; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-8)", maxWidth: 420, width: "100%" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 300, color: "var(--text)", marginBottom: 12 }}>Cancel subscription?</h2>
        <p className="text-soft" style={{ fontSize: 14, lineHeight: 1.75, marginBottom: 6 }}>
          You'll lose access to <strong style={{ color: "var(--text)" }}>{sub.creator?.display_name}</strong>'s subscriber content at the end of your billing period.
        </p>
        <p className="text-faint" style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: "var(--s-8)" }}>
          Access continues until {fmt(sub.current_period_end)}
        </p>
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
          <button onClick={onCancel} style={{ flex:1, padding:"10px 16px", background:"var(--red-soft)", border:"1px solid var(--red-border)", borderRadius:"var(--r-1)", color:"var(--red)", fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" as const, cursor:"pointer" }}>Yes, cancel</button>
          <button onClick={onClose} className="btn btn--secondary" style={{ flex: 1 }}>Keep it</button>
        </div>
      </div>
    </div>
  );
}

const NAV: { key: Pane; label: string; icon: string }[] = [
  { key: "profile",       label: "My Profile",       icon: "✦" },
  { key: "subscriptions", label: "Subscriptions",     icon: "◉" },
  { key: "library",       label: "Library",           icon: "⬛" },
  { key: "activity",      label: "Activity",           icon: "◈" },
  { key: "settings",      label: "Account Settings",  icon: "⚙" },
];

export default function AudienceAccountPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [pane, setPane] = useState<Pane>("profile");

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Settings fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Cancel flow
  const [cancelSub, setCancelSub] = useState<any>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      setDisplayName(user.user_metadata?.display_name ?? "");
      setBio(user.user_metadata?.bio ?? "");
      setAvatarUrl(user.user_metadata?.avatar_url ?? null);
      setNotifPrefs(user.user_metadata?.notif_prefs ?? {});
      const res = await fetch("/api/fan/me");
      if (res.status === 401) { router.push("/login"); return; }
      setData(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const { url } = await res.json();
    if (url) {
      setAvatarUrl(url);
      await supabase.auth.updateUser({ data: { avatar_url: url } });
    }
    setUploadingAvatar(false);
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName, bio, avatar_url: avatarUrl, notif_prefs: notifPrefs },
    });
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaved("profile"); setSaving(false);
    setTimeout(() => setSaved(null), 3000);
  }

  async function handleSavePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setSaving(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setErr(error.message); setSaving(false); return; }
    setCurrentPassword(""); setNewPassword("");
    setSaved("password"); setSaving(false);
    setTimeout(() => setSaved(null), 3000);
  }

  async function handleCancel() {
    if (!cancelSub) return;
    setCancelling(cancelSub.id);
    const res = await fetch("/api/subscription/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: cancelSub.id }),
    });
    if (res.ok) {
      setData((prev: any) => ({
        ...prev,
        subscriptions: prev.subscriptions.map((s: any) =>
          s.id === cancelSub.id ? { ...s, status: "cancelling" } : s
        ),
      }));
    }
    setCancelSub(null);
    setCancelling(null);
  }

  const activeSubs = (data?.subscriptions ?? []).filter((s: any) => ["active","trialing","cancelling"].includes(s.status));
  const pastSubs   = (data?.subscriptions ?? []).filter((s: any) => !["active","trialing","cancelling"].includes(s.status));

  if (loading) return (
    <div className="db-loading">
      <span className="db-loading-dot" />
    </div>
  );

  return (
    <main className="db">
      {cancelSub && <CancelDialog sub={cancelSub} onCancel={handleCancel} onClose={() => setCancelSub(null)} />}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />

      {/* Header */}
      <header className="db-top">
        <div className="db-top-inner">
          <Link href="/" className="db-brand">
            Spot<span>light</span>ly
          </Link>
          <div className="db-top-right">
            <Link href="/feed" className="db-view-link">← Feed</Link>
            {data?.creatorProfile && (
              <Link href="/dashboard" className="db-view-link">Dashboard</Link>
            )}
            <span className="db-email">{user?.email}</span>
          </div>
        </div>
      </header>

      <div className="db-shell">
        {/* Sidebar */}
        <aside className="db-sidebar">
          {/* Fan identity strip */}
          <div style={{ padding: "var(--s-5) var(--s-4) var(--s-5)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
            <div style={{ position: "relative" }}>
              <Av url={uploadingAvatar ? null : avatarUrl} name={displayName || user?.email} size={42} onClick={() => fileRef.current?.click()} />
              {uploadingAvatar && (
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, color: "var(--accent)" }}>↑</span>
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--text)", margin: 0, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName || user?.email?.split("@")[0]}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent-open)", margin: "3px 0 0" }}>
                ✓ Verified 18+
              </p>
            </div>
          </div>

          {/* Stats strip */}
          {data?.totalSpent > 0 && (
            <div style={{ padding: "var(--s-4)", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-2)", padding: "10px 12px" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted-faint)", marginBottom: 4 }}>Supported</p>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--accent)", margin: 0 }}>{fmtMoney(data.totalSpent)}</p>
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-2)", padding: "10px 12px" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted-faint)", marginBottom: 4 }}>Following</p>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text)", margin: 0 }}>{activeSubs.length}</p>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav style={{ padding: "var(--s-3) 0" }}>
            {NAV.map(n => (
              <button key={n.key} onClick={() => setPane(n.key)} className={`db-nav-link${pane === n.key ? " db-nav-link--active" : ""}`}
                style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "var(--s-3)", padding: "10px var(--s-5)" }}>
                <span style={{ fontSize: 14, color: pane === n.key ? "var(--accent)" : "var(--muted-faint)", width: 18, textAlign: "center" }}>{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </nav>

          {!data?.creatorProfile && (
            <div style={{ margin: "var(--s-4)", padding: "var(--s-4)", background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: "var(--r-2)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>Create &amp; earn</p>
              <p className="text-faint" style={{ fontSize: 12, lineHeight: 1.65, marginBottom: 12 }}>Set up a creator account and monetize your audience. 30-day free trial.</p>
              <Link href="/signup" className="btn btn--primary" style={{ display: "block", textAlign: "center", fontSize: 10 }}>
                Become a creator →
              </Link>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="db-main">

          {/* ── PROFILE ── */}
          {pane === "profile" && (
            <form onSubmit={handleSaveProfile}>
              <div className="pane-head">
                <p className="kicker">My Profile</p>
                <h2 className="pane-title">How creators <em>see you.</em></h2>
                <p className="text-soft" style={{ fontSize: 14 }}>Your name, photo, and bio are visible to creators when you message or tip them.</p>
              </div>

              {saved === "profile" && <div style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:"var(--r-1)", padding:"12px 16px", color:"var(--accent-open)", fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.12em", marginBottom:"var(--s-4)" }}>✓ Profile saved</div>}
              {err && <div style={{ background:"var(--red-soft)", border:"1px solid var(--red-border)", borderRadius:"var(--r-1)", padding:"12px 16px", color:"var(--red)", fontSize:13, marginBottom:"var(--s-4)" }}>{err}</div>}

              {/* Avatar upload */}
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", marginBottom: "var(--s-4)" }}>
                <p className="label">Profile photo</p>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--s-5)", marginTop: "var(--s-3)" }}>
                  <Av url={uploadingAvatar ? null : avatarUrl} name={displayName || user?.email} size={80} onClick={() => fileRef.current?.click()} />
                  <div>
                    <button type="button" onClick={() => fileRef.current?.click()} className="btn btn--secondary" style={{ marginBottom: 8 }}>
                      {uploadingAvatar ? "Uploading…" : "Upload photo"}
                    </button>
                    <p className="text-faint" style={{ fontSize: 12 }}>JPG or PNG. Click your avatar to change it.</p>
                  </div>
                </div>
              </div>

              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", marginBottom: "var(--s-4)", display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
                <div className="form-field" style={{ gap:"var(--s-2)" }}>
                  <p className="label">Display name</p>
                  <input className="input" type="text" value={displayName}
                    onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
                </div>

                <div className="form-field" style={{ gap:"var(--s-2)" }}>
                  <p className="label">Bio <span className="text-faint">(optional)</span></p>
                  <textarea className="input" value={bio} onChange={e => setBio(e.target.value)}
                    placeholder="A bit about yourself — creators see this when you message or tip them."
                    rows={3} style={{ resize:"vertical" }} />
                </div>

                <div className="form-field" style={{ gap:"var(--s-2)" }}>
                  <p className="label">Email</p>
                  <input className="input" type="email" value={user?.email ?? ""} disabled style={{ opacity:0.45, cursor:"not-allowed" }} />
                  <p style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted-faint)", letterSpacing:"0.05em", marginTop:4 }}>To change your email contact support@spotlightly.app</p>
                </div>
              </div>

              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </button>
            </form>
          )}

          {/* ── SUBSCRIPTIONS ── */}
          {pane === "subscriptions" && (
            <div>
              <div className="pane-head">
                <p className="kicker">Subscriptions</p>
                <h2 className="pane-title">Your <em>lineup.</em></h2>
              </div>

              {activeSubs.length === 0 && pastSubs.length === 0 ? (
                <div style={{ textAlign:"center", padding:"72px 0" }}>
                  <p style={{ fontSize:48, marginBottom:16, opacity:0.2 }}>✦</p>
                  <p style={{ fontFamily:"var(--font-serif)", fontSize:26, fontWeight:300, color:"var(--text-faint)", marginBottom:8 }}>No subscriptions yet.</p>
                  <p style={{ fontSize:14, color:"var(--muted-faint)" }}>Subscribe to a creator and they'll show up here.</p>
                  <Link href="/explore" className="btn btn--primary" style={{ marginTop: "var(--s-5)" }}>Find creators →</Link>
                </div>
              ) : null}

              {activeSubs.length > 0 && (
                <div style={{ marginBottom: "var(--s-8)" }}>
                  <p className="kicker" style={{ marginBottom: "var(--s-3)" }}>Active</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {activeSubs.map((s: any) => {
                      const isCancelling = s.status === "cancelling";
                      return (
                        <div key={s.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", display: "flex", alignItems: "center", gap: "var(--s-4)", padding: "var(--s-4) var(--s-5)", borderColor: isCancelling ? "var(--red-border)" : "var(--border)" }}>
                          <Av url={s.creator?.avatar_url} name={s.creator?.display_name} size={48} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Link href={`/${s.creator?.handle}`} style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)", textDecoration: "none", display: "block", marginBottom: 4 }}>
                              {s.creator?.display_name ?? s.creator?.handle}
                            </Link>
                            <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center", flexWrap: "wrap" as const }}>
                              <span className="text-faint" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{fmtMoney(s.price)}/mo</span>
                              <span className="text-faint" style={{ fontSize: 10 }}>·</span>
                              {isCancelling
                                ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--red)" }}>Access until {fmt(s.current_period_end)}</span>
                                : <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted-faint)" }}>Renews {s.current_period_end ? fmt(s.current_period_end) : "—"}</span>
                              }
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", flexShrink: 0 }}>
                            <span className={`badge ${isCancelling ? "badge--red" : s.status === "trialing" ? "badge--green" : "badge--green"}`}>
                              {s.status === "trialing" ? "Trial" : isCancelling ? "Cancelling" : "Active"}
                            </span>
                            <Link href={`/${s.creator?.handle}`} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 11 }}>Visit</Link>
                            {!isCancelling && (
                              <button onClick={() => setCancelSub(s)} disabled={cancelling === s.id}
                                style={{ padding:"6px 12px", background:"none", border:"1px solid var(--red-border)", borderRadius:"var(--r-1)", color:"var(--red)", fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:"0.08em", cursor:"pointer" }}>
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pastSubs.length > 0 && (
                <div>
                  <p className="kicker" style={{ marginBottom: "var(--s-3)" }}>Past subscriptions</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {pastSubs.map((s: any) => (
                      <div key={s.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", display: "flex", alignItems: "center", gap: "var(--s-4)", padding: "var(--s-3) var(--s-5)", opacity: 0.6 }}>
                        <Av url={s.creator?.avatar_url} name={s.creator?.display_name} size={36} />
                        <div style={{ flex: 1 }}>
                          <Link href={`/${s.creator?.handle}`} style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--text-soft)", textDecoration: "none" }}>
                            {s.creator?.display_name ?? s.creator?.handle}
                          </Link>
                          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted-faint)", margin: "3px 0 0" }}>
                            {fmtMoney(s.price)}/mo · ended {fmt(s.canceled_at ?? s.current_period_end ?? s.created_at)}
                          </p>
                        </div>
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--muted-faint)", background:"var(--surface-2)", border:"1px solid var(--border)", padding:"3px 8px", borderRadius:"var(--r-1)" }}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LIBRARY ── */}
          {pane === "library" && (
            <div>
              <div className="pane-head">
                <p className="kicker">Library</p>
                <h2 className="pane-title">Everything you've <em>purchased.</em></h2>
                <p className="text-soft" style={{ fontSize: 14 }}>Download your purchases anytime — they don't expire.</p>
              </div>

              {(!data?.purchases || data.purchases.length === 0) ? (
                <div style={{ textAlign:"center", padding:"72px 0" }}>
                  <p style={{ fontSize:48, marginBottom:16, opacity:0.2 }}>📦</p>
                  <p style={{ fontFamily:"var(--font-serif)", fontSize:26, fontWeight:300, color:"var(--text-faint)", marginBottom:8 }}>Your library is empty.</p>
                  <p style={{ fontSize:14, color:"var(--muted-faint)" }}>Digital products and unlocked posts live here.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {data.purchases.map((p: any) => {
                    const isDigital = p.type === "digital";
                    const title = isDigital ? (p.product?.title ?? "Digital product") : (p.post?.title || p.post?.caption?.slice(0, 60) + "…" || "Unlocked post");
                    const creator = isDigital ? p.product?.creator : p.post?.creator;
                    return (
                      <div key={p.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", display: "flex", alignItems: "center", gap: "var(--s-4)", padding: "var(--s-4) var(--s-5)" }}>
                        <div style={{ width: 44, height: 44, borderRadius: "var(--r-2)", background: isDigital ? "rgba(52,211,153,0.08)" : "var(--accent-soft)", border: `1px solid ${isDigital ? "rgba(52,211,153,0.2)" : "var(--accent-border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                          {isDigital ? "📦" : "🔓"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", margin: 0, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{title}</p>
                          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted-faint)", margin: 0 }}>
                            {creator?.display_name ?? creator?.handle} · {fmt(p.created_at)} · {fmtMoney(p.amount_paid)}
                          </p>
                        </div>
                        {isDigital && p.download_token
                          ? <a href={`/api/digital/download?token=${p.download_token}`} className="btn btn--secondary" style={{ flexShrink: 0, fontSize: 11 }}>Download →</a>
                          : creator?.handle && <Link href={`/${creator.handle}`} className="btn btn--ghost" style={{ flexShrink: 0, fontSize: 11 }}>View →</Link>
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ACTIVITY ── */}
          {pane === "activity" && (
            <div>
              <div className="pane-head">
                <p className="kicker">Activity</p>
                <h2 className="pane-title">Your <em>support history.</em></h2>
              </div>

              {(!data?.tips || data.tips.length === 0) ? (
                <div style={{ textAlign:"center", padding:"72px 0" }}>
                  <p style={{ fontSize:48, marginBottom:16, opacity:0.2 }}>💛</p>
                  <p style={{ fontFamily:"var(--font-serif)", fontSize:26, fontWeight:300, color:"var(--text-faint)", marginBottom:8 }}>No tips sent yet.</p>
                  <p style={{ fontSize:14, color:"var(--muted-faint)" }}>When you tip a creator it shows up here.</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--s-4)" }}>
                    <p className="kicker">{data.tips.length} tip{data.tips.length !== 1 ? "s" : ""} sent</p>
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--accent)", margin: 0 }}>{fmtMoney(data.totalTipped)} total</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {data.tips.map((t: any) => (
                      <div key={t.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", display: "flex", alignItems: "center", gap: "var(--s-4)", padding: "var(--s-4) var(--s-5)" }}>
                        <Av url={t.creator?.avatar_url} name={t.creator?.display_name} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/${t.creator?.handle}`} style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text)", textDecoration: "none" }}>
                            {t.creator?.display_name ?? t.creator?.handle}
                          </Link>
                          {t.message && <p className="text-faint" style={{ fontSize: 13, margin: "4px 0 0", fontStyle: "italic" }}>"{t.message}"</p>}
                          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted-faint)", margin: "4px 0 0" }}>
                            {t.type === "super_tip" && <span style={{ color: "var(--accent)" }}>Super Tip · </span>}
                            {fmt(t.created_at)}
                          </p>
                        </div>
                        <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--accent)", margin: 0, flexShrink: 0 }}>{fmtMoney(t.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {pane === "settings" && (
            <div>
              <div className="pane-head">
                <p className="kicker">Account Settings</p>
                <h2 className="pane-title">Password &amp; <em>notifications.</em></h2>
              </div>

              {/* Password */}
              <form onSubmit={handleSavePassword}>
                <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", marginBottom: "var(--s-4)", display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
                  <p className="kicker">Change password</p>
                  {saved === "password" && <div style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:"var(--r-1)", padding:"12px 16px", color:"var(--accent-open)", fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.12em", marginBottom:"var(--s-4)" }}>✓ Password updated</div>}
                  {err && <div style={{ background:"var(--red-soft)", border:"1px solid var(--red-border)", borderRadius:"var(--r-1)", padding:"12px 16px", color:"var(--red)", fontSize:13, marginBottom:"var(--s-4)" }}>{err}</div>}

                  <div className="form-field" style={{ gap:"var(--s-2)" }}>
                    <p className="label">New password</p>
                    <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
                    {newPassword.length > 0 && newPassword.length < 8 && <p style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--red)", marginTop:4 }}>Must be at least 8 characters</p>}
                  </div>
                </div>
                <button type="submit" className="btn btn--primary" disabled={saving || newPassword.length < 8} style={{ marginBottom: "var(--s-8)" }}>
                  {saving ? "Updating…" : "Update password"}
                </button>
              </form>

              {/* Notification prefs */}
              {activeSubs.length > 0 && (
                <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", marginBottom: "var(--s-4)" }}>
                  <p className="kicker" style={{ marginBottom: "var(--s-5)" }}>Email notifications</p>
                  <p className="text-faint" style={{ fontSize: 13, marginBottom: "var(--s-5)" }}>Get emailed when creators you follow post new content or go live.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
                    {activeSubs.map((s: any) => {
                      const key = s.creator?.handle;
                      const on = notifPrefs[key] !== false;
                      return (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
                            <Av url={s.creator?.avatar_url} name={s.creator?.display_name} size={32} />
                            <span style={{ fontSize: 14, color: "var(--text-soft)" }}>{s.creator?.display_name}</span>
                          </div>
                          <button type="button" onClick={() => {
                            const updated = { ...notifPrefs, [key]: !on };
                            setNotifPrefs(updated);
                            supabase.auth.updateUser({ data: { notif_prefs: updated } });
                          }} style={{
                            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                            background: on ? "var(--accent)" : "var(--surface-3)", transition: "background 0.2s", position: "relative",
                          }}>
                            <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: on ? "#17181B" : "var(--muted-faint)", transition: "left 0.2s" }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sign out */}
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 14, color: "var(--text-soft)", margin: 0 }}>Need help?</p>
                  <a href="mailto:support@spotlightly.app" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>support@spotlightly.app</a>
                </div>
                <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}
                  className="btn btn--ghost" style={{ color: "var(--muted-faint)" }}>
                  Sign out
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
