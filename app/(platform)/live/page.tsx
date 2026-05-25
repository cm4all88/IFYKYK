"use client";

import { useState } from "react";
import Link from "next/link";

export default function LivePage() {
  const [title, setTitle] = useState("");
  const [stream, setStream] = useState<{ rtmpUrl: string; streamKey: string; playbackUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function goLive() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Live Stream" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStream(data);
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
          <Link href="/" style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text)", textDecoration: "none" }}>Spot<span style={{ color: "var(--accent)" }}>light</span>ly</Link>
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
          Your first hour is always free. After that, $0.01 per viewer per hour — billed in 15-minute increments. Use any streaming software: OBS, Streamlabs, StreamYard, or your phone.
        </p>

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
              <button onClick={goLive} disabled={loading} className="btn btn--primary" style={{ padding: "14px 28px", fontSize: 12 }}>
                {loading ? "Setting up stream..." : "🔴  Start live stream"}
              </button>
            </div>

            <div style={{ ...card, borderTop: "2px solid var(--accent)", marginTop: 2 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, color: "#fff", marginBottom: 8 }}>Requirements</div>
              <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.85 }}>
                · A streaming app: <strong style={{ color: "var(--text)" }}>OBS Studio</strong> (free, recommended), Streamlabs, or StreamYard<br />
                · A stable internet connection (minimum 5 Mbps upload for 1080p)<br />
                · Your stream title and RTMP credentials — provided below after you start<br />
                · Your Backstage verification must be complete before streaming adult content
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
              <div style={label}>OBS Settings</div>
              <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.85 }}>
                1. Open OBS → <strong style={{ color: "var(--text)" }}>Settings → Stream</strong><br />
                2. Service: <strong style={{ color: "var(--text)" }}>Custom</strong><br />
                3. Server: paste the RTMP URL above<br />
                4. Stream Key: paste the Stream Key above<br />
                5. Click <strong style={{ color: "var(--text)" }}>Apply → OK</strong><br />
                6. Click <strong style={{ color: "var(--accent)" }}>Start Streaming</strong> in OBS<br />
                7. Your fans will see you live on your Spotlightly page automatically
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button onClick={() => setStream(null)} className="btn btn--ghost" style={{ marginRight: 10 }}>← Start a new stream</button>
              <Link href="/dashboard" className="btn btn--ghost">← Back to dashboard</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
