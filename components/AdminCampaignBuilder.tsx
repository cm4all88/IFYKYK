"use client";

import React from "react";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaign-templates";

// Standalone "add a campaign" for the admin. Two ways in: answer a few questions
// and let the assistant draft it, or (for creators who already have it mostly
// figured out) go straight to a form and type what they have. Both land on the
// same editable review, then create just the campaign.

type CampTier = { amount: number; title: string; description: string; rewards: { type: string; label: string }[] };

export default function AdminCampaignBuilder({
  creatorProfileId, displayName, handle, onClose, onDone,
}: {
  creatorProfileId: string; displayName: string | null; handle: string; onClose: () => void; onDone: () => void;
}) {
  const name = displayName || handle;
  const fn = name.split(/\s+/)[0] || name;

  const [step, setStep] = React.useState<"start" | "questions" | "generating" | "review" | "done">("start");
  const [category, setCategory] = React.useState("travel");
  const [raisingFor, setRaisingFor] = React.useState("");
  const [why, setWhy] = React.useState("");
  const [contentType, setContentType] = React.useState("");
  const [note, setNote] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [tiers, setTiers] = React.useState<CampTier[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  function patch(i: number, p: Partial<CampTier>) { setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...p } : t))); }
  function addTier() { setTiers((prev) => [...prev, { amount: 0, title: "", description: "", rewards: [] }]); }
  function removeTier(i: number) { setTiers((prev) => prev.filter((_, idx) => idx !== i)); }

  async function assist() {
    setStep("generating"); setNote(null);
    try {
      const res = await fetch("/api/campaigns/assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, raisingFor, why, contentType, displayName, handle }),
      });
      const d = await res.json();
      if (d.error) { setNote(d.error + " You can still fill it in by hand below."); setStep("review"); return; }
      setTitle(String(d.title ?? raisingFor ?? ""));
      setDescription(String(d.description ?? why ?? ""));
      setGoal(d.goal ? String(d.goal) : "");
      setTiers((Array.isArray(d.tiers) ? d.tiers : []).map((t: any) => ({
        amount: Number(t.amount) || 0, title: String(t.title ?? ""), description: String(t.description ?? ""),
        rewards: Array.isArray(t.rewards) ? t.rewards.map((r: any) => ({ type: String(r.type ?? "content"), label: String(r.label ?? "") })) : [],
      })));
      setStep("review");
    } catch { setNote("Couldn't draft it just now. Fill it in by hand below."); setStep("review"); }
  }

  async function create() {
    setSaving(true); setSaveErr(null);
    try {
      const res = await fetch("/api/admin/campaigns/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorProfileId, title, description, goal: Number(goal) || 0, category, tiers }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setSaveErr(d.error || "Couldn't create the campaign."); setSaving(false); return; }
      setSaving(false); setStep("done");
    } catch { setSaveErr("Couldn't create the campaign. Try again."); setSaving(false); }
  }

  const scrim: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 200, background: "rgba(9,9,12,0.82)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" };
  const panel: React.CSSProperties = { width: "100%", maxWidth: 720, background: "var(--bg, #17181B)", border: "1px solid var(--border, rgba(255,255,255,0.1))", borderRadius: 14, padding: 28, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" };
  const card: React.CSSProperties = { background: "var(--surface, #1E2024)", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 10, padding: 16, marginBottom: 12 };
  const label: React.CSSProperties = { fontSize: 12, color: "var(--muted, #888)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" };
  const kicker: React.CSSProperties = { fontFamily: "var(--font-mono, monospace)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--accent, #f0b429)", marginBottom: 8 };
  const h: React.CSSProperties = { fontSize: 21, color: "#fff", margin: "0 0 4px", fontFamily: "var(--font-serif, Georgia, serif)", fontWeight: 600 };

  return (
    <div style={scrim} onClick={(e) => { if (e.target === e.currentTarget && step !== "generating") onClose(); }}>
      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={kicker}>Add a campaign for {fn}</div>
          {step !== "generating" ? <button className="adm-btn adm-btn--ghost" onClick={onClose}>Close</button> : null}
        </div>

        {note ? <div style={{ ...card, borderColor: "var(--accent, #f0b429)", fontSize: 13, color: "var(--muted,#bbb)" }}>{note}</div> : null}

        {/* START */}
        {step === "start" ? (
          <div>
            <h2 style={h}>How do you want to do this?</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>A campaign is a one time fundraiser with backing tiers. Either let the assistant draft it from a few answers, or enter what they already have.</p>
            <button className="adm-btn adm-btn--ghost" onClick={() => setStep("questions")} style={{ width: "100%", textAlign: "left", padding: 16, marginBottom: 10, display: "block" }}>
              <span style={{ color: "#fff", fontSize: 15 }}>✨ Help me write it</span>
              <span style={{ display: "block", color: "var(--muted,#888)", fontSize: 12.5, marginTop: 2 }}>Answer a few questions and the assistant drafts the title, goal, and backing tiers.</span>
            </button>
            <button className="adm-btn adm-btn--ghost" onClick={() => { if (tiers.length === 0) setTiers([{ amount: 0, title: "", description: "", rewards: [] }]); setStep("review"); }} style={{ width: "100%", textAlign: "left", padding: 16, display: "block" }}>
              <span style={{ color: "#fff", fontSize: 15 }}>I have the details</span>
              <span style={{ display: "block", color: "var(--muted,#888)", fontSize: 12.5, marginTop: 2 }}>Go straight to the form and type what they already have.</span>
            </button>
          </div>
        ) : null}

        {/* QUESTIONS */}
        {step === "questions" ? (
          <div>
            <h2 style={h}>Tell me about the campaign</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>Short answers are fine. You can edit everything after.</p>

            <div style={card}>
              <label style={label}>What kind of campaign is it?</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CAMPAIGN_CATEGORIES.map((c: any) => (
                  <button key={c.id} className={category === c.id ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"} style={{ padding: "6px 12px" }} onClick={() => setCategory(c.id)}>{c.emoji ? c.emoji + " " : ""}{c.label}</button>
                ))}
              </div>
            </div>

            <label style={label}>What are they raising money for?</label>
            <input className="adm-input" value={raisingFor} onChange={(e) => setRaisingFor(e.target.value)} placeholder="e.g. A two month trip through Southeast Asia to film a series." style={{ width: "100%", marginBottom: 14 }} />

            <label style={label}>Why does it matter, or what will they do with it?</label>
            <textarea className="adm-input" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. To finally take the audience somewhere new and make the kind of videos they've been asking for." style={{ width: "100%", marginBottom: 14, resize: "vertical" }} />

            <label style={label}>What do they make? (optional, helps the tiers)</label>
            <input className="adm-input" value={contentType} onChange={(e) => setContentType(e.target.value)} placeholder="e.g. Travel and fitness videos." style={{ width: "100%", marginBottom: 18 }} />

            <div style={{ display: "flex", gap: 8 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setStep("start")}>Back</button>
              <button className="adm-btn adm-btn--primary" disabled={!raisingFor.trim()} onClick={assist}>✨ Draft the campaign</button>
            </div>
          </div>
        ) : null}

        {/* GENERATING */}
        {step === "generating" ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>✨</div>
            <h2 style={h}>Drafting the campaign…</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)" }}>Writing the goal and the backing tiers.</p>
          </div>
        ) : null}

        {/* REVIEW */}
        {step === "review" ? (
          <div>
            <h2 style={h}>Review the campaign</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>Edit anything. Nothing is created until you hit create.</p>

            <div style={card}>
              <label style={label}>Title</label>
              <input className="adm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Help me fund my next adventure" style={{ width: "100%", marginBottom: 12 }} />
              <label style={label}>Description</label>
              <textarea className="adm-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it's for, in their voice." style={{ width: "100%", marginBottom: 12, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <label style={label}>Goal (USD)</label>
                  <input className="adm-input" type="number" min="0" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="4500" style={{ width: 160 }} />
                </div>
                <div>
                  <label style={label}>Category</label>
                  <select className="adm-input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 200 }}>
                    {CAMPAIGN_CATEGORIES.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 2px 8px" }}>
              <div style={{ ...kicker, color: "var(--muted,#888)", margin: 0 }}>Backing tiers and rewards</div>
              <button className="adm-btn adm-btn--ghost" style={{ padding: "4px 10px" }} onClick={addTier}>+ Add tier</button>
            </div>
            {tiers.map((t, i) => (
              <div key={i} style={card}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input className="adm-input" value={t.title} onChange={(e) => patch(i, { title: e.target.value })} placeholder="Tier name (e.g. Postcard)" style={{ flex: 1 }} />
                  <input className="adm-input" type="number" min="0" value={t.amount || ""} onChange={(e) => patch(i, { amount: Number(e.target.value) || 0 })} placeholder="$" style={{ width: 90 }} />
                  <button className="adm-btn adm-btn--ghost" style={{ padding: "4px 10px" }} onClick={() => removeTier(i)}>✕</button>
                </div>
                <input className="adm-input" value={t.description} onChange={(e) => patch(i, { description: e.target.value })} placeholder="One line (optional)" style={{ width: "100%", marginBottom: 8 }} />
                <textarea className="adm-input" rows={2} value={t.rewards.map((r) => r.label).join("\n")}
                  onChange={(e) => patch(i, { rewards: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).map((label, idx) => ({ type: t.rewards[idx]?.type || "content", label })) })}
                  placeholder="What this backer gets (one per line)" style={{ width: "100%", resize: "vertical" }} />
              </div>
            ))}

            {saveErr ? <div style={{ ...card, borderColor: "var(--red, #f87171)", color: "var(--red, #f87171)", fontSize: 13 }}>{saveErr}</div> : null}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setStep("start")} disabled={saving}>Back</button>
              <button className="adm-btn adm-btn--primary" onClick={create} disabled={saving || !title.trim() || !(Number(goal) > 0)}>{saving ? "Creating…" : "Create campaign →"}</button>
            </div>
          </div>
        ) : null}

        {/* DONE */}
        {step === "done" ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>✓</div>
            <h2 style={h}>Campaign is live</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 20 }}>It's running on {fn}&apos;s page now. You can fine tune the tiers anytime.</p>
            <button className="adm-btn adm-btn--primary" onClick={onDone}>Done</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
