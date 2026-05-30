"use client";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

type Tab = "subscriptions" | "library" | "activity" | "settings";

// ─── helpers ──────────────────────────────────────────────────────
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtMoney(n: any) {
  return `$${parseFloat(n ?? 0).toFixed(2)}`;
}

// ─── Avatar ───────────────────────────────────────────────────────
function Av({ url, name, size = 40 }: { url?: string | null; name?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      background: "rgba(240,180,41,0.12)", border: "1px solid rgba(240,180,41,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {url
        ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontFamily: "Cormorant Garamond,serif", fontSize: size * 0.42, color: "#F0B429" }}>
            {(name ?? "?")[0].toUpperCase()}
          </span>
      }
    </div>
  );
}

// ─── Cancel confirmation dialog ───────────────────────────────────
function CancelDialog({ sub, onCancel, onClose }: { sub: any; onCancel: () => void; onClose: () => void }) {
  const mono = "DM Mono,monospace";
  const serif = "Cormorant Garamond,serif";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "36px", maxWidth: 400, width: "100%" }}>
        <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 300, color: "#fff", marginBottom: 12 }}>Cancel subscription?</h2>
        <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.75, marginBottom: 8 }}>
          You'll lose access to <strong style={{ color: "#fff" }}>{sub.creator?.display_name}</strong>'s subscriber content at the end of your current billing period.
        </p>
        <p style={{ fontFamily: mono, fontSize: 11, color: "#52525b", marginBottom: 28, letterSpacing: "0.06em" }}>
          Access continues until {fmt(sub.current_period_end)}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "12px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 4, color: "#f87171", fontFamily: mono, fontSize: 11, letterSpacing: "0.12em",
            textTransform: "uppercase", cursor: "pointer",
          }}>
            Yes, cancel
          </button>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4, color: "#e8e8f0", fontFamily: mono, fontSize: 11, letterSpacing: "0.12em",
            textTransform: "uppercase", cursor: "pointer",
          }}>
            Keep it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────
