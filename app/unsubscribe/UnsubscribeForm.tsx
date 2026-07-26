"use client";

import { useState } from "react";

export default function UnsubscribeForm({ email, e, s }: { email: string; e: string; s: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function confirm() {
    setState("working");
    setErr("");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ e, s }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.error || "Something went wrong."); setState("error"); return; }
      setState("done");
    } catch {
      setErr("Something went wrong.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <>
        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 300, fontSize: 28, margin: "0 0 12px" }}>
          You&apos;re unsubscribed.
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--muted)" }}>
          We won&apos;t send marketing email to <strong>{email}</strong> again. You&apos;ll still get
          essential messages about anything you buy or any account you hold — receipts, payment
          problems, and security notices.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 300, fontSize: 28, margin: "0 0 12px" }}>
        Unsubscribe {email}?
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--muted)", marginBottom: 28 }}>
        You&apos;ll stop receiving marketing email from Spotlightly. Receipts, payment problems, and
        security notices will still reach you — those aren&apos;t something we can opt you out of.
      </p>
      <button
        onClick={confirm}
        disabled={state === "working"}
        style={{
          background: "#F0B429", color: "#09090C", fontWeight: 700, fontSize: 14,
          padding: "14px 28px", borderRadius: 999, border: "none",
          cursor: state === "working" ? "default" : "pointer", opacity: state === "working" ? 0.6 : 1,
        }}
      >
        {state === "working" ? "Working…" : "Confirm unsubscribe"}
      </button>
      {err ? <p style={{ color: "#ff6b6b", fontSize: 14, marginTop: 16 }}>{err}</p> : null}
    </>
  );
}
