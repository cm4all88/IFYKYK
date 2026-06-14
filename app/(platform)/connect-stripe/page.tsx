"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js";

export default function ConnectStripePage() {
  const router = useRouter();
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const [connectInstance] = useState(() => {
    if (!pk) return null;
    return loadConnectAndInitialize({
      publishableKey: pk,
      fetchClientSecret: async () => {
        const res = await fetch("/api/stripe/connect/session", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to start onboarding");
        return data.client_secret as string;
      },
    });
  });

  const handleExit = useCallback(async () => {
    try { await fetch("/api/stripe/connect/refresh", { method: "POST" }); } catch {}
    router.push("/dashboard?pane=payments&stripe=connected");
  }, [router]);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: 32, fontWeight: 400, color: "#fff", marginBottom: 8 }}>
        Set up <span style={{ color: "var(--accent, #F0B429)" }}>payouts</span>
      </h1>
      <p style={{ color: "var(--muted, #888)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Handled securely by Stripe, right here on Spotlightly. You will need your legal name, address, the last 4 of your SSN, and a bank account.
      </p>
      {!pk ? (
        <div style={{ color: "var(--red, #f87171)", fontSize: 14 }}>
          Payments are not configured yet (missing Stripe publishable key). Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in Vercel.
        </div>
      ) : connectInstance ? (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <ConnectAccountOnboarding onExit={handleExit} />
        </ConnectComponentsProvider>
      ) : (
        <div style={{ color: "var(--muted, #888)" }}>Loading…</div>
      )}
      <p style={{ marginTop: 24 }}>
        <a href="/dashboard?pane=payments" style={{ color: "var(--muted, #888)", fontSize: 13 }}>← Back to dashboard</a>
      </p>
    </div>
  );
}
