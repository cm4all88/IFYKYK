"use client";
import { useState } from "react";

interface Props {
  email: string;
  subscriptions: any[];
  unlocks: any[];
  earlyAccess: any[];
}

export default function AccountClient({ email, subscriptions, unlocks, earlyAccess }: Props) {
  const [subs, setSubs] = useState(subscriptions);
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function cancelSub(id: string) {
    if (!confirm("Cancel this subscription? You'll keep access until the end of your current billing period.")) return;
    setCancelling(id);
    const res = await fetch("/api/subscription/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: id }),
    });
    if (res.ok) {
      setSubs(prev => prev.map(s => s.id === id ? { ...s, status: "cancelling" } : s));
    }
    setCancelling(null);
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 120px" }}>
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Fan account</p>
        <h1 style={{ fontFamily: "Georgia,serif", fontSize: 40, fontWeight: 300, color: "#fff", lineHeight: 1.05 }}>
          Your <em style={{ color: "#F0B429" }}>subscriptions.</em>
        </h1>
      </div>

      {/* Active subscriptions */}
      <section style={{ marginBottom: 48 }}>
        <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
          Subscriptions ({subs.length})
        </p>
        {!subs.length ? (
          <div style={{ background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "32px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>You haven&apos;t subscribed to anyone yet.</p>
            <a href="/explore" style={{ display: "inline-block", marginTop: 16, color: "#F0B429", fontSize: 13, textDecoration: "none" }}>Explore creators →</a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {subs.map((s: any) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 16, background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "16px 20px" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.06)", overflow: "hidden", flexShrink: 0 }}>
                  {s.creator?.avatar_url && <img src={s.creator.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <a href={`/${s.creator?.handle}`} style={{ flex: 1, textDecoration: "none" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#F2F2F0", marginBottom: 2 }}>{s.creator?.display_name ?? s.creator?.handle}</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>@{s.creator?.handle}</p>
                </a>
                {s.status === "cancelling" ? (
                  <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(248,113,113,0.7)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "3px 10px", borderRadius: 99 }}>
                    Cancels at period end
                  </span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#34D399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", padding: "3px 10px", borderRadius: 99 }}>Active</span>
                    <button
                      onClick={() => cancelSub(s.id)}
                      disabled={cancelling === s.id}
                      style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", background: "none", border: "1px solid rgba(255,255,255,0.08)", padding: "3px 10px", borderRadius: 99, cursor: "pointer" }}
                    >
                      {cancelling === s.id ? "…" : "Cancel"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Early access passes */}
      {earlyAccess.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Early access passes ({earlyAccess.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {earlyAccess.map((e: any) => (
              <a key={e.id} href={`/${e.creator?.handle}`} style={{ display: "flex", alignItems: "center", gap: 16, background: "#111115", border: "1px solid rgba(240,180,41,0.15)", borderRadius: 8, padding: "16px 20px", textDecoration: "none" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#F2F2F0", marginBottom: 2 }}>{e.creator?.display_name ?? e.creator?.handle}</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>See posts 30 minutes early</p>
                </div>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "#F0B429", background: "rgba(240,180,41,0.08)", border: "1px solid rgba(240,180,41,0.2)", padding: "3px 10px", borderRadius: 99, letterSpacing: ".1em", textTransform: "uppercase" }}>Early Access</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Unlocked posts */}
      {unlocks.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Unlocked posts ({unlocks.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {unlocks.map((u: any) => (
              <a key={u.id} href={`/${u.post?.creator?.handle}`} style={{ display: "flex", alignItems: "center", gap: 16, background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "16px 20px", textDecoration: "none" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>@{u.post?.creator?.handle}</p>
                  <p style={{ fontSize: 14, color: "#F2F2F0" }}>{u.post?.caption?.slice(0, 80) ?? "Unlocked post"}{(u.post?.caption?.length ?? 0) > 80 ? "…" : ""}</p>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{new Date(u.created_at).toLocaleDateString()}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Account info */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 32 }}>
        <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Account</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "16px 20px" }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Signed in as</p>
            <p style={{ fontSize: 14, color: "#F2F2F0" }}>{email}</p>
          </div>
          <a href="/forgot-password" style={{ display: "block", background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "16px 20px", textDecoration: "none", color: "rgba(242,242,240,0.5)", fontSize: 14 }}>
            Change password
          </a>
          <a href="/api/auth/signout" style={{ display: "block", background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "16px 20px", textDecoration: "none", color: "rgba(248,113,113,0.8)", fontSize: 14 }}>
            Sign out
          </a>
        </div>
      </section>
    </main>
  );
}
