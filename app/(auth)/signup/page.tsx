"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

type CreatorType = "sfw" | "adult" | "young" | null;

export default function SignupPage() {
  const [step, setStep] = useState<"type" | "details" | "verify">("type");
  const [creatorType, setCreatorType] = useState<CreatorType>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorType) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { display_name: name, creator_type: creatorType },
      },
    });

    if (error) { setError(error.message); setLoading(false); return; }

    // If adult creator — redirect to ID verification
    if (creatorType === "adult") {
      router.push("/verify");
      return;
    }

    // If young creator — redirect to parent consent flow
    if (creatorType === "young") {
      router.push("/verify/parent");
      return;
    }

    router.push("/onboarding");
  };

  const TYPES = [
    { id: "sfw", emoji: "🎬", title: "Creator", desc: "Hair, fitness, food, music, photography, education — anything SFW. Stripe payments. Start at $29/mo.", color: "var(--amber)" },
    { id: "adult", emoji: "🔐", title: "18+ Creator", desc: "Adult content. CCBill payments. $29 one-time ID verification required. All features included.", color: "#c0408a" },
    { id: "young", emoji: "🌱", title: "Young Creator (13–17)", desc: "Tips-first model. Parental consent required. Maximum safety protections. No monthly fee.", color: "var(--green)" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: step === "type" ? 660 : 400 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 40 }}>
          <div style={{ width: 32, height: 32, background: "var(--amber)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff" }}>S</div>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Spotlightly</span>
        </div>

        {step === "type" && (
          <>
            <h1 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>What do you create?</h1>
            <p style={{ textAlign: "center", color: "var(--text-sec)", marginBottom: 32 }}>Choose your account type to get started.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {TYPES.map(t => (
                <button key={t.id} onClick={() => { setCreatorType(t.id); setStep("details"); }}
                  style={{ background: "var(--surface)", border: `1px solid var(--border)`, borderRadius: 16, padding: "24px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{t.emoji}</div>
                  <div style={{ color: t.color, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{t.title}</div>
                  <div style={{ color: "var(--text-sec)", fontSize: 13, lineHeight: 1.6 }}>{t.desc}</div>
                </button>
              ))}
            </div>
            <p style={{ textAlign: "center", marginTop: 20, color: "var(--text-sec)", fontSize: 14 }}>
              Already have an account? <a href="/login" style={{ color: "var(--amber)", fontWeight: 600, textDecoration: "none" }}>Sign in</a>
            </p>
          </>
        )}

        {step === "details" && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "40px" }}>
            <button onClick={() => setStep("type")} style={{ background: "none", border: "none", color: "var(--text-sec)", cursor: "pointer", marginBottom: 20, fontSize: 13 }}>← Back</button>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 24 }}>Create your account</h1>
            <form onSubmit={handleSignup}>
              {[
                { label: "Display name", value: name, setter: setName, type: "text", placeholder: "Jade Villanueva" },
                { label: "Email", value: email, setter: setEmail, type: "email", placeholder: "jade@example.com" },
                { label: "Password", value: password, setter: setPassword, type: "password", placeholder: "At least 8 characters" },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", color: "var(--text-sec)", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} required
                    style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "var(--text)", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
              {error && <div style={{ color: "#c83030", fontSize: 13, marginBottom: 14, background: "rgba(200,48,48,0.07)", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}
              <button type="submit" disabled={loading}
                style={{ width: "100%", background: "var(--amber)", border: "none", borderRadius: 10, padding: "13px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer", marginTop: 8 }}>
                {loading ? "Creating account..." : "Create account →"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
