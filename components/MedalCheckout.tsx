"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { MEDAL_EMOJI } from "@/lib/medals";

const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#F2B84B",
    colorBackground: "#17181B",
    colorText: "#F7F3EC",
    colorTextSecondary: "#C8C4BE",
    colorTextPlaceholder: "#8A8A92",
    colorDanger: "#EF4444",
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    fontSizeBase: "15px",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { backgroundColor: "#0F1012", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "none", padding: "12px 14px" },
    ".Input:focus": { border: "1px solid #F2B84B", boxShadow: "0 0 0 1px rgba(242,184,75,0.5)" },
    ".Label": { color: "#C8C4BE", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em" },
    ".Tab": { backgroundColor: "#0F1012", border: "1px solid rgba(255,255,255,0.10)" },
    ".Tab:hover": { border: "1px solid rgba(242,184,75,0.4)" },
    ".Tab--selected": { border: "1px solid #F2B84B", backgroundColor: "rgba(242,184,75,0.08)" },
  },
};

const fonts = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" }];

function PayForm({ medals, price, onPaid }: { medals: number; price: number; onPaid: (balance: number) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements || busy) return;
    setBusy(true); setErr(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: typeof window !== "undefined" ? window.location.href : undefined },
    });
    if (error) { setErr(error.message ?? "Payment failed"); setBusy(false); return; }
    if (paymentIntent?.status === "succeeded") {
      try {
        const res = await fetch("/api/medals/confirm", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        });
        const data = await res.json();
        onPaid(typeof data.balance === "number" ? data.balance : medals);
      } catch { onPaid(medals); }
      return;
    }
    setErr("Payment did not complete."); setBusy(false);
  }

  return (
    <div>
      <PaymentElement options={{ layout: "tabs" }} />
      {err && <p style={{ color: "var(--red, #EF4444)", fontSize: 13, marginTop: 12 }}>{err}</p>}
      <button
        onClick={pay}
        disabled={busy || !stripe}
        style={{
          width: "100%", marginTop: 18, padding: "15px 0", border: "none", borderRadius: 10, cursor: busy ? "default" : "pointer",
          background: "linear-gradient(180deg, #F5C55A, #F2B84B)", color: "#09090C",
          fontFamily: "var(--font-display, sans-serif)", fontWeight: 800, fontSize: 15, letterSpacing: "0.01em",
          boxShadow: "0 8px 24px rgba(242,184,75,0.25)", opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Processing…" : `Pay $${price.toFixed(2)} — get ${medals} medals`}
      </button>
    </div>
  );
}

export default function MedalCheckout({
  clientSecret, publishableKey, medals, price, onClose, onComplete,
}: {
  clientSecret: string; publishableKey: string; medals: number; price: number;
  onClose: () => void; onComplete: (balance: number) => void;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const [done, setDone] = useState(false);

  function handlePaid(balance: number) {
    setDone(true);
    onComplete(balance);
    setTimeout(onClose, 1700);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(6,6,9,0.8)", backdropFilter: "blur(7px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: "var(--surface, #1E2024)", border: "1px solid var(--accent-border, rgba(242,184,75,0.25))", borderRadius: 18, padding: "38px 32px 32px", boxShadow: "0 30px 90px rgba(0,0,0,0.65)" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 380, height: 220, background: "radial-gradient(ellipse 55% 60% at 50% 0%, rgba(242,184,75,0.20), transparent 70%)", pointerEvents: "none", borderRadius: 18 }} />
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 2, height: 120, background: "linear-gradient(to bottom, rgba(242,184,75,0.55), transparent)", pointerEvents: "none" }} />

        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 14, right: 16, background: "transparent", border: "none", color: "var(--muted)", fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>

        <div style={{ position: "relative", textAlign: "center", marginBottom: 26 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{MEDAL_EMOJI}</div>
          <h2 style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', serif)", fontSize: 34, fontWeight: 400, color: "var(--text)", margin: 0, lineHeight: 1 }}>Add medals</h2>
          <p style={{ fontSize: 15, color: "var(--text-soft)", marginTop: 10 }}>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>{medals} medals</span> · yours to crown standout posts.
          </p>
        </div>

        {done ? (
          <div style={{ position: "relative", textAlign: "center", padding: "30px 0 14px" }}>
            <div style={{ fontSize: 46, marginBottom: 12 }}>{MEDAL_EMOJI}</div>
            <p style={{ fontFamily: "var(--font-serif, serif)", fontSize: 26, fontStyle: "italic", color: "var(--accent)", margin: 0 }}>{medals} medals added.</p>
            <p style={{ fontSize: 14, color: "var(--text-soft)", marginTop: 8 }}>Go crown a post.</p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <Elements stripe={stripePromise} options={{ clientSecret, appearance, fonts }}>
              <PayForm medals={medals} price={price} onPaid={handlePaid} />
            </Elements>
            <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>Secured by Stripe · No cash value · non-refundable</p>
          </div>
        )}
      </div>
    </div>
  );
}
