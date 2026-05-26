"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";
import { CREATOR_CATEGORIES } from "@/lib/categories";
import ImageUpload from "@/components/ImageUpload";

type Step = "stage" | "about" | "profile" | "stripe" | "done";

interface AIResponse {
  greeting: string;
  recommendations: { emoji: string; title: string; desc: string }[];
  suggestedTags: string[];
  suggestedBio: string;
  followUpAnswer?: string;
}

// ── Main page ─────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("stage");
  const [profile, setProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Stage step
  const [stageName, setStageName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // About step
  const [description, setDescription] = useState("");
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [autoFired, setAutoFired] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // Profile step
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data } = await (supabase as any)
        .from("creator_profiles")
        .select("*")
        .eq("user_id", user.id)
        .eq("kind", "spotlight")
        .maybeSingle();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? "");
        setSelectedTags(data.tags ?? []);
        setStageName(data.display_name ?? "");
        if (data.onboarding_completed_at) router.push("/dashboard");
      }
    });
  }, []);

  useEffect(() => {
    if (step === "stage" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 600);
    }
    // Auto-fire AI on about step using saved signup context
    if (step === "about" && !autoFired && !aiResponse) {
      setAutoFired(true);
      const saved = localStorage.getItem("spotlightly_creator_context");
      if (saved) {
        setDescription(saved);
        void askAI(saved);
      }
      // If no saved context, fall through — show the fallback input
    }
  }, [step]);

  async function askAI(desc?: string) {
    const text = (desc ?? description).trim();
    if (!text) return;
    setAiLoading(true);
    setErr(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: text }),
    });
    const data = await res.json();
    if (data.error) { setErr(data.error); setAiLoading(false); return; }
    setAiResponse(data);
    if (data.suggestedBio && !bio) setBio(data.suggestedBio);
    if (data.suggestedTags?.length) setSelectedTags(data.suggestedTags.slice(0, 5));
    localStorage.removeItem("spotlightly_creator_context");
    setAiLoading(false);
  }

  async function askFollowUp() {
    if (!followUp.trim() || !aiResponse) return;
    setFollowUpLoading(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, followUp, previousResponse: aiResponse }),
    });
    const data = await res.json();
    setFollowUpAnswer(data.followUpAnswer ?? data.greeting ?? "");
    setFollowUp("");
    setFollowUpLoading(false);
  }

  async function saveProfile() {
    if (!displayName.trim()) { setErr("Display name is required"); return; }
    setSaving(true);
    setErr(null);
    await (supabase as any)
      .from("creator_profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl || null,
        tags: selectedTags,
        location_city: locationCity.trim() || null,
        location_country: locationCountry.trim() || null,
        booking_url: bookingUrl.trim() || null,
        offers_services: !!bookingUrl.trim(),
      })
      .eq("id", profile.id);
    setSaving(false);
    setStep("stripe");
  }

  async function completeOnboarding() {
    await (supabase as any)
      .from("creator_profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", profile.id);
    router.push("/dashboard");
  }

  const inputBase: React.CSSProperties = {
    width: "100%",
    background: "#2A2D33",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: "12px 16px",
    color: "#F7F3EC",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.6,
  };

  const monoLabel: React.CSSProperties = {
    display: "block",
    fontFamily: "DM Mono, monospace",
    fontSize: 10,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    color: "rgba(247,243,236,0.4)",
    marginBottom: 8,
  };

  const primaryBtn = (disabled?: boolean): React.CSSProperties => ({
    width: "100%",
    background: disabled ? "rgba(242,184,75,0.3)" : "#F2B84B",
    color: "#09090C",
    fontFamily: "DM Mono, monospace",
    fontWeight: 500,
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    padding: "16px 0",
    borderRadius: 4,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s",
  });

  const ghostBtn: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    color: "rgba(247,243,236,0.35)",
    fontFamily: "DM Mono, monospace",
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    padding: "14px 0",
    borderRadius: 4,
    border: "1px solid rgba(255,255,255,0.07)",
    cursor: "pointer",
  };

  if (!mounted) return null;

  // ── STEP: STAGE ─────────────────────────────────────────────────
  if (step === "stage") {
    return (
      <main style={{
        minHeight: "100vh",
        background: "#09090C",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Hero background */}
        <div style={{
          position: "fixed", inset: 0,
          backgroundImage: "url('/hero-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: 0.07,
          pointerEvents: "none",
          zIndex: 0,
        }} />
        {/* Spotlight glow — radial only, no line */}
        <div style={{
          position: "absolute", top: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "min(600px, 80vw)", height: "70%",
          background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(242,184,75,0.12) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />
        {/* Stage floor glow */}
        <div style={{
          position: "absolute", bottom: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "60%", height: 200,
          background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(242,184,75,0.07), transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <Link href="/" style={{
          position: "absolute", top: 32, left: "50%", transform: "translateX(-50%)",
          fontFamily: "Cormorant Garamond, Georgia, serif",
          fontSize: 22, fontWeight: 300, color: "rgba(255,255,255,0.5)",
          textDecoration: "none", letterSpacing: "0.02em",
          whiteSpace: "nowrap",
        }}>
          Spot<span style={{ color: "rgba(242,184,75,0.7)" }}>light</span>ly
        </Link>

        <div style={{
          position: "relative", zIndex: 1,
          textAlign: "center",
          padding: "0 24px",
          width: "100%", maxWidth: 560,
        }}>
          <div style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: "clamp(48px, 8vw, 80px)",
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: "#fff",
            marginBottom: 8,
            minHeight: "1.1em",
            transition: "all 0.1s",
          }}>
            {stageName || (
              <span style={{ color: "rgba(255,255,255,0.12)" }}>Your name</span>
            )}
          </div>

          {/* Spotlight line under name — horizontal only, decorative */}
          <div style={{
            width: stageName ? "80%" : "40%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(242,184,75,0.6), transparent)",
            margin: "0 auto 48px",
            transition: "width 0.4s ease",
          }} />

          <p style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: 18, fontStyle: "italic",
            color: "rgba(247,243,236,0.4)",
            marginBottom: 40, lineHeight: 1.6,
          }}>
            What should the spotlight call you?
          </p>

          <input
            ref={inputRef}
            type="text"
            value={stageName}
            onChange={e => {
              setStageName(e.target.value);
              setDisplayName(e.target.value);
            }}
            onKeyDown={e => { if (e.key === "Enter" && stageName.trim()) setStep("about"); }}
            placeholder="Type your name or brand…"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "2px solid rgba(242,184,75,0.4)",
              borderRadius: "4px 4px 0 0",
              padding: "16px 20px",
              color: "#F7F3EC",
              fontSize: 18,
              outline: "none",
              fontFamily: "Cormorant Garamond, Georgia, serif",
              textAlign: "center",
              letterSpacing: "0.02em",
              marginBottom: 20,
            }}
          />

          <button
            onClick={() => { if (stageName.trim()) setStep("about"); }}
            disabled={!stageName.trim()}
            style={primaryBtn(!stageName.trim())}
          >
            Step into the spotlight →
          </button>

          {profile?.handle && (
            <p style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 10, color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.1em", marginTop: 20,
            }}>
              spotlightly.app/{profile.handle}
            </p>
          )}
        </div>
      </main>
    );
  }

  // ── STEP: ABOUT ──────────────────────────────────────────────────
  if (step === "about") {
    return (
      <main style={{
        minHeight: "100vh", background: "#17181B",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "80px 24px", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "fixed", inset: 0, backgroundImage: "url('/hero-bg.jpg')",
          backgroundSize: "cover", backgroundPosition: "center top",
          opacity: 0.05, pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{
          position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 400, height: "50%",
          background: "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(242,184,75,0.06), transparent 70%)",
          pointerEvents: "none",
        }} />

        <Link href="/" style={{
          position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)",
          fontFamily: "Cormorant Garamond, Georgia, serif",
          fontSize: 20, fontWeight: 300, color: "rgba(255,255,255,0.4)",
          textDecoration: "none", whiteSpace: "nowrap",
        }}>
          Spot<span style={{ color: "rgba(242,184,75,0.5)" }}>light</span>ly
        </Link>

        <div style={{ width: "100%", maxWidth: aiResponse ? 580 : 480, position: "relative", zIndex: 1 }}>

          {/* Loading state */}
          {aiLoading && !aiResponse && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{
                fontFamily: "Cormorant Garamond, Georgia, serif",
                fontSize: 22, fontStyle: "italic",
                color: "rgba(242,184,75,0.6)", marginBottom: 16,
              }}>
                Reading your stage…
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "rgba(242,184,75,0.4)",
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* Fallback — only shown if no saved context from signup */}
          {!aiLoading && !aiResponse && (
            <div>
              <h2 style={{
                fontFamily: "Cormorant Garamond, Georgia, serif",
                fontSize: "clamp(32px, 5vw, 48px)",
                fontWeight: 300, color: "#fff",
                lineHeight: 1.05, marginBottom: 16, textAlign: "center",
              }}>
                What do you create?
              </h2>
              <p style={{
                fontSize: 15, color: "rgba(247,243,236,0.45)",
                lineHeight: 1.8, marginBottom: 32, textAlign: "center",
              }}>
                One line is enough. We&apos;ll show you exactly how to make money on Spotlightly.
              </p>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && description.trim()) askAI(); }}
                placeholder="e.g. I'm a graphic artist"
                autoFocus
                style={{
                  width: "100%", background: "#232428",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderBottom: "2px solid rgba(242,184,75,0.3)",
                  borderRadius: "6px 6px 0 0",
                  padding: "16px 20px", color: "#F7F3EC",
                  fontSize: 16, outline: "none", fontFamily: "inherit",
                  marginBottom: 16,
                }}
              />
              {err && <p style={{ fontSize: 13, color: "#EF4444", marginBottom: 12 }}>{err}</p>}
              <button onClick={() => askAI()} disabled={!description.trim()} style={primaryBtn(!description.trim())}>
                Show me what&apos;s possible →
              </button>
            </div>
          )}

          {/* Recommendations */}
          {aiResponse && (
            <div>
              <div style={{
                borderLeft: "2px solid rgba(242,184,75,0.5)",
                background: "rgba(242,184,75,0.06)",
                padding: "20px 24px", borderRadius: "0 6px 6px 0", marginBottom: 24,
              }}>
                <p style={{ fontSize: 15, color: "rgba(247,243,236,0.85)", lineHeight: 1.8, margin: 0 }}>
                  {aiResponse.greeting}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                {aiResponse.recommendations.map((rec, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 16,
                    background: "#232428", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 6, padding: "16px 20px",
                    animation: `fadeUp 0.3s ease ${i * 0.08}s both`,
                  }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{rec.emoji}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{rec.title}</p>
                      <p style={{ fontSize: 13, color: "rgba(247,243,236,0.5)", lineHeight: 1.65, margin: 0 }}>{rec.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {followUpAnswer && (
                <div style={{
                  borderLeft: "2px solid rgba(168,85,247,0.5)",
                  background: "rgba(168,85,247,0.06)",
                  padding: "16px 20px", borderRadius: "0 6px 6px 0", marginBottom: 20,
                }}>
                  <p style={{ fontSize: 14, color: "rgba(247,243,236,0.8)", lineHeight: 1.75, margin: 0 }}>{followUpAnswer}</p>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input
                  type="text"
                  placeholder="Any questions? Ask anything…"
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") askFollowUp(); }}
                  style={{ ...inputBase, flex: 1, background: "#232428", fontSize: 13 }}
                />
                <button onClick={askFollowUp} disabled={followUpLoading || !followUp.trim()} style={{
                  background: "#2A2D33", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 4, padding: "0 18px",
                  color: "rgba(255,255,255,0.5)", fontFamily: "DM Mono, monospace",
                  fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer", flexShrink: 0,
                  opacity: followUpLoading || !followUp.trim() ? 0.45 : 1,
                }}>
                  {followUpLoading ? "…" : "Ask"}
                </button>
              </div>

              <button onClick={() => setStep("profile")} style={primaryBtn()}>
                Let&apos;s build your page →
              </button>
            </div>
          )}

          <button onClick={() => setStep("stage")} style={{
            marginTop: 20, background: "none", border: "none",
            color: "rgba(255,255,255,0.2)", cursor: "pointer",
            fontFamily: "DM Mono, monospace", fontSize: 10,
            letterSpacing: "0.12em", textTransform: "uppercase",
            display: "block", width: "100%", textAlign: "center",
          }}>
            ← Back
          </button>
        </div>

        <style>{`
          @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
          @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
        `}</style>
      </main>
    );
  }

  // ── STEP: PROFILE ────────────────────────────────────────────────
  if (step === "profile") {
    return (
      <main className="onb-grid" style={{
        minHeight: "100vh",
        background: "#17181B",
        position: "relative",
      }}>
        <style>{`
          .onb-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          @media (max-width: 768px) {
            .onb-grid { grid-template-columns: 1fr !important; }
            .onb-preview { display: none !important; }
            .onb-form { border-right: none !important; padding: 32px 24px 60px !important; }
          }
          @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        `}</style>

        {/* Hero background */}
        <div style={{
          position: "fixed", inset: 0,
          backgroundImage: "url('/hero-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: 0.04,
          pointerEvents: "none",
          zIndex: 0,
        }} />

        {/* Left — form */}
        <div
          className="onb-form"
          style={{
            padding: "48px 48px 80px",
            overflowY: "auto",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            maxHeight: "100vh",
            position: "relative",
            zIndex: 1,
          }}
        >
          <Link href="/" style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: 20, fontWeight: 300, color: "rgba(255,255,255,0.4)",
            textDecoration: "none", display: "block", marginBottom: 40,
          }}>
            Spot<span style={{ color: "rgba(242,184,75,0.5)" }}>light</span>ly
          </Link>

          <span style={{
            fontFamily: "DM Mono, monospace", fontSize: 9,
            letterSpacing: "0.2em", textTransform: "uppercase",
            color: "rgba(247,243,236,0.3)", display: "block", marginBottom: 12,
          }}>
            Building your page
          </span>
          <h2 style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: 36, fontWeight: 300, color: "#fff",
            marginBottom: 8, lineHeight: 1.05,
          }}>
            Make it yours.
          </h2>
          <p style={{ fontSize: 14, color: "rgba(247,243,236,0.4)", marginBottom: 36, lineHeight: 1.7 }}>
            Your audience sees this the moment they arrive.
          </p>

          {/* Avatar */}
          <div style={{ marginBottom: 28 }}>
            <label style={monoLabel}>Profile photo</label>
            <ImageUpload value={avatarUrl} onChange={setAvatarUrl} shape="circle"
              label="Upload photo" hint="JPG, PNG or WebP · Square works best" />
          </div>

          {/* Display name */}
          <div style={{ marginBottom: 16 }}>
            <label style={monoLabel}>Display name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name or brand" style={inputBase} autoFocus />
          </div>

          {/* Bio */}
          <div style={{ marginBottom: 20 }}>
            <label style={monoLabel}>Bio <span style={{ color: "rgba(255,255,255,0.15)" }}>(optional)</span></label>
            <textarea value={bio} onChange={e => setBio(e.target.value)}
              placeholder="Tell your audience who you are..." rows={3} maxLength={300}
              style={{ ...inputBase, resize: "none" }} />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 20 }}>
            <label style={monoLabel}>Categories <span style={{ color: "rgba(255,255,255,0.15)" }}>(up to 5)</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(CREATOR_CATEGORIES as readonly { id: string; label: string; emoji: string }[])
                .filter(c => c.id !== "adult")
                .map(cat => {
                  const active = selectedTags.includes(cat.id);
                  return (
                    <button key={cat.id} type="button" onClick={() => {
                      if (active) setSelectedTags(p => p.filter(t => t !== cat.id));
                      else if (selectedTags.length < 5) setSelectedTags(p => [...p, cat.id]);
                    }} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 4, border: "1px solid",
                      cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                      background: active ? "rgba(242,184,75,0.1)" : "#2A2D33",
                      color: active ? "#F2B84B" : "rgba(247,243,236,0.4)",
                      borderColor: active ? "rgba(242,184,75,0.35)" : "rgba(255,255,255,0.07)",
                      transition: "all 0.12s",
                    }}>
                      {cat.emoji} {cat.label}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Location */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={monoLabel}>City</label>
              <input type="text" value={locationCity} onChange={e => setLocationCity(e.target.value)}
                placeholder="Seattle" style={inputBase} />
            </div>
            <div>
              <label style={monoLabel}>Country</label>
              <input type="text" value={locationCountry} onChange={e => setLocationCountry(e.target.value)}
                placeholder="USA" style={inputBase} />
            </div>
          </div>

          {/* Booking */}
          <div style={{ marginBottom: 36 }}>
            <label style={monoLabel}>Booking link <span style={{ color: "rgba(255,255,255,0.15)" }}>(optional)</span></label>
            <input type="url" value={bookingUrl} onChange={e => setBookingUrl(e.target.value)}
              placeholder="https://calendly.com/you"
              style={{ ...inputBase, fontFamily: "DM Mono, monospace", fontSize: 12 }} />
            <p style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6, letterSpacing: "0.04em" }}>
              Hairdressers, trainers, coaches — fans book directly from your page.
            </p>
          </div>

          {err && <p style={{ fontSize: 13, color: "#EF4444", marginBottom: 16 }}>{err}</p>}

          <button onClick={saveProfile} disabled={saving || !displayName.trim()}
            style={primaryBtn(saving || !displayName.trim())}>
            {saving ? "Saving…" : "Save and continue →"}
          </button>

          <button onClick={() => setStep("stage")} style={{ ...ghostBtn, marginTop: 10 }}>
            ← Back
          </button>
        </div>

        {/* Right — live preview (desktop only) */}
        <div className="onb-preview" style={{
          padding: "48px 40px",
          display: "flex",
          flexDirection: "column",
          maxHeight: "100vh",
          overflow: "hidden",
        }}>
          <div style={{
            fontFamily: "DM Mono, monospace", fontSize: 9,
            letterSpacing: "0.2em", textTransform: "uppercase",
            color: "rgba(247,243,236,0.2)", marginBottom: 16, textAlign: "center",
          }}>
            Live preview
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <PagePreview
              handle={profile?.handle || ""}
              displayName={displayName}
              bio={bio}
              avatarUrl={avatarUrl}
              tags={selectedTags}
            />
          </div>
        </div>
      </main>
    );
  }

  // ── STEP: STRIPE ─────────────────────────────────────────────────
  if (step === "stripe") {
    return (
      <main style={{
        minHeight: "100vh", background: "#17181B",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "80px 24px", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "fixed", inset: 0,
          backgroundImage: "url('/hero-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: 0.05,
          pointerEvents: "none",
          zIndex: 0,
        }} />
        <div style={{
          position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 400, height: "50%",
          background: "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(242,184,75,0.05), transparent 70%)",
          pointerEvents: "none",
        }} />

        <Link href="/" style={{
          position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)",
          fontFamily: "Cormorant Garamond, Georgia, serif",
          fontSize: 20, fontWeight: 300, color: "rgba(255,255,255,0.4)",
          textDecoration: "none", whiteSpace: "nowrap",
        }}>
          Spot<span style={{ color: "rgba(242,184,75,0.5)" }}>light</span>ly
        </Link>

        <div style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}>
          <span style={{
            fontFamily: "DM Mono, monospace", fontSize: 9,
            letterSpacing: "0.2em", textTransform: "uppercase",
            color: "rgba(247,243,236,0.3)", display: "block",
            marginBottom: 12, textAlign: "center",
          }}>
            Almost there
          </span>
          <h2 style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: 44, fontWeight: 300, color: "#fff",
            marginBottom: 8, lineHeight: 1.05, textAlign: "center",
          }}>
            Open the box office.
          </h2>
          <p style={{
            fontSize: 15, color: "rgba(247,243,236,0.45)",
            lineHeight: 1.8, marginBottom: 36, textAlign: "center",
          }}>
            Connect Stripe so your audience can subscribe and pay you directly. Takes 2 minutes.
          </p>

          <div style={{
            borderLeft: "2px solid rgba(242,184,75,0.4)",
            background: "rgba(242,184,75,0.06)",
            padding: "18px 22px", borderRadius: "0 6px 6px 0", marginBottom: 28,
          }}>
            <p style={{ fontSize: 14, color: "rgba(247,243,236,0.75)", lineHeight: 1.75, margin: 0 }}>
              Spotlightly takes <strong style={{ color: "#fff" }}>0%</strong> of your subscription revenue.
              You keep everything. Stripe charges their standard 2.9% + 30¢.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a href="/api/stripe/connect/start" style={{
              display: "block", textAlign: "center",
              background: "#F2B84B", color: "#09090C",
              fontFamily: "DM Mono, monospace", fontWeight: 500,
              fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
              padding: "16px 0", borderRadius: 4, textDecoration: "none",
            }}>
              Connect Stripe →
            </a>
            <button onClick={() => setStep("done")} style={ghostBtn}>
              Skip for now
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── STEP: DONE ───────────────────────────────────────────────────
  if (step === "done") {
    return (
      <main style={{
        minHeight: "100vh",
        background: "#09090C",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        padding: "24px",
      }}>
        <div style={{
          position: "fixed", inset: 0,
          backgroundImage: "url('/hero-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: 0,
        }} />
        {/* Glow only — no line */}
        <div style={{
          position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
          width: "min(700px, 90vw)", height: "65%",
          background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(242,184,75,0.14) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "50%", height: 160,
          background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(242,184,75,0.08), transparent)",
          pointerEvents: "none",
        }} />

        <div style={{
          position: "relative", zIndex: 1,
          textAlign: "center", maxWidth: 520,
          animation: "fadeUp 0.6s ease both",
        }}>
          <div style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: 14, fontStyle: "italic",
            color: "rgba(242,184,75,0.6)",
            marginBottom: 24, letterSpacing: "0.05em",
          }}>
            You&apos;re live.
          </div>

          <div style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: "clamp(52px, 9vw, 88px)",
            fontWeight: 300, color: "#fff",
            lineHeight: 1, letterSpacing: "-0.02em",
            marginBottom: 16,
          }}>
            {displayName || "You're live."}
          </div>

          <div style={{
            width: "60%", height: 1, margin: "0 auto 32px",
            background: "linear-gradient(90deg, transparent, rgba(242,184,75,0.5), transparent)",
          }} />

          <p style={{
            fontSize: 16, color: "rgba(247,243,236,0.45)",
            lineHeight: 1.8, marginBottom: 32,
          }}>
            Your Spotlightly page is ready. Share your link and start building your audience.
          </p>

          {profile && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 16,
              background: "rgba(242,184,75,0.07)",
              border: "1px solid rgba(242,184,75,0.2)",
              borderRadius: 6, padding: "14px 24px", marginBottom: 36,
            }}>
              <span style={{
                fontFamily: "DM Mono, monospace", fontSize: 13,
                color: "#F2B84B", letterSpacing: "0.06em",
              }}>
                spotlightly.app/{profile.handle}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(`https://spotlightly.app/${profile.handle}`)}
                style={{
                  background: "none", border: "none",
                  color: "rgba(242,184,75,0.5)", cursor: "pointer",
                  fontFamily: "DM Mono, monospace", fontSize: 10,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                }}
              >
                Copy
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "0 auto" }}>
            <button onClick={completeOnboarding} style={{
              background: "#F2B84B", color: "#09090C",
              fontFamily: "DM Mono, monospace", fontWeight: 500,
              fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
              padding: "16px 0", borderRadius: 4, border: "none", cursor: "pointer",
            }}>
              Go to my dashboard →
            </button>
            {profile && (
              <a href={`/${profile.handle}`} target="_blank" rel="noopener noreferrer" style={{
                display: "block", textAlign: "center",
                background: "transparent", color: "rgba(247,243,236,0.35)",
                fontFamily: "DM Mono, monospace", fontSize: 10,
                letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "14px 0", borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.07)",
                textDecoration: "none",
              }}>
                Preview my page ↗
              </a>
            )}
          </div>
        </div>

        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
      </main>
    );
  }

  return null;
}

