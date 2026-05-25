"use client";
import { useRef, useState } from "react";

const AMOUNTS = ["3", "5", "10", "25", "50"];

export default function TipButton({ creatorProfileId }: { creatorProfileId: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("5");
  const [custom, setCustom] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const finalAmount = custom && Number(custom) >= 1 ? custom : amount;

  function submit() {
    formRef.current?.submit();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn--secondary">
        Send a tip
      </button>
    );
  }

  return (
    <div style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-3)",
      padding: "var(--s-5)",
      minWidth: 240,
    }}>
      {/* Hidden form — submits to existing tip route */}
      <form ref={formRef} action="/api/tip" method="post" style={{ display: "none" }}>
        <input type="hidden" name="creator_profile_id" value={creatorProfileId} />
        <input type="hidden" name="amount_usd" value={finalAmount} />
      </form>

      <p style={{
        fontFamily: "var(--font-display)",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--muted)",
        letterSpacing: ".08em",
        textTransform: "uppercase",
        marginBottom: "var(--s-3)",
      }}>
        Send a tip
      </p>

      {/* Preset amounts */}
      <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", marginBottom: "var(--s-3)" }}>
        {AMOUNTS.map(a => (
          <button
            key={a}
            type="button"
            onClick={() => { setAmount(a); setCustom(""); }}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 700,
              padding: "7px 14px",
              border: "1px solid",
              borderRadius: "var(--r-pill)",
              cursor: "pointer",
              transition: "all var(--t-fast)",
              background: amount === a && !custom ? "var(--accent)" : "var(--surface)",
              color: amount === a && !custom ? "#0A0A0D" : "var(--text-soft)",
              borderColor: amount === a && !custom ? "var(--accent)" : "var(--border)",
            }}
          >
            ${a}
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--s-4)" }}>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>$</span>
        <input
          type="number"
          min="1"
          placeholder="Custom"
          value={custom}
          onChange={e => { setCustom(e.target.value); setAmount(""); }}
          style={{
            flex: 1,
            background: "var(--surface)",
            border: "1px solid",
            borderColor: custom ? "var(--accent)" : "var(--border)",
            borderRadius: "var(--r-2)",
            padding: "7px 10px",
            color: "var(--text)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: "var(--s-2)" }}>
        <button
          type="button"
          onClick={submit}
          disabled={Number(finalAmount) < 1}
          className="btn btn--primary"
          style={{ flex: 1, borderRadius: "var(--r-pill)" }}
        >
          Send ${finalAmount} tip
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn--ghost"
          style={{ borderRadius: "var(--r-pill)" }}
        >
          ✕
        </button>
      </div>

      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: "var(--s-3)", lineHeight: 1.5 }}>
        Show your support directly.
      </p>
    </div>
  );
}
