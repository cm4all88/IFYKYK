"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

const STEPS = ["Identity", "Handle", "Review"] as const;

export default function BackstageSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [spotlightHandle, setSpotlightHandle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    handle: "",
    display_name: "",
    bio: "",
    linked: false,
    legal_name: "",
    dob: "",
    id_type: "passport",
    agreed: false,
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await (supabase as any)
        .from("creator_profiles").select("handle, kind").eq("user_id", user.id).eq("kind", "spotlight").maybeSingle();
      if (!profile) { router.push("/dashboard"); return; }
      setSpotlightHandle(profile.handle);
      setForm(f => ({ ...f, handle: `${profile.handle}-backstage` }));
      setLoading(false);
    }
    load();
  }, []);

  async function create() {
    if (!form.agreed) { setErr("You must agree to the 2257 compliance requirements."); return; }
    if (!form.handle.trim() || !form.legal_name.trim() || !form.dob) { setErr("All fields are required."); return; }
    setSaving(true);
    setErr(null);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("creator_profiles").insert({
      user_id: user?.id,
      kind: "backstage",
      handle: form.handle.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      display_name: form.display_name.trim() || form.handle.trim(),
      bio: form.bio.trim() || null,
      linked: form.linked,
      backstage_legal_name: form.legal_name.trim(),
      backstage_dob: form.dob,
      backstage_id_type: form.id_type,
      backstage_verified: false, // pending Veriff
    });

    if (error) { setErr(error.message); setSaving(false); return; }
    router.push("/dashboard?backstage=created");
    router.refresh();
  }

  if (loading) return <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--muted)" }}>Loading…</div>;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", color:"var(--text)", fontFamily:"var(--font-sans)" }}>
      <header style={{ borderBottom:"1px solid var(--border)", padding:"15px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Link href="/" style={{ fontFamily:"var(--font-serif)", fontSize:22, color:"var(--text)", textDecoration:"none" }}>Spot<span style={{ color:"var(--accent)" }}>light</span>ly</Link>
        <Link href="/dashboard" style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:".15em", textTransform:"uppercase" as const, color:"var(--muted)", textDecoration:"none" }}>← Dashboard</Link>
      </header>

      <div style={{ maxWidth:580, margin:"0 auto", padding:"48px 28px" }}>
        {/* Progress */}
        <div style={{ display:"flex", gap:"var(--s-3)", marginBottom:"var(--s-10)" }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex:1, height:3, borderRadius:99, background: i <= step ? "var(--accent-back)" : "var(--surface-3)", transition:"background 0.3s" }} />
          ))}
        </div>

        <div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".2em", textTransform:"uppercase" as const, color:"var(--accent-back)", marginBottom:"var(--s-3)" }}>
          Open a Backstage · Step {step + 1} of {STEPS.length}
        </div>

        {step === 0 && (
          <div>
            <h1 style={{ fontFamily:"var(--font-display)", fontSize:36, fontWeight:800, letterSpacing:"-0.03em", color:"#fff", lineHeight:1.05, marginBottom:"var(--s-4)" }}>
              Federal identity requirements.
            </h1>
            <p style={{ fontSize:14, color:"var(--text-soft)", lineHeight:1.8, marginBottom:"var(--s-8)" }}>
              Before you can post adult content on Backstage, federal law (18 U.S.C. § 2257)
              requires that we collect and maintain your legal identity information.
              This is never shown publicly and is only used for legal compliance.
            </p>

            <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-4)", marginBottom:"var(--s-6)" }}>
              <div>
                <label className="label">Legal full name (as on government ID)</label>
                <input className="input" value={form.legal_name} onChange={e => setForm(f => ({...f, legal_name:e.target.value}))} placeholder="Your legal name" />
              </div>
              <div>
                <label className="label">Date of birth</label>
                <input className="input" type="date" value={form.dob} onChange={e => setForm(f => ({...f, dob:e.target.value}))} />
              </div>
              <div>
                <label className="label">ID type on file</label>
                <select className="input" value={form.id_type} onChange={e => setForm(f => ({...f, id_type:e.target.value}))}>
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver&apos;s License</option>
                  <option value="national_id">National ID</option>
                </select>
              </div>
            </div>

            <div style={{ background:"rgba(168,85,247,.04)", border:"1px solid rgba(168,85,247,.2)", borderRadius:"var(--r-2)", padding:"var(--s-4) var(--s-5)", marginBottom:"var(--s-6)", fontSize:13, color:"var(--text-soft)", lineHeight:1.7 }}>
              🔒 This information is stored securely, accessible only to Spotlightly compliance staff, and never shared publicly. Full age verification via Veriff will be required before your Backstage goes live.
            </div>

            <div style={{ display:"flex", alignItems:"start", gap:"var(--s-3)", marginBottom:"var(--s-6)" }}>
              <input type="checkbox" id="agreed" checked={form.agreed} onChange={e => setForm(f => ({...f, agreed:e.target.checked}))} style={{ marginTop:3 }} />
              <label htmlFor="agreed" style={{ fontSize:13, color:"var(--text-soft)", lineHeight:1.65, cursor:"pointer" }}>
                I confirm I am 18 or older, the information above is accurate, and I understand that all performers in content I post must also be 18+ with records maintained per 18 U.S.C. § 2257.
              </label>
            </div>

            {err && <div style={{ color:"var(--red)", fontSize:13, marginBottom:"var(--s-4)", padding:"10px 14px", background:"var(--red-soft)", border:"1px solid var(--red-border)", borderRadius:"var(--r-2)" }}>{err}</div>}
            <button className="btn btn--primary" onClick={() => { if (!form.legal_name || !form.dob || !form.agreed) { setErr("All fields required and agreement must be checked."); return; } setErr(null); setStep(1); }} style={{ borderRadius:"var(--r-pill)" }}>
              Continue →
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 style={{ fontFamily:"var(--font-display)", fontSize:36, fontWeight:800, letterSpacing:"-0.03em", color:"#fff", marginBottom:"var(--s-4)" }}>
              Your Backstage identity.
            </h1>
            <p style={{ fontSize:14, color:"var(--text-soft)", lineHeight:1.8, marginBottom:"var(--s-8)" }}>
              Your Backstage is a completely separate public profile. It can be invisible to your Spotlight audience — or linked, if you want fans to know it exists. You decide.
            </p>

            <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-4)", marginBottom:"var(--s-6)" }}>
              <div>
                <label className="label">Backstage handle</label>
                <input className="input" value={form.handle}
                  onChange={e => setForm(f => ({...f, handle:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))}
                  placeholder="your-backstage-handle" />
                <p style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>spotlightly.app/{form.handle || "your-handle"}</p>
              </div>
              <div>
                <label className="label">Display name</label>
                <input className="input" value={form.display_name} onChange={e => setForm(f => ({...f, display_name:e.target.value}))} placeholder="How fans see your name" />
              </div>
              <div>
                <label className="label">Bio (optional)</label>
                <textarea className="input" rows={3} value={form.bio} onChange={e => setForm(f => ({...f, bio:e.target.value}))} placeholder="Tell fans who you are on Backstage…" />
              </div>

              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-4) var(--s-5)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:13, fontWeight:700, color:"#fff", marginBottom:2 }}>Link to my Spotlight (@{spotlightHandle})</div>
                  <div style={{ fontSize:12, color:"var(--muted)" }}>A Backstage badge will appear on your Spotlight page. Off by default — you can always change this later.</div>
                </div>
                <button onClick={() => setForm(f => ({...f, linked:!f.linked}))}
                  style={{ width:46, height:24, borderRadius:99, background: form.linked ? "var(--accent-back)" : "var(--surface-3)", border:"1px solid", borderColor: form.linked ? "rgba(168,85,247,.4)" : "var(--border-strong)", cursor:"pointer", position:"relative", flexShrink:0, transition:"all var(--t-fast)" }}>
                  <div style={{ position:"absolute", top:3, left: form.linked ? 23 : 3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left var(--t-base)" }} />
                </button>
              </div>
            </div>

            <div style={{ display:"flex", gap:"var(--s-3)" }}>
              <button className="btn btn--ghost" onClick={() => setStep(0)}>← Back</button>
              <button className="btn btn--primary" onClick={() => { if (!form.handle.trim()) { setErr("Handle required"); return; } setErr(null); setStep(2); }} style={{ borderRadius:"var(--r-pill)" }}>
                Review →
              </button>
            </div>
            {err && <div style={{ color:"var(--red)", fontSize:13, marginTop:"var(--s-3)" }}>{err}</div>}
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 style={{ fontFamily:"var(--font-display)", fontSize:36, fontWeight:800, letterSpacing:"-0.03em", color:"#fff", marginBottom:"var(--s-4)" }}>
              Almost there.
            </h1>

            <div style={{ background:"var(--surface)", border:"1px solid rgba(168,85,247,.2)", borderRadius:"var(--r-3)", padding:"var(--s-6)", marginBottom:"var(--s-6)" }}>
              {[
                { label:"Handle", val:`@${form.handle}` },
                { label:"Display name", val:form.display_name || form.handle },
                { label:"Linked to Spotlight", val:form.linked ? `Yes (@${spotlightHandle})` : "No — invisible to Spotlight audience" },
                { label:"Legal name (private)", val:form.legal_name },
                { label:"Date of birth (private)", val:form.dob },
              ].map(r => (
                <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"var(--s-3) 0", borderBottom:"1px solid var(--border)", fontSize:13 }}>
                  <span style={{ color:"var(--muted)" }}>{r.label}</span>
                  <span style={{ color:"var(--text)", fontWeight:500 }}>{r.val}</span>
                </div>
              ))}
            </div>

            <div style={{ background:"rgba(168,85,247,.06)", border:"1px solid rgba(168,85,247,.2)", borderRadius:"var(--r-2)", padding:"var(--s-4) var(--s-5)", marginBottom:"var(--s-6)", fontSize:13, color:"var(--text-soft)", lineHeight:1.7 }}>
              <strong style={{ color:"var(--accent-back)" }}>Next step after creation:</strong> Complete Veriff age verification before your Backstage goes live. We&apos;ll walk you through it in the dashboard.
            </div>

            {err && <div style={{ color:"var(--red)", fontSize:13, marginBottom:"var(--s-4)", padding:"10px 14px", background:"var(--red-soft)", border:"1px solid var(--red-border)", borderRadius:"var(--r-2)" }}>{err}</div>}

            <div style={{ display:"flex", gap:"var(--s-3)" }}>
              <button className="btn btn--ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn--primary" onClick={create} disabled={saving} style={{ borderRadius:"var(--r-pill)", background:"var(--accent-back)", color:"#fff" }}>
                {saving ? "Creating…" : "Open my Backstage →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
