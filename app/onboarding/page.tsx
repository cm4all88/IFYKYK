"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";
import { CREATOR_CATEGORIES } from "@/lib/categories";

type Step = "welcome" | "profile" | "stripe" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("welcome");
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        if (data.onboarding_completed_at) router.push("/dashboard");
      }
    });
  });

  async function uploadAvatar(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setAvatarUrl(data.url);
    setUploading(false);
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

  const steps: Step[] = ["welcome", "profile", "stripe", "done"];
  const stepIdx = steps.indexOf(step);

  return (
    <main style={{ minHeight:"100vh", background:"#09090C", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
      <Link href="/" style={{ fontFamily:"Georgia,serif", fontSize:24, color:"#fff", textDecoration:"none", marginBottom:48 }}>
        Spot<span style={{ color:"#F0B429" }}>light</span>ly
      </Link>

      {/* Progress bar */}
      <div style={{ display:"flex", gap:8, marginBottom:48, alignItems:"center" }}>
        {["Profile", "Connect Stripe", "Done"].map((label, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{
              width:28, height:28, borderRadius:"50%",
              background: stepIdx > i+1 || (stepIdx === i+1) ? "#F0B429" : "rgba(255,255,255,0.06)",
              border: stepIdx === i+1 ? "2px solid #F0B429" : "2px solid rgba(255,255,255,0.1)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:11, fontWeight:700,
              color: stepIdx >= i+1 ? "#09090C" : "rgba(255,255,255,0.3)",
            }}>
              {stepIdx > i+1 ? "✓" : i+1}
            </div>
            <span style={{ fontSize:12, color: stepIdx === i+1 ? "#fff" : "rgba(255,255,255,0.3)" }}>{label}</span>
            {i < 2 && <div style={{ width:32, height:1, background:"rgba(255,255,255,0.1)" }} />}
          </div>
        ))}
      </div>

      <div style={{ background:"#111115", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"48px 44px", width:"100%", maxWidth:480 }}>

        {step === "welcome" && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:20 }}>✦</div>
            <h1 style={{ fontFamily:"Georgia,serif", fontSize:32, fontWeight:300, color:"#fff", marginBottom:12, lineHeight:1.1 }}>Your stage is ready.</h1>
            <p style={{ fontSize:15, color:"rgba(242,242,240,0.6)", lineHeight:1.75, marginBottom:12 }}>
              Let&apos;s get your Spotlightly page set up in 2 minutes.
            </p>
            {profile && (
              <p style={{ fontFamily:"monospace", fontSize:12, color:"#F0B429", marginBottom:32 }}>
                spotlightly.app/{profile.handle}
              </p>
            )}
            <button onClick={() => setStep("profile")} style={{ width:"100%", background:"#F0B429", color:"#09090C", fontWeight:700, fontSize:14, padding:"14px 0", borderRadius:999, border:"none", cursor:"pointer" }}>
              Let&apos;s go →
            </button>
          </div>
        )}

        {step === "profile" && (
          <div>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:28, fontWeight:300, color:"#fff", marginBottom:8 }}>Set up your profile</h2>
            <p style={{ fontSize:13, color:"rgba(242,242,240,0.5)", marginBottom:28, lineHeight:1.6 }}>This is what fans see when they visit your page.</p>

            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
              <div onClick={() => fileRef.current?.click()} style={{ width:72, height:72, borderRadius:"50%", background:avatarUrl?"transparent":"rgba(255,255,255,0.06)", border:"2px dashed rgba(255,255,255,0.15)", cursor:"pointer", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {avatarUrl ? <img src={avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:24 }}>{uploading ? "⏳" : "+"}</span>}
              </div>
              <div>
                <p style={{ fontSize:13, color:"#fff", fontWeight:600, marginBottom:4 }}>Profile photo</p>
                <p style={{ fontSize:12, color:"rgba(242,242,240,0.4)", lineHeight:1.5 }}>Click to upload. Square images work best.</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:6, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>Display name</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name or brand"
                style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"12px 16px", color:"#F2F2F0", fontSize:14, outline:"none" }} />
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:6, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>Bio <span style={{ color:"rgba(255,255,255,0.2)" }}>(optional)</span></label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell fans who you are..." rows={3} maxLength={300}
                style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"12px 16px", color:"#F2F2F0", fontSize:14, outline:"none", resize:"none", fontFamily:"inherit" }} />
            </div>

            {/* Tags */}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:10, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>Your categories <span style={{ color:"rgba(255,255,255,0.2)" }}>(pick up to 5)</span></label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {CREATOR_CATEGORIES.filter(c => c.id !== "adult").map(cat => {
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
            </div>

            {/* Location */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:6, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>City <span style={{ color:"rgba(255,255,255,0.2)" }}>(optional)</span></label>
                <input type="text" value={locationCity} onChange={e => setLocationCity(e.target.value)} placeholder="Seattle"
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#F2F2F0", fontSize:14, outline:"none" }} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(242,242,240,0.4)", marginBottom:6, fontFamily:"monospace", letterSpacing:".1em", textTransform:"uppercase" }}>Country <span style={{ color:"rgba(255,255,255,0.2)" }}>(optional)</span></label>
                <input type="text" value={locationCountry} onChange={e => setLocationCountry(e.target.value)} placeholder="USA"
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#F2F2F0", fontSize:14, outline:"none" }} />
              </div>
            </div>

            {err && <p style={{ fontSize:13, color:"#F87171", marginBottom:16 }}>{err}</p>}
            <button onClick={saveProfile} disabled={saving || !displayName.trim()} style={{ width:"100%", background:"#F0B429", color:"#09090C", fontWeight:700, fontSize:14, padding:"14px 0", borderRadius:999, border:"none", cursor:"pointer", opacity:saving||!displayName.trim()?0.5:1 }}>
              {saving ? "Saving…" : "Save and continue →"}
            </button>
          </div>
        )}

        {step === "stripe" && (
          <div>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:28, fontWeight:300, color:"#fff", marginBottom:8 }}>Connect Stripe</h2>
            <p style={{ fontSize:13, color:"rgba(242,242,240,0.5)", marginBottom:28, lineHeight:1.65 }}>
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
              <a href="/gear" style={{ display:"block", textAlign:"center", color:"rgba(240,180,41,0.6)", fontSize:12, padding:"8px 0", textDecoration:"none" }}>
                📦 Need gear? See our creator setup guide →
              </a>
            </div>
          </div>
        )}
      </div>

      {step !== "welcome" && step !== "done" && (
        <button onClick={() => setStep(steps[stepIdx - 1])} style={{ marginTop:20, background:"none", border:"none", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:13 }}>
          ← Back
        </button>
      )}
    </main>
  );
}