export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("subscriptions");

  // Settings fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
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
      setNotifPrefs(user.user_metadata?.notif_prefs ?? {});
      const res = await fetch("/api/fan/me");
      if (res.status === 401) { router.push("/login"); return; }
      setData(await res.json());
      setLoading(false);
    }
    load();
  }, []);

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

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    const updates: any = { data: { display_name: displayName, bio, notif_prefs: notifPrefs } };
    if (newPassword.length >= 8) updates.password = newPassword;
    const { error } = await supabase.auth.updateUser(updates);
    if (error) { setErr(error.message); setSaving(false); return; }
    setSaved(true); setNewPassword(""); setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  }

  const mono = "DM Mono,monospace";
  const serif = "Cormorant Garamond,serif";
  const bg = "#09090C";
  const surface = "#111118";
  const border = "rgba(255,255,255,0.08)";
  const muted = "#71717a";
  const accent = "#F0B429";
  const red = "#f87171";
  const green = "#34d399";

  const activeSubs = (data?.subscriptions ?? []).filter((s: any) => ["active","trialing","cancelling"].includes(s.status));
  const pastSubs   = (data?.subscriptions ?? []).filter((s: any) => !["active","trialing","cancelling"].includes(s.status));
  const totalSpent = data?.totalSpent ?? 0;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "subscriptions", label: "Subscriptions", count: activeSubs.length || undefined },
    { key: "library",       label: "Library",        count: data?.purchases?.length || undefined },
    { key: "activity",      label: "Activity",        count: data?.tips?.length || undefined },
    { key: "settings",      label: "Settings" },
  ];

  if (loading) return (
    <div style={{ background: bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: muted, fontFamily: mono, fontSize: 11, letterSpacing: "0.15em" }}>Loading…</p>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: "100vh", color: "#e8e8f0" }}>
      {cancelSub && <CancelDialog sub={cancelSub} onCancel={handleCancel} onClose={() => setCancelSub(null)} />}

      {/* ── Header ── */}
      <header style={{ borderBottom: `1px solid ${border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(9,9,12,0.95)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <Link href="/" style={{ fontFamily: serif, fontSize: 22, color: "#fff", textDecoration: "none" }}>
          Spot<span style={{ color: accent }}>light</span>ly
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/feed" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, textDecoration: "none", padding: "7px 14px", border: `1px solid ${border}`, borderRadius: 3 }}>
            ← Feed
          </Link>
          {data?.creatorProfile && (
            <Link href="/dashboard" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, textDecoration: "none", padding: "7px 14px", border: `1px solid ${border}`, borderRadius: 3 }}>
              Dashboard
            </Link>
          )}
        </div>
      </header>

      {/* ── Fan identity hero ── */}
      <div style={{ background: `radial-gradient(ellipse 60% 80% at 50% 0%, rgba(240,180,41,0.05) 0%, transparent 70%), ${bg}`, padding: "40px 28px 0", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 36 }}>
          <Av name={displayName || user?.email} size={72} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontFamily: serif, fontSize: 32, fontWeight: 400, color: "#fff", margin: 0, lineHeight: 1 }}>
                {displayName || user?.email?.split("@")[0]}
              </h1>
              {/* 18+ verified badge */}
              <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: green, padding: "3px 8px", borderRadius: 2, flexShrink: 0 }}>
                ✓ Verified 18+
              </span>
            </div>
            {bio && <p style={{ fontSize: 14, color: "rgba(232,232,240,0.55)", margin: "4px 0 0", lineHeight: 1.65 }}>{bio}</p>}
            <p style={{ fontFamily: mono, fontSize: 10, color: "#3f3f46", margin: "8px 0 0", letterSpacing: "0.06em" }}>{user?.email}</p>
          </div>
          {totalSpent > 0 && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: muted, marginBottom: 6 }}>Total supported</p>
              <p style={{ fontFamily: serif, fontSize: 28, color: accent, margin: 0, lineHeight: 1 }}>{fmtMoney(totalSpent)}</p>
            </div>
          )}
        </div>

        {/* Become a creator — fans only */}
        {!data?.creatorProfile && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const, background: "rgba(240,180,41,0.05)", border: "1px solid rgba(240,180,41,0.15)", borderLeft: `3px solid ${accent}`, borderRadius: 4, padding: "16px 20px", marginBottom: 24 }}>
            <div>
              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: accent, marginBottom: 4 }}>Have an audience of your own?</p>
              <p style={{ fontSize: 13, color: "rgba(232,232,240,0.55)", margin: 0 }}>Set up a creator account and start earning — subscriptions, tips, live, merch. 30-day free trial.</p>
            </div>
            <Link href="/signup" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#09090C", background: accent, padding: "10px 20px", borderRadius: 3, textDecoration: "none", flexShrink: 0 }}>
              Start creating →
            </Link>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: `1px solid ${border}`, gap: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "11px 20px 13px", background: "none", border: "none",
              borderBottom: `2px solid ${tab === t.key ? accent : "transparent"}`,
              fontFamily: mono, fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
              color: tab === t.key ? "#fff" : muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s",
            }}>
              {t.label}
              {t.count !== undefined && (
                <span style={{ background: tab === t.key ? accent : "rgba(255,255,255,0.08)", color: tab === t.key ? "#09090C" : muted, borderRadius: 10, padding: "1px 7px", fontSize: 9, fontWeight: 600 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 28px 80px" }}>

        {/* ════ SUBSCRIPTIONS ════ */}
        {tab === "subscriptions" && (
          <div>
            {activeSubs.length === 0 && pastSubs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "72px 0" }}>
                <p style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>✦</p>
                <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 300, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>No subscriptions yet.</h2>
                <p style={{ fontSize: 14, color: muted, marginBottom: 24 }}>Find a creator and subscribe to see them in your lineup.</p>
                <Link href="/explore" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#09090C", background: accent, padding: "12px 24px", borderRadius: 3, textDecoration: "none" }}>
                  Find creators →
                </Link>
              </div>
            ) : null}

            {activeSubs.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: muted, marginBottom: 14 }}>
                  Active subscriptions
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {activeSubs.map((s: any) => {
                    const isCancelling = s.status === "cancelling";
                    return (
                      <div key={s.id} style={{ background: surface, border: `1px solid ${isCancelling ? "rgba(248,113,113,0.15)" : border}`, borderRadius: 6, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                        <Av url={s.creator?.avatar_url} name={s.creator?.display_name} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/${s.creator?.handle}`} style={{ fontFamily: serif, fontSize: 20, color: "#fff", textDecoration: "none", display: "block", marginBottom: 4, lineHeight: 1.2 }}>
                            {s.creator?.display_name ?? s.creator?.handle}
                          </Link>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
                            <span style={{ fontFamily: mono, fontSize: 11, color: muted, letterSpacing: "0.05em" }}>
                              {fmtMoney(s.price)}/mo
                            </span>
                            <span style={{ color: "#3f3f46", fontSize: 10 }}>·</span>
                            {isCancelling ? (
                              <span style={{ fontFamily: mono, fontSize: 10, color: red }}>
                                Access until {fmt(s.current_period_end)}
                              </span>
                            ) : (
                              <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>
                                Renews {s.current_period_end ? fmt(s.current_period_end) : "—"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                          <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: isCancelling ? red : green, background: isCancelling ? "rgba(248,113,113,0.08)" : "rgba(52,211,153,0.08)", border: `1px solid ${isCancelling ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}`, padding: "3px 8px", borderRadius: 2 }}>
                            {s.status === "trialing" ? "Trial" : isCancelling ? "Cancelling" : "Active"}
                          </span>
                          <Link href={`/${s.creator?.handle}`} style={{ fontFamily: mono, fontSize: 9, color: muted, textDecoration: "none", padding: "6px 10px", border: `1px solid ${border}`, borderRadius: 3, letterSpacing: "0.08em" }}>
                            Visit
                          </Link>
                          {!isCancelling && (
                            <button
                              onClick={() => setCancelSub(s)}
                              disabled={cancelling === s.id}
                              style={{ fontFamily: mono, fontSize: 9, color: red, background: "none", border: `1px solid rgba(248,113,113,0.2)`, borderRadius: 3, padding: "6px 10px", cursor: "pointer", letterSpacing: "0.08em" }}
                            >
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
                <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: muted, marginBottom: 14 }}>Past subscriptions</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {pastSubs.map((s: any) => (
                    <div key={s.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 6, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, opacity: 0.65 }}>
                      <Av url={s.creator?.avatar_url} name={s.creator?.display_name} size={36} />
                      <div style={{ flex: 1 }}>
                        <Link href={`/${s.creator?.handle}`} style={{ fontFamily: serif, fontSize: 17, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>
                          {s.creator?.display_name ?? s.creator?.handle}
                        </Link>
                        <p style={{ fontFamily: mono, fontSize: 10, color: "#3f3f46", margin: "3px 0 0" }}>
                          {fmtMoney(s.price)}/mo · ended {fmt(s.canceled_at ?? s.current_period_end ?? s.created_at)}
                        </p>
                      </div>
                      <span style={{ fontFamily: mono, fontSize: 9, color: "#3f3f46", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ LIBRARY ════ */}
        {tab === "library" && (
          <div>
            {(!data?.purchases || data.purchases.length === 0) ? (
              <div style={{ textAlign: "center", padding: "72px 0" }}>
                <p style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>📦</p>
                <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 300, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Your library is empty.</h2>
                <p style={{ fontSize: 14, color: muted }}>Digital products and unlocked posts live here — download them anytime.</p>
              </div>
            ) : (
              <div>
                <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: muted, marginBottom: 14 }}>
                  {data.purchases.length} item{data.purchases.length !== 1 ? "s" : ""}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {data.purchases.map((p: any) => {
                    const isDigital = p.type === "digital";
                    const title = isDigital
                      ? (p.product?.title ?? "Digital product")
                      : (p.post?.title || p.post?.caption?.slice(0, 60) + "…" || "Unlocked post");
                    const creator = isDigital ? p.product?.creator : p.post?.creator;
                    return (
                      <div key={p.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 6, background: isDigital ? "rgba(52,211,153,0.08)" : "rgba(240,180,41,0.08)", border: `1px solid ${isDigital ? "rgba(52,211,153,0.2)" : "rgba(240,180,41,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                          {isDigital ? "📦" : "🔓"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 500, color: "#fff", margin: 0, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {title}
                          </p>
                          <p style={{ fontFamily: mono, fontSize: 10, color: muted, margin: 0 }}>
                            by {creator?.display_name ?? creator?.handle} · {fmt(p.created_at)} · {fmtMoney(p.amount_paid)}
                          </p>
                        </div>
                        {isDigital && p.download_token && (
                          <a
                            href={`/api/digital/download?token=${p.download_token}`}
                            style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: green, border: "1px solid rgba(52,211,153,0.25)", borderRadius: 3, padding: "7px 12px", textDecoration: "none", flexShrink: 0 }}
                          >
                            Download →
                          </a>
                        )}
                        {!isDigital && p.post?.creator?.handle && (
                          <Link
                            href={`/${p.post.creator.handle}`}
                            style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, border: `1px solid ${border}`, borderRadius: 3, padding: "7px 12px", textDecoration: "none", flexShrink: 0 }}
                          >
                            View →
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ ACTIVITY ════ */}
        {tab === "activity" && (
          <div>
            {(!data?.tips || data.tips.length === 0) ? (
              <div style={{ textAlign: "center", padding: "72px 0" }}>
                <p style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>💛</p>
                <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 300, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>No tips sent yet.</h2>
                <p style={{ fontSize: 14, color: muted }}>When you tip a creator it shows up here.</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                  <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: muted }}>
                    {data.tips.length} tip{data.tips.length !== 1 ? "s" : ""} sent
                  </p>
                  <p style={{ fontFamily: serif, fontSize: 22, color: accent }}>{fmtMoney(data.totalTipped)} total</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {data.tips.map((t: any) => (
                    <div key={t.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                      <Av url={t.creator?.avatar_url} name={t.creator?.display_name} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/${t.creator?.handle}`} style={{ fontFamily: serif, fontSize: 18, color: "#fff", textDecoration: "none" }}>
                          {t.creator?.display_name ?? t.creator?.handle}
                        </Link>
                        {t.message && (
                          <p style={{ fontSize: 13, color: "rgba(232,232,240,0.5)", margin: "4px 0 0", fontStyle: "italic" }}>"{t.message}"</p>
                        )}
                        <p style={{ fontFamily: mono, fontSize: 9, color: "#3f3f46", margin: "4px 0 0" }}>
                          {t.type === "super_tip" && <span style={{ color: accent }}>Super Tip · </span>}
                          {fmt(t.created_at)}
                        </p>
                      </div>
                      <p style={{ fontFamily: serif, fontSize: 22, color: accent, margin: 0, flexShrink: 0 }}>{fmtMoney(t.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ SETTINGS ════ */}
        {tab === "settings" && (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {err && <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 4, padding: "12px 16px", color: red, fontSize: 13 }}>{err}</div>}
            {saved && <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 4, padding: "12px 16px", color: green, fontFamily: mono, fontSize: 10, letterSpacing: "0.12em" }}>✓ Changes saved</div>}

            {/* Profile */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: muted, margin: 0 }}>Your profile</p>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#52525b" }}>Display name</span>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 4, padding: "11px 14px", color: "#fff", fontSize: 15, outline: "none", fontFamily: "inherit" }}
                  onFocus={e => (e.currentTarget.style.borderColor = accent)}
                  onBlur={e => (e.currentTarget.style.borderColor = border)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#52525b" }}>Bio <span style={{ color: "#3f3f46" }}>(optional — creators see this)</span></span>
                <textarea value={bio} onChange={e => setBio(e.target.value)}
                  placeholder="A bit about yourself…" rows={3}
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 4, padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6 }}
                  onFocus={e => (e.currentTarget.style.borderColor = accent)}
                  onBlur={e => (e.currentTarget.style.borderColor = border)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#52525b" }}>Email</span>
                <input type="email" value={user?.email ?? ""} disabled
                  style={{ background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 4, padding: "11px 14px", color: "#3f3f46", fontSize: 14, outline: "none", cursor: "not-allowed" }}
                />
                <span style={{ fontFamily: mono, fontSize: 9, color: "#2d2d30" }}>To change your email contact support@spotlightly.app</span>
              </label>
            </div>

            {/* Password */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: "24px" }}>
              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: muted, marginBottom: 14 }}>Password</p>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#52525b" }}>New password</span>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 4, padding: "11px 14px", color: "#fff", fontSize: 15, outline: "none", fontFamily: "inherit" }}
                  onFocus={e => (e.currentTarget.style.borderColor = accent)}
                  onBlur={e => (e.currentTarget.style.borderColor = border)}
                />
                {newPassword.length > 0 && newPassword.length < 8 && (
                  <span style={{ fontFamily: mono, fontSize: 9, color: red }}>Must be at least 8 characters</span>
                )}
              </label>
            </div>

            {/* Notification prefs — per subscribed creator */}
            {activeSubs.length > 0 && (
              <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: "24px" }}>
                <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: muted, marginBottom: 16 }}>
                  Email notifications
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activeSubs.map((s: any) => {
                    const key = s.creator?.handle;
                    const on = notifPrefs[key] !== false; // default on
                    return (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Av url={s.creator?.avatar_url} name={s.creator?.display_name} size={32} />
                          <div>
                            <p style={{ fontFamily: "inherit", fontSize: 14, color: "#e8e8f0", margin: 0 }}>{s.creator?.display_name}</p>
                            <p style={{ fontFamily: mono, fontSize: 9, color: muted, margin: "2px 0 0" }}>New posts and live streams</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNotifPrefs(prev => ({ ...prev, [key]: !on }))}
                          style={{
                            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                            background: on ? accent : "rgba(255,255,255,0.1)", transition: "background 0.2s",
                            position: "relative", flexShrink: 0,
                          }}
                        >
                          <span style={{
                            position: "absolute", top: 3, left: on ? 22 : 3, width: 18, height: 18,
                            borderRadius: "50%", background: on ? "#09090C" : "#52525b", transition: "left 0.2s",
                          }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button type="submit" disabled={saving} style={{ padding: "14px", background: saving ? "rgba(240,180,41,0.4)" : accent, color: "#09090C", border: "none", borderRadius: 4, fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", cursor: saving ? "default" : "pointer" }}>
              {saving ? "Saving…" : "Save changes"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: `1px solid ${border}` }}>
              <a href="mailto:support@spotlightly.app" style={{ fontFamily: mono, fontSize: 10, color: muted, textDecoration: "none", letterSpacing: "0.08em" }}>
                support@spotlightly.app
              </a>
              <button
                type="button"
                onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}
                style={{ background: "none", border: `1px solid rgba(255,255,255,0.08)`, fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, cursor: "pointer", padding: "8px 16px", borderRadius: 3 }}
              >
                Sign out
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
