"use client";

import { useState } from "react";

const PILLARS = [
  { id: "money", label: "Money math" },
  { id: "product", label: "Product demo" },
  { id: "commentary", label: "Commentary" },
  { id: "brand", label: "Brand / soul" },
];

const PLATFORMS = ["TikTok", "Instagram", "Both"];

type GenResult = {
  hooks?: string[];
  caption?: string;
  hashtags?: string[];
  carousel?: string[];
  posting_note?: string;
};

export default function ContentEngine() {
  const [pillar, setPillar] = useState("money");
  const [platform, setPlatform] = useState("Both");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");

  async function generate() {
    if (!topic.trim()) {
      setErr("Type a topic first.");
      return;
    }
    setLoading(true);
    setErr("");
    setResult(null);
    setRaw("");
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pillar, platform, topic }),
      });
      const data = await res.json();
      if (data.result) setResult(data.result as GenResult);
      else if (data.raw) setRaw(data.raw);
      else setErr(data.error || "Something went wrong.");
    } catch {
      setErr("Request failed — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="kicker">Content Engine</div>
      <h1 className="adm-page-title">
        Make a <em>month</em> of posts.
      </h1>
      <p className="adm-page-lede">
        Pick a pillar, drop a topic, generate hooks, caption, and carousel copy in brand voice — TikTok and Instagram, no filming.
      </p>

      <div className="card">
        <div className="adm-field" style={{ marginBottom: 18 }}>
          <span className="adm-label">Pillar</span>
          <div className="row-actions" style={{ flexWrap: "wrap" }}>
            {PILLARS.map((p) => (
              <button
                key={p.id}
                className={`adm-btn ${pillar === p.id ? "adm-btn--primary" : "adm-btn--ghost"}`}
                onClick={() => setPillar(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="adm-field" style={{ marginBottom: 18 }}>
          <span className="adm-label">Platform</span>
          <div className="row-actions">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                className={`adm-btn ${platform === p ? "adm-btn--primary" : "adm-btn--ghost"}`}
                onClick={() => setPlatform(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="adm-field">
          <span className="adm-label">Topic</span>
          <textarea
            className="adm-textarea"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Patreon's fees at 1,000 subscribers · setting up your page · why we take 0% on tips"
          />
        </div>

        <div className="section-actions">
          <button className="adm-btn adm-btn--primary" onClick={generate} disabled={loading}>
            {loading ? "Finding the angle…" : "Generate"}
          </button>
        </div>
      </div>

      {err && <div className="adm-banner adm-banner--err">{err}</div>}

      {result && (
        <>
          {result.hooks && (
            <CopyCard title="Hooks" copyText={result.hooks.join("\n")}>
              {result.hooks.map((h, i) => (
                <div key={i} className="ce-line">
                  <span className="ce-idx">{String(i + 1).padStart(2, "0")}</span>
                  {h}
                </div>
              ))}
            </CopyCard>
          )}

          {result.caption && (
            <CopyCard title="Caption" copyText={result.caption}>
              <div style={{ color: "rgba(232,232,240,0.85)" }}>{result.caption}</div>
            </CopyCard>
          )}

          {result.hashtags && (
            <CopyCard title="Hashtags" copyText={result.hashtags.join(" ")}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.hashtags.map((t, i) => (
                  <span key={i} className="badge badge--dim">
                    {t}
                  </span>
                ))}
              </div>
            </CopyCard>
          )}

          {result.carousel && (
            <CopyCard title="Carousel / slides" copyText={result.carousel.join("\n\n")}>
              {result.carousel.map((s, i) => (
                <div key={i} className="ce-line">
                  <span className="ce-idx ce-idx--gold">{i + 1}</span>
                  {s}
                </div>
              ))}
            </CopyCard>
          )}

          {result.posting_note && (
            <div className="adm-banner adm-banner--ok" style={{ lineHeight: 1.7 }}>
              <strong style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>How to post it</strong>
              {result.posting_note}
            </div>
          )}
        </>
      )}

      {raw && (
        <div className="card">
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, color: "rgba(232,232,240,0.85)" }}>
            {raw}
          </pre>
        </div>
      )}

      <style>{`
        .ce-line {
          padding: 9px 0;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          color: rgba(232,232,240,0.85);
          font-size: 14px;
          line-height: 1.7;
        }
        .ce-line:last-child { border-bottom: none; }
        .ce-idx {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          color: var(--muted);
          margin-right: 12px;
        }
        .ce-idx--gold { color: var(--spot); }
        .ce-copy {
          float: right;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          background: transparent;
          border: none;
          color: var(--muted);
          cursor: pointer;
        }
        .ce-copy.copied { color: var(--open); }
      `}</style>
    </>
  );
}

function CopyCard({
  title,
  copyText,
  children,
}: {
  title: string;
  copyText: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = copyText;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div className="card">
      <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title}</span>
        <button className={`ce-copy ${copied ? "copied" : ""}`} onClick={doCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {children}
    </div>
  );
}
