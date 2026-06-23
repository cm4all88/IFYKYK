"use client";
import * as React from "react";
import { TIER_NICHES } from "@/lib/tier-templates";

export interface StudioPayload {
  bio: string;
  freeTier: { name: string; blurb: string; perks: string[] };
  tiers: { name: string; price_monthly: number; price_yearly: number | null; description: string; perks: string[] }[];
  includeCampaign: boolean;
  campaign: { title: string; description: string; goal: number; category: string; tiers: { amount: number; title: string; description: string; rewards: { type: string; label: string }[] }[] };
}

// ──────────────────────────────────────────────────────────────────
// Studio setup — build your whole page from one short brief. Describe
// who you are once, and the studio sets up your bio, your free tier,
// your paid tier ladder, and a starter campaign together, consistent
// because they come from the same understanding of you. Edit anything,
// then set it all up in one go. This is the "build everything like a
// creator" entry: the venue, not one tool at a time.
// ──────────────────────────────────────────────────────────────────
export default function StudioSetup({ displayName, handle, onClose, onDone, onCommit }: { displayName: string | null; handle: string; onClose: () => void; onDone: () => void; onCommit: (payload: StudioPayload) => Promise<string | null> }) {
  const [step, setStep] = React.useState<"brief" | "review">("brief");
  const [niche, setNiche] = React.useState<string>("general");
  const [makes, setMakes] = React.useState("");
  const [fans, setFans] = React.useState("");
  const [workingToward, setWorkingToward] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [genErr, setGenErr] = React.useState<string | null>(null);

  const [bio, setBio] = React.useState("");
  const [freeName, setFreeName] = React.useState("");
  const [freeBlurb, setFreeBlurb] = React.useState("");
  const [freePerks, setFreePerks] = React.useState("");
  const [tiers, setTiers] = React.useState<{ name: string; price_monthly: number; price_yearly: number | null; description: string; perks: string[] }[]>([]);
  const [includeCampaign, setIncludeCampaign] = React.useState(true);
  const [campTitle, setCampTitle] = React.useState("");
  const [campDesc, setCampDesc] = React.useState("");
  const [campGoal, setCampGoal] = React.useState("");
  const [campCategory, setCampCategory] = React.useState("other");
  const [campTiers, setCampTiers] = React.useState<{ amount: number; title: string; description: string; rewards: { type: string; label: string }[] }[]>([]);

  const [saving, setSaving] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function generate() {
    setLoading(true); setGenErr(null);
    try {
      const res = await fetch("/api/studio/build", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, makes, fans, workingToward, displayName, handle }),
      });
      const d = await res.json();
      setBio(String(d.bio ?? ""));
      setFreeName(String(d.freeTier?.name ?? ""));
      setFreeBlurb(String(d.freeTier?.blurb ?? ""));
      setFreePerks((Array.isArray(d.freeTier?.perks) ? d.freeTier.perks : []).join("\n"));
      setTiers((Array.isArray(d.tiers) ? d.tiers : []).map((t: any) => ({ name: String(t.name ?? ""), price_monthly: Number(t.price_monthly) || 0, price_yearly: t.price_yearly != null ? Number(t.price_yearly) : null, description: String(t.description ?? ""), perks: Array.isArray(t.perks) ? t.perks.map((p: any) => String(p)) : [] })));
      const c = d.campaign ?? {};
      setCampTitle(String(c.title ?? ""));
      setCampDesc(String(c.description ?? ""));
      setCampGoal(c.goal ? String(c.goal) : "");
      setCampCategory(String(c.category ?? "other"));
      const ct = (Array.isArray(c.tiers) ? c.tiers : []).map((t: any) => ({ amount: Number(t.amount) || 0, title: String(t.title ?? ""), description: String(t.description ?? ""), rewards: Array.isArray(t.rewards) ? t.rewards.map((r: any) => ({ type: String(r.type ?? "content"), label: String(r.label ?? "") })) : [] }));
      setCampTiers(ct);
      setIncludeCampaign(ct.length > 0);
      setStep("review");
    } catch { setGenErr("Couldn't build your page just now. Try again."); }
    setLoading(false);
  }

  function patchTier(i: number, p: Partial<{ name: string; price_monthly: number; price_yearly: number | null; description: string; perks: string[] }>) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
  }
  function removeTier(i: number) { setTiers((prev) => prev.filter((_, idx) => idx !== i)); }

  async function commit() {
    setSaving(true); setSaveErr(null);
    const payload: StudioPayload = {
      bio,
      freeTier: { name: freeName, blurb: freeBlurb, perks: freePerks.split("\n").map((p) => p.trim()).filter(Boolean) },
      tiers: tiers.map((t) => ({ name: t.name, price_monthly: t.price_monthly, price_yearly: t.price_yearly, description: t.description, perks: t.perks })),
      includeCampaign,
      campaign: { title: campTitle, description: campDesc, goal: Number(campGoal) || 0, category: campCategory, tiers: campTiers },
    };
    const errMsg = await onCommit(payload);
    if (errMsg) { setSaveErr(errMsg); setSaving(false); return; }
    setSaving(false); setDone(true);
  }
  const scrim: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 200, background: "rgba(9,9,12,0.78)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" };
  const panel: React.CSSProperties = { width: "100%", maxWidth: 760, background: "var(--bg, #17181B)", border: "1px solid var(--border)", borderRadius: "var(--r-3)", padding: "var(--s-7)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" };
  const sectionCard: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "var(--s-5)", display: "flex", flexDirection: "column", gap: "var(--s-3)" };

  if (done) {
    return (
      <div style={scrim} onClick={onDone}>
        <div style={panel} onClick={(e) => e.stopPropagation()}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Your page is set up.</p>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: "var(--s-6)" }}>Your bio, free tier, and paid tiers are live{includeCampaign ? ", and your campaign is running" : ""}. You can fine tune anything from the dashboard.</p>
          <button className="btn btn--primary" onClick={onDone}>See my page</button>
        </div>
      </div>
    );
  }

  return (
    <div style={scrim} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--s-6)" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6 }}>Build my page</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>{step === "brief" ? "Tell me who you are." : "Here is your whole page."}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: "var(--r-1)", padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>Close</button>
        </div>

        {step === "brief" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>Answer a few questions and I will set up your bio, your free tier, your paid tiers, and a starter campaign, all matched to you. You can edit everything before anything goes live.</p>
            <div>
              <label className="label">What kind of creator are you?</label>
              <select className="input" value={niche} onChange={(e) => setNiche(e.target.value)}>
                {TIER_NICHES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">What kind of content do you make?</label>
              <textarea className="input" rows={2} placeholder="e.g. Weekly acoustic covers, songwriting breakdowns, and live sets" value={makes} onChange={(e) => setMakes(e.target.value)} />
            </div>
            <div>
              <label className="label">Who are your fans?</label>
              <textarea className="input" rows={2} placeholder="e.g. People who love discovering new music before it blows up" value={fans} onChange={(e) => setFans(e.target.value)} />
            </div>
            <div>
              <label className="label">What are you working toward? <span style={{ color: "var(--muted)", fontWeight: 300 }}>(becomes your campaign)</span></label>
              <textarea className="input" rows={2} placeholder="e.g. A trip across Europe to write and record a new EP" value={workingToward} onChange={(e) => setWorkingToward(e.target.value)} />
            </div>
            {genErr && <p style={{ color: "var(--red)", fontSize: 13, margin: 0 }}>{genErr}</p>}
            <div style={{ display: "flex", gap: "var(--s-3)" }}>
              <button className="btn btn--primary" onClick={generate} disabled={loading || !makes.trim()}>{loading ? "Building your page…" : "Build my page"}</button>
              <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
            {/* Bio */}
            <div style={sectionCard}>
              <p className="label" style={{ margin: 0 }}>Your bio</p>
              <textarea className="input" rows={2} value={bio} placeholder="What a fan reads when they land on your page" onChange={(e) => setBio(e.target.value)} />
            </div>

            {/* Free tier */}
            <div style={sectionCard}>
              <p className="label" style={{ margin: 0 }}>Free tier (the open door)</p>
              <input className="input" value={freeName} placeholder="Follow Along" onChange={(e) => setFreeName(e.target.value)} />
              <input className="input" value={freeBlurb} placeholder="Follow for free and never miss a thing." onChange={(e) => setFreeBlurb(e.target.value)} />
              <textarea className="input" rows={Math.max(3, freePerks.split("\n").length)} value={freePerks} placeholder={"One perk per line"} onChange={(e) => setFreePerks(e.target.value)} />
            </div>

            {/* Paid tiers */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              <p className="label" style={{ margin: 0 }}>Subscription tiers</p>
              {tiers.map((t, i) => (
                <div key={i} style={sectionCard}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "var(--s-3)", alignItems: "end" }}>
                    <div><label className="label">Name</label><input className="input" value={t.name} onChange={(e) => patchTier(i, { name: e.target.value })} /></div>
                    <div><label className="label">Monthly ($)</label><input className="input" type="number" min="0.99" step="0.01" value={t.price_monthly || ""} onChange={(e) => patchTier(i, { price_monthly: parseFloat(e.target.value) || 0 })} /></div>
                    <div><label className="label">Yearly ($)</label><input className="input" type="number" min="0" step="0.01" value={t.price_yearly ?? ""} placeholder="optional" onChange={(e) => patchTier(i, { price_yearly: e.target.value ? parseFloat(e.target.value) : null })} /></div>
                    <button onClick={() => removeTier(i)} style={{ fontSize: 11, background: "none", border: "1px solid var(--border)", color: "var(--muted)", padding: "8px 12px", borderRadius: "var(--r-1)", cursor: "pointer", height: "fit-content" }}>Remove</button>
                  </div>
                  <input className="input" value={t.description} placeholder="For fans who want exclusive access" onChange={(e) => patchTier(i, { description: e.target.value })} />
                  <textarea className="input" rows={Math.max(2, t.perks.length)} value={t.perks.join("\n")} placeholder="One perk per line" onChange={(e) => patchTier(i, { perks: e.target.value.split("\n") })} />
                </div>
              ))}
            </div>

            {/* Campaign */}
            <div style={sectionCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-3)" }}>
                <p className="label" style={{ margin: 0 }}>Starter campaign</p>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-soft)", cursor: "pointer" }}>
                  <input type="checkbox" checked={includeCampaign} onChange={(e) => setIncludeCampaign(e.target.checked)} /> Include
                </label>
              </div>
              {includeCampaign && (
                <>
                  <input className="input" value={campTitle} placeholder="Campaign title" onChange={(e) => setCampTitle(e.target.value)} />
                  <textarea className="input" rows={2} value={campDesc} placeholder="What you are raising money for and why" onChange={(e) => setCampDesc(e.target.value)} />
                  <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", maxWidth: 220 }}>
                    <span style={{ color: "var(--muted)" }}>$</span>
                    <input className="input" type="number" min="10" value={campGoal} placeholder="3000" onChange={(e) => setCampGoal(e.target.value)} />
                  </div>
                  {campTiers.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>Backing tiers we will create</p>
                      {campTiers.map((t, i) => (
                        <div key={i} style={{ fontSize: 12.5, color: "var(--text-soft)", lineHeight: 1.5 }}>
                          <span style={{ color: "var(--accent)", fontWeight: 700 }}>${t.amount}</span> {t.title}
                          {t.rewards.length > 0 && <span style={{ color: "var(--muted)" }}> · {t.rewards.map((r) => r.label).join(", ")}</span>}
                        </div>
                      ))}
                      <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 0" }}>Fine tune these in the Campaigns tab after.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {saveErr && <p style={{ color: "var(--red)", fontSize: 13, margin: 0 }}>{saveErr}</p>}
            <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
              <button className="btn btn--primary" onClick={commit} disabled={saving}>{saving ? "Setting up your page…" : "Set up my page"}</button>
              <button className="btn btn--ghost" onClick={() => setStep("brief")} disabled={saving}>Back</button>
              <button className="btn btn--ghost" style={{ marginLeft: "auto" }} onClick={onClose} disabled={saving}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
