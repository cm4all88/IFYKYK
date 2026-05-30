"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import BrowserStream from "@/components/BrowserStream";
import LiveStreamView from "@/components/LiveStreamView";

type Mode = "choose" | "browser" | "obs";

export default function LivePage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [title, setTitle] = useState("");
  const [stream, setStream] = useState<{ rtmpUrl: string; streamKey: string; playbackUrl: string; streamId?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [endedStreamId, setEndedStreamId] = useState<string | null>(null);
  const [vodCaption, setVodCaption] = useState("");
  const [vodLockType, setVodLockType] = useState("free");
  const [vodPrice, setVodPrice] = useState("");
  const [savingVod, setSavingVod] = useState(false);
  const [vodSaved, setVodSaved] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from("creator_profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("kind", "spotlight")
        .maybeSingle();
      if (data) setProfileId(data.id);
    }
    loadProfile();
  }, []);

  async function startObsStream() {
    if (!profileId) { setErr("Profile not loaded — try refreshing."); return; }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Live Stream", creatorProfileId: profileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStream({ ...data, streamId: data.streamId });
    } catch (e: any) {
      setErr(e.message || "Failed to start stream");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-3)", padding: "28px 32px", marginBottom: 2 };
  const label = { fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".22em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 8 };
  const code = { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", wordBreak: "break-all" as const };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", fontWeight: 300 }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 10, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="brand-logo" style={{ fontSize: 22 }}>Spot<span>light</span>ly</Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>/ Go Live</span>
        </div>
        <Link href="/dashboard" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "var(--muted)", textDecoration: "none" }}>← Dashboard</Link>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 28px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 12 }}>Live Streaming</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-.02em", marginBottom: 8 }}>
          Go <em style={{ fontStyle: "italic", color: "var(--accent)" }}>live.</em>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-soft)", lineHeight: 1.75, marginBottom: 40, maxWidth: 560 }}>
          Stream directly to your audience — from your browser or any streaming software.
        </p>

        {/* Mode selector */}
        {mode === "choose" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginBottom: 32 }}>
            <button onClick={() => setMode("browser")} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderTop: "2px solid var(--accent)", borderRadius: "var(--r-3)",
              padding: "32px 28px", textAlign: "left", cursor: "pointer",
              transition: "border-color 0.15s",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🌐</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, color: "#fff", marginBottom: 8 }}>
                Go live from browser
              </div>
              <p style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.65, margin: 0 }}>
                No software needed. Click, allow camera access, and you're live. Works on desktop and mobile.
              </p>
              <div style={{ marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)" }}>
                Recommended →
              </div>
            </button>

            <button onClick={() => setMode("obs")} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderTop: "2px solid rgba(255,255,255,0.1)", borderRadius: "var(--r-3)",
              padding: "32px 28px", textAlign: "left", cursor: "pointer",
              transition: "border-color 0.15s",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎛️</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, color: "#fff", marginBottom: 8 }}>
                Use OBS or streaming app
              </div>
              <p style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.65, margin: 0 }}>
                For professional setups. Get your RTMP URL and stream key to paste into OBS, Streamlabs, or any streaming app.
              </p>
              <div style={{ marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
                Advanced →
              </div>
            </button>
          </div>
        )}

        {/* Browser streaming */}
        {mode === "browser" && profileId && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button onClick={() => setMode("choose")} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                ← Back
              </button>
              <div style={{ flex: 1 }}>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Stream title (optional)"
                  className="input"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <BrowserStream
              profileId={profileId}
              title={title}
              onEnd={() => setMode("choose")}
            />
          </div>
        )}

        {mode === "browser" && !profileId && (
          <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading profile…</div>
        )}

        {/* OBS / software streaming */}
        {mode === "obs" && (
          <div>
            <button onClick={() => { setMode("choose"); setStream(null); setErr(null); }}
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24 }}>
              ← Back
            </button>

            {!stream ? (
              <div>
                <div style={card}>
                  <div style={label}>Stream title (optional)</div>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Morning workout · Tuesday live Q&A"
                    className="input"
                    style={{ width: "100%", marginBottom: 20 }}
                  />
                  {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "var(--red-soft)", border: "1px solid var(--red-border)", borderRadius: "var(--r-2)" }}>⚠ {err}</div>}
                  <button onClick={startObsStream} disabled={loading || !profileId} className="btn btn--primary" style={{ padding: "14px 28px", fontSize: 12, opacity: !profileId ? 0.5 : 1 }}>
                    {loading ? "Setting up stream..." : "🔴  Get stream credentials"}
                  </button>
                </div>

                <div style={{ ...card, borderTop: "2px solid var(--accent)", marginTop: 2 }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, color: "#fff", marginBottom: 8 }}>Requirements</div>
                  <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.85 }}>
                    · A streaming app: <strong style={{ color: "var(--text)" }}>OBS Studio</strong> (free, recommended), Streamlabs, or StreamYard<br />
                    · A stable internet connection (minimum 5 Mbps upload for 1080p)<br />
                    · Your stream title and RTMP credentials — provided below after you start
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: "rgba(248,113,113,.07)", border: "1px solid rgba(248,113,113,.2)", borderRadius: "var(--r-3)", padding: "16px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--red)", animation: "pulse 1.4s infinite" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase" as const, color: "var(--red)" }}>Stream ready — paste these into your streaming app</span>
                </div>

                <div style={card}>
                  <div style={label}>RTMP Server URL — paste into OBS → Settings → Stream</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ ...code, flex: 1 }}>{stream.rtmpUrl}</div>
                    <button onClick={() => copy(stream.rtmpUrl, "rtmp")} className="btn btn--ghost btn--small">
                      {copied === "rtmp" ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>

                <div style={{ ...card, marginTop: 2 }}>
                  <div style={label}>Stream Key — keep this private</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ ...code, flex: 1 }}>{stream.streamKey}</div>
                    <button onClick={() => copy(stream.streamKey, "key")} className="btn btn--ghost btn--small">
                      {copied === "key" ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>

                <div style={{ ...card, marginTop: 2 }}>
                  <div style={label}>OBS Setup</div>
                  <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.85 }}>
                    1. Open OBS → <strong style={{ color: "var(--text)" }}>Settings → Stream</strong><br />
                    2. Service: <strong style={{ color: "var(--text)" }}>Custom</strong><br />
                    3. Server: paste the RTMP URL above<br />
                    4. Stream Key: paste the Stream Key above<br />
                    5. Click <strong style={{ color: "var(--text)" }}>Apply → OK</strong><br />
                    6. Click <strong style={{ color: "var(--accent)" }}>Start Streaming</strong> in OBS
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button onClick={() => {
                if (stream?.streamId) setEndedStreamId(stream.streamId);
                setStream(null);
              }} className="btn btn--ghost" style={{ marginRight: 10 }}>End & save replay</button>
              <button onClick={() => setStream(null)} className="btn btn--ghost" style={{ marginRight: 10 }}>← Discard</button>
                  <Link href="/dashboard" className="btn btn--ghost">← Dashboard</Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VOD save panel */}
        {endedStreamId && !vodSaved && (
          <div style={{ maxWidth: 460, margin: "32px auto 0", background: "var(--surface)", border: "1px solid rgba(242,184,75,0.2)", borderTop: "2px solid var(--accent)", borderRadius: "var(--r-3)", padding: "28px 32px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>Save stream as replay</p>
            <p style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 20, lineHeight: 1.6 }}>
              Your stream just ended. Save it as a post so your audience can watch the replay — free or paid.
            </p>
            <input type="text" value={vodCaption} onChange={e => setVodCaption(e.target.value)}
              placeholder="Give it a title…" className="input" style={{ width: "100%", marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[["free","Free"],["subscription","Subscribers only"],["purchase","Paid unlock"]].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setVodLockType(val)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 4, border: "1px solid",
                  borderColor: vodLockType === val ? "rgba(242,184,75,0.4)" : "var(--border)",
                  background: vodLockType === val ? "rgba(242,184,75,0.08)" : "transparent",
                  color: vodLockType === val ? "var(--accent)" : "var(--muted)",
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: "pointer",
                }}>{label}</button>
              ))}
            </div>
            {vodLockType === "purchase" && (
              <input type="number" value={vodPrice} onChange={e => setVodPrice(e.target.value)}
                placeholder="Price (USD)" className="input" style={{ width: "100%", marginBottom: 12 }} />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                setSavingVod(true);
                const res = await fetch("/api/posts/vod", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ streamId: endedStreamId, caption: vodCaption, lockType: vodLockType, unlockPrice: vodLockType === "purchase" ? Number(vodPrice) : null }),
                });
                if (res.ok) { setVodSaved(true); setEndedStreamId(null); }
                setSavingVod(false);
              }} disabled={savingVod} className="btn btn--primary" style={{ flex: 1 }}>
                {savingVod ? "Saving…" : "Save replay as post"}
              </button>
              <button onClick={() => setEndedStreamId(null)} className="btn btn--ghost">Skip</button>
            </div>
          </div>
        )}

        {vodSaved && (
          <div style={{ maxWidth: 460, margin: "32px auto 0", textAlign: "center", padding: "24px" }}>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontStyle: "italic", color: "rgba(242,184,75,0.8)", margin: "0 0 8px" }}>Replay saved.</p>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Your audience can now watch it on your page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
