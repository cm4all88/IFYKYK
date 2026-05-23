"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";
import { CREATOR_CATEGORIES } from "@/lib/categories";
import ImageUpload from "@/components/ImageUpload";

type Step = "welcome" | "about" | "profile" | "stripe" | "done";

interface AIResponse {
  greeting: string;
  recommendations: { emoji: string; title: string; desc: string }[];
  suggestedTags: string[];
  suggestedBio: string;
  followUpAnswer?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("welcome");
  const [profile, setProfile] = useState<any>(null);

  // About step
  const [description, setDescription] = useState("");
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
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

  // Load profile on mount
  useState(() => {
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
        if (data.onboarding_completed_at) router.push("/dashboard");
      }
    });
  });

  async function askAI() {
    if (!description.trim()) return;
    setAiLoading(true);
    setErr(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    const data = await res.json();
    if (data.error) { setErr(data.error); setAiLoading(false); return; }
    setAiResponse(data);
    // Pre-fill profile from AI suggestions
    if (data.suggestedBio && !bio) setBio(data.suggestedBio);
    if (data.suggestedTags?.length) setSelectedTags(data.suggestedTags.slice(0, 5));
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

  const steps: Step[] = ["welcome", "about", "profile", "stripe", "done"];
  const stepIdx = steps.indexOf(step);
  const progressLabels = ["About you", "Profile", "Connect Stripe", "Done"];

  return (
    <main style={{ minHeight:"100vh", background:"#09090C", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", padding:"40px 24px 80px" }}>
      <Link href="/" style={{ fontFamily:"Georgia,serif", fontSize:24, color:"#fff", textDecoration:"none", marginBottom:40 }}>
        Spot<span style={{ color:"#F0B429" }}>light</span>ly
      </Link>

      {/* Progress */}
      {step !== "welcome" && (
        <div style={{ display:"flex", gap:8, marginBottom:40, alignItems:"center", flexWrap:"wrap", justifyContent:"center" }}>
          {progressLabels.map((label, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{
                width:28, height:28, borderRadius:"50%",
                background: stepIdx > i + 1 || stepIdx === i + 1 ? "#F0B429" : "rgba(255,255,255,0.06)",
                border: stepIdx === i + 1 ? "2px solid #F0B429" : "2px solid rgba(255,255,255,0.1)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:700,
                color: stepIdx >= i + 1 ? "#09090C" : "rgba(255,255,255,0.3)",
              }}>
                {stepIdx > i + 1 ? "✓" : i + 1}
              </div>
              <span style={{ fontSize:12, color: stepIdx === i + 1 ? "#fff" : "rgba(255,255,255,0.3)" }}>{label}</span>
              {i < progressLabels.length - 1 && <div style={{ width:28, height:1, background:"rgba(255,255,255,0.1)" }} />}
            </div>
          ))}
        </div>
      )}

      <div style={{ width:"100%", maxWidth: step === "about" && aiResponse ? 600 : 480 }}>
        <div style={{ background:"#111115", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"48px 44px" }}>

          {/* WELCOME */}
          {step === "welcome" && (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:20 }}>✦</div>
              <h1 style={{ fontFamily:"Georgia,serif", fontSize:32, fontWeight:300, color:"#fff", marginBottom:12, lineHeight:1.1 }}>
                Your stage is ready.
              </h1>
              <p style={{ fontSize:15, color:"rgba(242,242,240,0.55)", lineHeight:1.75, marginBottom:32 }}>
                Let&apos;s get your Spotlightly page live in 3 minutes. First — tell us what you do and we&apos;ll show you exactly how to make the most of it.
              </p>
              {profile && (
                <p style={{ fontFamily:"monospace", fontSize:12, color:"#F0B429", marginBottom:32 }}>
                  spotlightly.app/{profile.handle}
                </p>
              )}
              <button onClick={() => setStep("about")} style={{ width:"100%", background:"#F0B429", color:"#09090C", fontWeight:700, fontSize:14, padding:"14px 0", borderRadius:999, border:"none", cursor:"pointer" }}>
                Let&apos;s go →
              </button>
            </div>
          )}

          {/* ABOUT — AI advisor */}
          {step === "about" && !aiResponse && (
            <div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:28, fontWeight:300, color:"#fff", marginBottom:8 }}>
                What do you do?
              </h2>
              <p style={{ fontSize:13, color:"rgba(242,242,240,0.45)", marginBottom:28, lineHeight:1.65 }}>
                Tell us in your own words. We&apos;ll show you exactly how Spotlightly can work for you.
              </p>

              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAI(); }}}
                placeholder={"e.g. I'm a hairdresser and I post styling tips on Instagram\n\ne.g. I make electronic music and want to release exclusive tracks\n\ne.g. I'm a personal trainer who does online coaching"}
                rows={5}
                style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"14px 16px", color:"#F2F2F0", fontSize:14, outline:"none", resize:"none", fontFamily:"inherit", lineHeight:1.6, marginBottom:16 }}
              />

              {err && <p style={{ fontSize:13, color:"#F87171", marginBottom:12 }}>{err}</p>}

              <button onClick={askAI} disabled={aiLoading || !description.trim()} style={{ width:"100%", background:"#F0B429", color:"#09090C", fontWeight:700, fontSize:14, padding:"14px 0", borderRadius:999, border:"none", cursor:"pointer", opacity:aiLoading || !description.trim() ? 0.5 : 1 }}>
                {aiLoading ? "Working it out…" : "Show me what Spotlightly can do →"}
              </button>
            </div>
          )}

          {/* ABOUT — AI response */}
          {step === "about" && aiResponse && (
            <div>
              {/* Greeting */}
              <div style={{ background:"rgba(240,180,41,0.06)", border:"1px solid rgba(240,180,41,0.15)", borderRadius:10, padding:"20px 24px", marginBottom:24 }}>
                <p style={{ fontSize:14, color:"rgba(242,242,240,0.85)", lineHeight:1.75 }}>{aiResponse.greeting}</p>
              </div>

              {/* Recommendations */}
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:28 }}>
                {aiResponse.recommendations.map((rec, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"14px 16px" }}>
                    <span style={{ fontSize:22, flexShrink:0, marginTop:1 }}>{rec.emoji}</span>
                    <div>
                      <p style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:3 }}>{rec.title}</p>
                      <p style={{ fontSize:13, color:"rgba(242,242,240,0.5)", lineHeight:1.6 }}>{rec.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Follow-up answer */}
              {followUpAnswer && (
                <div style={{ background:"rgba(192,132,252,0.06)", border:"1px solid rgba(192,132,252,0.15)", borderRadius:10, padding:"16px 20px", marginBottom:20 }}>
                  <p style={{ fontSize:13, color:"rgba(242,242,240,0.8)", lineHeight:1.75 }}>{followUpAnswer}</p>
                </div>
              )}

              {/* Follow-up input */}
              <div style={{ display:"flex", gap:10, marginBottom:24 }}>
                <input
                  type="text"
                  placeholder="Anything else? Ask me anything…"
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") askFollowUp(); }}
                  style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:999, padding:"10px 16px", color:"#F2F2F0", fontSize:13, outline:"none", fontFamily:"inherit" }}
                />
                <button onClick={askFollowUp} disabled={followUpLoading || !followUp.trim()} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:999, padding:"10px 16px", color:"rgba(255,255,255,0.7)", fontSize:13, cursor:"pointer", flexShrink:0 }}>
                  {followUpLoading ? "…" : "Ask"}
                </button>
              </div>

              <button onClick={() => setStep("profile")} style={{ width:"100%", background:"#F0B429", color:"#09090C", fontWeight:700, fontSize:14, padding:"14px 0", borderRadius:999, border:"none", cursor:"pointer" }}>
                Got it — set up my profile →
              </button>
            </div>
          )}

          {/* PROFILE */}
          {step === "profile" && (
            <div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:28, fontWeight:300, color:"#fff", marginBottom:8 }}>Set up your profile</h2>
              <p style={{ fontSize:13, color:"rgba(242,242,240,0.45)", marginBottom:28, lineHeight:1.6 }}>
                This is what fans see when they visit your page. We&apos;ve pre-filled some of it based on what you told us.
              </p>

              {/* Avatar */}
              <div style={{ marginBottom:24 }}>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:10, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>Profile photo</label>
                <ImageUpload value={avatarUrl} onChange={setAvatarUrl} shape="circle" label="Upload photo" hint="JPG, PNG or WebP · Square images work best" />
              </div>

              {/* Display name */}
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:6, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>Display name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name or brand"
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"12px 16px", color:"#F2F2F0", fontSize:14, outline:"none" }} />
              </div>

              {/* Bio */}
              <div style={{ marginBottom:20 }}>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:6, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>Bio <span style={{ color:"rgba(255,255,255,0.2)" }}>(optional)</span></label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell fans who you are..." rows={3} maxLength={300}
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"12px 16px", color:"#F2F2F0", fontSize:14, outline:"none", resize:"none", fontFamily:"inherit" }} />
                {aiResponse?.suggestedBio && (
                  <p style={{ fontSize:11, color:"rgba(240,180,41,0.5)", marginTop:4 }}>✦ Pre-filled based on your description — edit freely</p>
                )}
              </div>

              {/* Tags */}
              <div style={{ marginBottom:20 }}>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:10, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>
                  Categories <span style={{ color:"rgba(255,255,255,0.2)" }}>(up to 5)</span>
                </label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {(CREATOR_CATEGORIES as readonly { id: string; label: string; emoji: string }[])
                    .filter(c => c.id !== "adult")
                    .map(cat => {
                      const active = selectedTags.includes(cat.id);
                      return (
                        <button key={cat.id} type="button" onClick={() => {
                          if (active) setSelectedTags(prev => prev.filter(t => t !== cat.id));
                          else if (selectedTags.length < 5) setSelectedTags(prev => [...prev, cat.id]);
                        }} style={{
                          display:"flex", alignItems:"center", gap:6,
                          padding:"6px 12px", borderRadius:999, border:"1px solid", cursor:"pointer", fontSize:12,
                          background: active ? "rgba(240,180,41,0.12)" : "rgba(255,255,255,0.04)",
                          color: active ? "#F0B429" : "rgba(242,242,240,0.45)",
                          borderColor: active ? "rgba(240,180,41,0.3)" : "rgba(255,255,255,0.1)",
                        }}>
                          {cat.emoji} {cat.label}
                        </button>
                      );
                    })}
                </div>
                {aiResponse?.suggestedTags?.length ? (
                  <p style={{ fontSize:11, color:"rgba(240,180,41,0.5)", marginTop:8 }}>✦ Tags pre-selected based on what you do — adjust as needed</p>
                ) : null}
              </div>

              {/* Location */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:6, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>City</label>
                  <input type="text" value={locationCity} onChange={e => setLocationCity(e.target.value)} placeholder="Seattle"
                    style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#F2F2F0", fontSize:14, outline:"none" }} />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:6, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>Country</label>
                  <input type="text" value={locationCountry} onChange={e => setLocationCountry(e.target.value)} placeholder="USA"
                    style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#F2F2F0", fontSize:14, outline:"none" }} />
                </div>
              </div>

              {/* Booking URL */}
              <div style={{ marginBottom:24 }}>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:6, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>
                  Booking link <span style={{ color:"rgba(255,255,255,0.2)" }}>(optional)</span>
                </label>
                <input type="url" value={bookingUrl} onChange={e => setBookingUrl(e.target.value)}
                  placeholder="https://calendly.com/you — Booksy, Square, Acuity, any platform"
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"12px 16px", color:"#F2F2F0", fontSize:13, outline:"none", fontFamily:"monospace" }} />
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:4 }}>Hairdressers, trainers, coaches — fans can book directly from your page.</p>
              </div>

              {err && <p style={{ fontSize:13, color:"#F87171", marginBottom:16 }}>{err}</p>}
              <button onClick={saveProfile} disabled={saving || !displayName.trim()} style={{ width:"100%", background:"#F0B429", color:"#09090C", fontWeight:700, fontSize:14, padding:"14px 0", borderRadius:999, border:"none", cursor:"pointer", opacity:saving || !displayName.trim() ? 0.5 : 1 }}>
                {saving ? "Saving…" : "Save and continue →"}
              </button>
            </div>
          )}

          {/* STRIPE */}
          {step === "stripe" && (
            <div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:28, fontWeight:300, color:"#fff", marginBottom:8 }}>Connect Stripe</h2>
              <p style={{ fontSize:13, color:"rgba(242,242,240,0.45)", marginBottom:28, lineHeight:1.65 }}>
                Connect your Stripe account so fans can subscribe and send you money. Takes about 2 minutes.
              </p>
              <div style={{ background:"rgba(240,180,41,0.06)", border:"1px solid rgba(240,180,41,0.15)", borderRadius:8, padding:"18px 22px", marginBottom:24 }}>
                <p style={{ fontSize:13, color:"rgba(242,242,240,0.7)", lineHeight:1.65, margin:0 }}>
                  Spotlightly takes <strong style={{ color:"#fff" }}>0%</strong> of your subscription revenue. You keep everything. Stripe charges their standard processing fee (2.9% + 30¢).
                </p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <a href="/api/stripe/connect/start" style={{ display:"block", textAlign:"center", background:"#F0B429", color:"#09090C", fontWeight:700, fontSize:14, padding:"14px 0", borderRadius:999, textDecoration:"none" }}>
                  Connect Stripe →
                </a>
                <button onClick={() => setStep("done")} style={{ width:"100%", background:"transparent", color:"rgba(242,242,240,0.4)", fontWeight:500, fontSize:13, padding:"12px 0", borderRadius:999, border:"1px solid rgba(255,255,255,0.08)", cursor:"pointer" }}>
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* DONE */}
          {step === "done" && (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:20 }}>🎉</div>
              <h1 style={{ fontFamily:"Georgia,serif", fontSize:32, fontWeight:300, color:"#fff", marginBottom:12, lineHeight:1.1 }}>You&apos;re live.</h1>
              <p style={{ fontSize:15, color:"rgba(242,242,240,0.6)", lineHeight:1.75, marginBottom:12 }}>
                Your Spotlightly page is ready. Share your link and start building your audience.
              </p>
              {profile && (
                <div style={{ background:"rgba(240,180,41,0.08)", border:"1px solid rgba(240,180,41,0.2)", borderRadius:8, padding:"12px 20px", marginBottom:32, display:"inline-flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontFamily:"monospace", fontSize:14, color:"#F0B429" }}>spotlightly.app/{profile.handle}</span>
                  <button onClick={() => navigator.clipboard.writeText(`https://spotlightly.app/${profile.handle}`)} style={{ background:"none", border:"none", color:"rgba(240,180,41,0.6)", cursor:"pointer", fontSize:12 }}>Copy</button>
                </div>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button onClick={completeOnboarding} style={{ width:"100%", background:"#F0B429", color:"#09090C", fontWeight:700, fontSize:14, padding:"14px 0", borderRadius:999, border:"none", cursor:"pointer" }}>
                  Go to my dashboard →
                </button>
                {profile && (
                  <a href={`/${profile.handle}`} target="_blank" rel="noopener noreferrer" style={{ display:"block", textAlign:"center", background:"transparent", color:"rgba(242,242,240,0.5)", fontWeight:500, fontSize:13, padding:"12px 0", borderRadius:999, border:"1px solid rgba(255,255,255,0.08)", textDecoration:"none" }}>
                    Preview my page ↗
                  </a>
                )}
                <a href="/gear" style={{ display:"block", textAlign:"center", color:"rgba(240,180,41,0.5)", fontSize:12, padding:"8px 0", textDecoration:"none" }}>
                  📦 Need gear? See our creator setup guide →
                </a>
              </div>
            </div>
          )}
        </div>

        {step !== "welcome" && step !== "done" && step !== "about" && (
          <button onClick={() => setStep(steps[stepIdx - 1])} style={{ marginTop:20, background:"none", border:"none", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:13, display:"block", width:"100%", textAlign:"center" }}>
            ← Back
          </button>
        )}
        {step === "about" && aiResponse && (
          <button onClick={() => { setAiResponse(null); setDescription(""); }} style={{ marginTop:20, background:"none", border:"none", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:13, display:"block", width:"100%", textAlign:"center" }}>
            ← Start over
          </button>
        )}
      </div>
    </main>
  );
}
