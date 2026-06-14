"use client";
import { useState } from "react";

export default function ClaimForm({ code }: { code: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Something went wrong."); setBusy(false); return; }
      window.location.href = "/login?claimed=1";
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 8,
    background: "#111115", border: "1px solid rgba(255,255,255,0.12)",
    color: "#F2F2F0", fontSize: 15, marginBottom: 12, outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <input style={input} type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input style={input} type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      <input style={input} type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      {error && <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button
        onClick={submit}
        disabled={busy || !email || !password}
        style={{
          width: "100%", padding: "13px 16px", borderRadius: 8, border: "none", cursor: busy ? "default" : "pointer",
          background: "#F0B429", color: "#09090C", fontWeight: 700, fontSize: 15, opacity: busy || !email || !password ? 0.6 : 1,
        }}
      >
        {busy ? "Claiming…" : "Claim my page"}
      </button>
    </div>
  );
}
