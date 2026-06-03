"use client";

import { useState } from "react";

export default function GiftSubscriptionButton({
  creatorProfileId,
  handle,
}: {
  creatorProfileId: string;
  handle: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [months, setMonths] = useState(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!email.trim()) { setError("Add a recipient email"); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/gift-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorProfileId, recipientEmail: email.trim(), months }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.href = `/fan-signup?return=/${handle}`; return; }
      if (data.url) { window.location.href = data.url; return; }
      setError(data.error ?? "Something went wrong");
    } catch {
      setError("Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn--ghost btn--small cp-rail-btn">
        🎁 Gift a subscription
      </button>
    );
  }

  return (
    <div className="cp-gift">
      <p className="cp-gift-title">Gift @{handle}</p>
      <input
        type="email"
        placeholder="Recipient email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="cp-gift-input"
      />
      <div className="cp-gift-months">
        {[1, 3, 6, 12].map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className={`cp-gift-month${months === m ? " cp-gift-month--active" : ""}`}
          >
            {m}mo
          </button>
        ))}
      </div>
      {error && <p className="cp-gift-error">{error}</p>}
      <button onClick={send} disabled={sending} className="btn btn--primary btn--small" style={{ width: "100%" }}>
        {sending ? "…" : "Continue to checkout"}
      </button>
      <button onClick={() => setOpen(false)} className="cp-gift-cancel">Cancel</button>

      <style>{`
        .cp-gift { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-3); padding: 16px; }
        .cp-gift-title { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--text); margin: 0 0 12px; }
        .cp-gift-input {
          width: 100%; background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-2); padding: 9px 12px; color: var(--text); font-size: 13px;
          font-family: inherit; outline: none; margin-bottom: 10px;
        }
        .cp-gift-months { display: flex; gap: 6px; margin-bottom: 12px; }
        .cp-gift-month {
          flex: 1; padding: 7px 0; border-radius: var(--r-2); cursor: pointer;
          border: 1px solid var(--border); background: transparent; color: var(--muted-faint);
          font-family: var(--font-mono); font-size: 11px;
        }
        .cp-gift-month--active { border-color: var(--accent-border); background: var(--accent-soft); color: var(--accent); }
        .cp-gift-error { color: var(--red); font-size: 12px; margin: 0 0 10px; }
        .cp-gift-cancel {
          display: block; width: 100%; margin-top: 8px; background: none; border: none;
          color: var(--muted-faint); font-family: var(--font-mono); font-size: 11px; cursor: pointer;
        }
      `}</style>
    </div>
  );
}
