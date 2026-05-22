"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function RedeemForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: true; creatorHandle: string; months: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function redeem() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/gift-subscription/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json();
    if (data.ok) setResult(data);
    else setError(data.error ?? "Something went wrong.");
    setLoading(false);
  }

  return (
    <main style={{
      minHeight: "100vh", background: "#09090C",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px",
    }}>
      <Link href="/" style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 400, color: "#fff", letterSpacing: "-.01em", marginBottom: 48, textDecoration: "none" }}>
        Spot<span style={{ color: "#F0B429" }}>light</span>ly
      </Link>

      <div style={{
        background: "#111115", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, padding: "40px 44px", width: "100%", maxWidth: 440,
      }}>
        {result ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎁</div>
            <h1 style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 300, color: "#fff", marginBottom: 12, lineHeight: 1.1 }}>
              You&apos;re in.
            </h1>
            <p style={{ fontSize: 15, color: "rgba(242,242,240,0.65)", lineHeight: 1.75, marginBottom: 32 }}>
              Your <strong style={{ color: "#fff" }}>{result.months}-month subscription</strong> to{" "}
              <strong style={{ color: "#F0B429" }}>@{result.creatorHandle}</strong> is now active.
            </p>
            <Link href={`/${result.creatorHandle}`} style={{
              display: "inline-block", background: "#F0B429", color: "#09090C",
              fontWeight: 700, fontSize: 13, padding: "13px 28px",
              borderRadius: 999, textDecoration: "none",
            }}>
              Visit their page →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 300, color: "#fff", marginBottom: 8, lineHeight: 1.1 }}>
                Redeem your gift.
              </h1>
              <p style={{ fontSize: 14, color: "rgba(242,242,240,0.5)", lineHeight: 1.7 }}>
                Enter the code from your gift email to activate your subscription.
              </p>
            </div>

            <label style={{ display: "block", fontFamily: "monospace", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(242,242,240,0.4)", marginBottom: 8 }}>
              Redemption code
            </label>
            <input
              type="text"
              placeholder="e.g. a3f9bc2d1e4f..."
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") redeem(); }}
              style={{
                width: "100%", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                padding: "12px 16px", color: "#F2F2F0", fontSize: 14,
                outline: "none", marginBottom: 12,
                fontFamily: "monospace", letterSpacing: ".05em",
              }}
            />

            {error && <p style={{ fontSize: 13, color: "#F87171", marginBottom: 12 }}>{error}</p>}

            <button
              onClick={redeem}
              disabled={loading || !code.trim()}
              style={{
                width: "100%", background: "#F0B429", color: "#09090C",
                fontWeight: 700, fontSize: 13, padding: "13px 0",
                borderRadius: 999, border: "none", cursor: "pointer",
                opacity: loading || !code.trim() ? 0.5 : 1,
              }}
            >
              {loading ? "Redeeming…" : "Redeem gift →"}
            </button>

            <p style={{ fontSize: 12, color: "rgba(242,242,240,0.3)", marginTop: 20, textAlign: "center", lineHeight: 1.6 }}>
              You&apos;ll need to be signed in to your Spotlightly account.<br />
              <Link href="/login" style={{ color: "rgba(240,180,41,0.6)" }}>Sign in here</Link> if you&apos;re not already.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