// ── Live page preview (desktop only, profile step) ─────────────────
function PagePreview({ handle, displayName, bio, avatarUrl, tags }: {
  handle: string; displayName: string; bio: string;
  avatarUrl: string; tags: string[];
}) {
  const cats = (CREATOR_CATEGORIES as readonly { id: string; label: string; emoji: string }[]);
  return (
    <div style={{
      background: "#17181B",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 8,
      overflow: "hidden",
      height: "100%",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Mini browser bar */}
      <div style={{
        background: "#111115",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#EF4444","#F0B429","#34D399"].map(c => (
            <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.5 }} />
          ))}
        </div>
        <div style={{
          flex: 1, background: "#17181B", borderRadius: 3,
          padding: "4px 10px", fontFamily: "DM Mono, monospace",
          fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em",
        }}>
          spotlightly.app/{handle || "your-handle"}
        </div>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 24px" }}>
        <div style={{
          height: 100,
          background: "linear-gradient(135deg, #1c1c22 0%, #232428 100%)",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 80% 120% at 50% -20%, rgba(242,184,75,0.12), transparent 60%)",
          }} />
        </div>

        <div style={{ padding: "0 20px", marginTop: -28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: avatarUrl ? "transparent" : "rgba(242,184,75,0.15)",
            border: "2px solid #17181B",
            overflow: "hidden",
            marginBottom: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 20, opacity: 0.4 }}>✦</span>
            }
          </div>

          <div style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: 20, fontWeight: 400, color: "#fff",
            marginBottom: 4, lineHeight: 1.1,
            minHeight: 24,
          }}>
            {displayName || <span style={{ color: "rgba(255,255,255,0.15)" }}>Your name</span>}
          </div>

          <div style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 10, color: "rgba(242,184,75,0.6)",
            letterSpacing: "0.08em", marginBottom: 10,
          }}>
            @{handle || "your-handle"}
          </div>

          {bio ? (
            <p style={{
              fontSize: 12, color: "rgba(242,242,240,0.55)",
              lineHeight: 1.65, marginBottom: 12,
              maxHeight: 60, overflow: "hidden",
            }}>
              {bio}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.1)", marginBottom: 12, fontStyle: "italic" }}>
              Your bio will appear here
            </p>
          )}

          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
              {tags.slice(0, 4).map(t => {
                const cat = cats.find(c => c.id === t);
                return cat ? (
                  <span key={t} style={{
                    fontFamily: "DM Mono, monospace", fontSize: 9,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    padding: "3px 8px", borderRadius: 3,
                    background: "rgba(242,184,75,0.08)",
                    border: "1px solid rgba(242,184,75,0.15)",
                    color: "rgba(242,184,75,0.7)",
                  }}>
                    {cat.emoji} {cat.label}
                  </span>
                ) : null;
              })}
            </div>
          )}

          <div style={{
            background: "rgba(242,184,75,0.12)",
            border: "1px solid rgba(242,184,75,0.2)",
            borderRadius: 4,
            padding: "10px 0",
            textAlign: "center",
            fontFamily: "DM Mono, monospace",
            fontSize: 10, letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(242,184,75,0.7)",
            marginBottom: 16,
          }}>
            Subscribe
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 4, padding: "10px 12px",
                opacity: 1 - (i * 0.2),
              }}>
                <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 6, width: `${80 - i * 15}%` }} />
                <div style={{ height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 2, width: "60%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
