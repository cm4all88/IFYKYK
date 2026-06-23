"use client";

import React from "react";
import type { StudioPayload } from "@/components/StudioSetup";

// Admin "Build my page" as a guided interview. Ask a few questions, branch into
// the relevant follow-ups (most importantly: is there a real goal, so a campaign
// makes sense, or not), then show a recommendation WITH reasoning, a preview the
// admin can edit, and an approval before anything is created. Produces the same
// StudioPayload the commit route already accepts.

type Tier = { name: string; price_monthly: number; price_yearly: number | null; description: string; perks: string[] };
type CampTier = { amount: number; title: string; description: string; rewards: { type: string; label: string }[] };

const NICHES = [
  { id: "musician", label: "Musician" }, { id: "artist", label: "Artist" },
  { id: "fitness", label: "Fitness" }, { id: "writer", label: "Writer" },
  { id: "educator", label: "Educator" }, { id: "streamer", label: "Streamer" },
  { id: "lifestyle", label: "Lifestyle" }, { id: "general", label: "Something else" },
];

const GOALS = [
  { id: "trip", emoji: "✈️", label: "A trip or a move", category: "travel" },
  { id: "project", emoji: "🎬", label: "A project, album, or launch", category: "creative" },
  { id: "equipment", emoji: "🎒", label: "Equipment or gear", category: "equipment" },
  { id: "event", emoji: "💍", label: "A life event", category: "other" },
  { id: "cause", emoji: "❤️", label: "A community cause", category: "other" },
  { id: "none", emoji: "—", label: "Nothing specific right now", category: "other" },
];

const SIGNS = ["♈ Aries", "♉ Taurus", "♊ Gemini", "♋ Cancer", "♌ Leo", "♍ Virgo", "♎ Libra", "♏ Scorpio", "♐ Sagittarius", "♑ Capricorn", "♒ Aquarius", "♓ Pisces"];

type Step = "about" | "personality" | "goal" | "community" | "modules" | "generating" | "recommend" | "preview" | "done";

export default function PageBuilderQA({
  displayName, handle, onClose, onDone, onCommit,
}: {
  displayName: string | null; handle: string; onClose: () => void; onDone: () => void;
  onCommit: (payload: StudioPayload) => Promise<string | null>;
}) {
  const name = displayName || handle;
  const fn = name.split(/\s+/)[0] || name;

  const [step, setStep] = React.useState<Step>("about");
  // answers
  const [niche, setNiche] = React.useState("general");
  const [makes, setMakes] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [vibe, setVibe] = React.useState("");
  const [usesEmojis, setUsesEmojis] = React.useState<boolean | null>(null);
  const [textingStyle, setTextingStyle] = React.useState("");
  const [astrology, setAstrology] = React.useState<boolean | null>(null);
  const [sign, setSign] = React.useState("");
  const [pronouns, setPronouns] = React.useState("");
  const [humor, setHumor] = React.useState("");
  const [excitement, setExcitement] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [fanName, setFanName] = React.useState("");
  const [vibeWords, setVibeWords] = React.useState<string[]>([]);
  const [interests, setInterests] = React.useState<string[]>([]);
  const [catchphrase, setCatchphrase] = React.useState("");
  const [goalType, setGoalType] = React.useState<string>("");
  const [goalDetail, setGoalDetail] = React.useState("");
  const [goalAmount, setGoalAmount] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [exclusive, setExclusive] = React.useState("");
  const [regular, setRegular] = React.useState("");
  const [wantsLive, setWantsLive] = React.useState(true);
  const [wantsMerch, setWantsMerch] = React.useState(false);
  const [wantsMarketplace, setWantsMarketplace] = React.useState(false);

  // results
  const [genErr, setGenErr] = React.useState<string | null>(null);
  const [bio, setBio] = React.useState("");
  const [freeName, setFreeName] = React.useState("");
  const [freeBlurb, setFreeBlurb] = React.useState("");
  const [freePerks, setFreePerks] = React.useState("");
  const [tiers, setTiers] = React.useState<Tier[]>([]);
  const [campTitle, setCampTitle] = React.useState("");
  const [campDesc, setCampDesc] = React.useState("");
  const [campGoal, setCampGoal] = React.useState("");
  const [campCategory, setCampCategory] = React.useState("other");
  const [campTiers, setCampTiers] = React.useState<CampTier[]>([]);
  const [includeCampaign, setIncludeCampaign] = React.useState(false);
  const [campaignRecommended, setCampaignRecommended] = React.useState(false);
  const [reasonCampaign, setReasonCampaign] = React.useState("");
  const [reasonTiers, setReasonTiers] = React.useState("");
  const [liveTitle, setLiveTitle] = React.useState("");
  const [merchIdea, setMerchIdea] = React.useState("");
  const [mktIdea, setMktIdea] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  const goalReal = !!goalType && goalType !== "none";

  async function generate() {
    setStep("generating"); setGenErr(null);
    try {
      const res = await fetch("/api/studio/build", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview: true, displayName, handle, niche, makes,
          audience, vibe, usesEmojis, textingStyle, astrology, sign, pronouns, humor, excitement, language, fanName, vibeWords, interests, catchphrase,
          goalType, goalDetail, goalAmount: Number(goalAmount) || 0, deadline,
          workingToward: goalReal ? (goalDetail || goalType) : "",
          exclusive, regular, wantsLive, wantsMerch, wantsMarketplace,
        }),
      });
      const d = await res.json();
      setBio(String(d.bio ?? ""));
      setFreeName(String(d.freeTier?.name ?? ""));
      setFreeBlurb(String(d.freeTier?.blurb ?? ""));
      setFreePerks((Array.isArray(d.freeTier?.perks) ? d.freeTier.perks : []).join("\n"));
      setTiers((Array.isArray(d.tiers) ? d.tiers : []).map((t: any) => ({
        name: String(t.name ?? ""), price_monthly: Number(t.price_monthly) || 0,
        price_yearly: t.price_yearly != null ? Number(t.price_yearly) : null,
        description: String(t.description ?? ""), perks: Array.isArray(t.perks) ? t.perks.map((p: any) => String(p)) : [],
      })));
      const c = d.campaign ?? {};
      setCampTitle(String(c.title ?? ""));
      setCampDesc(String(c.description ?? ""));
      setCampGoal(c.goal ? String(c.goal) : (goalAmount || ""));
      setCampCategory(String(c.category ?? (GOALS.find((g) => g.id === goalType)?.category ?? "other")));
      setCampTiers((Array.isArray(c.tiers) ? c.tiers : []).map((t: any) => ({
        amount: Number(t.amount) || 0, title: String(t.title ?? ""), description: String(t.description ?? ""),
        rewards: Array.isArray(t.rewards) ? t.rewards.map((r: any) => ({ type: String(r.type ?? "content"), label: String(r.label ?? "") })) : [],
      })));
      const rec = !!d.campaignRecommended && goalReal;
      setCampaignRecommended(rec);
      setIncludeCampaign(rec);
      setReasonCampaign(String(d.reasoning?.campaign ?? ""));
      setReasonTiers(String(d.reasoning?.tiers ?? ""));
      setLiveTitle(String(d.live?.title ?? ""));
      setMerchIdea(String(d.merch?.idea ?? ""));
      setMktIdea(String(d.marketplace?.idea ?? ""));
      setStep("recommend");
    } catch { setGenErr("Couldn't build the recommendation. Try again."); setStep("modules"); }
  }

  function patchTier(i: number, p: Partial<Tier>) { setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...p } : t))); }
  function patchCamp(i: number, p: Partial<CampTier>) { setCampTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...p } : t))); }

  async function commit() {
    setSaving(true); setSaveErr(null);
    const payload: StudioPayload = {
      bio,
      freeTier: { name: freeName, blurb: freeBlurb, perks: freePerks.split("\n").map((p) => p.trim()).filter(Boolean) },
      tiers: tiers.map((t) => ({ name: t.name, price_monthly: t.price_monthly, price_yearly: t.price_yearly, description: t.description, perks: t.perks })),
      includeCampaign,
      campaign: { title: campTitle, description: campDesc, goal: Number(campGoal) || 0, category: campCategory, tiers: campTiers },
      live: { want: wantsLive, title: liveTitle, at: null },
      merch: { want: wantsMerch, idea: merchIdea },
      marketplace: { want: wantsMarketplace, idea: mktIdea },
    };
    const err = await onCommit(payload);
    if (err) { setSaveErr(err); setSaving(false); return; }
    setSaving(false); setStep("done");
  }

  // ── styles ──
  const scrim: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 200, background: "rgba(9,9,12,0.82)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" };
  const panel: React.CSSProperties = { width: "100%", maxWidth: 720, background: "var(--bg, #17181B)", border: "1px solid var(--border, rgba(255,255,255,0.1))", borderRadius: 14, padding: 28, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" };
  const card: React.CSSProperties = { background: "var(--surface, #1E2024)", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 10, padding: 16, marginBottom: 12 };
  const label: React.CSSProperties = { fontSize: 12, color: "var(--muted, #888)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" };
  const kicker: React.CSSProperties = { fontFamily: "var(--font-mono, monospace)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--accent, #f0b429)", marginBottom: 8 };
  const h: React.CSSProperties = { fontSize: 21, color: "#fff", margin: "0 0 4px", fontFamily: "var(--font-serif, Georgia, serif)", fontWeight: 600 };
  const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const Pills = ({ value, set, opts }: { value: string; set: (v: string) => void; opts: string[] }) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {opts.map((o) => (
        <button key={o} className={value === o ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"} style={{ padding: "6px 12px" }} onClick={() => set(value === o ? "" : o)}>{o}</button>
      ))}
    </div>
  );
  const MultiPills = ({ values, set, opts }: { values: string[]; set: (v: string[]) => void; opts: string[] }) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {opts.map((o) => (
        <button key={o} className={values.includes(o) ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"} style={{ padding: "6px 12px" }} onClick={() => set(toggleIn(values, o))}>{o}</button>
      ))}
    </div>
  );

  const STEP_NO: Record<string, number> = { about: 1, personality: 2, goal: 3, community: 4, modules: 5 };
  const progress = STEP_NO[step];

  return (
    <div style={scrim}>
      <div style={panel}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={kicker}>Build {fn}&apos;s page</div>
            <div style={{ fontSize: 12, color: "var(--muted, #888)" }}>
              {progress ? `Question ${progress} of 5` : step === "generating" ? "Thinking it through" : step === "recommend" ? "The recommendation" : step === "preview" ? "Preview and approve" : ""}
            </div>
          </div>
          {step !== "generating" && step !== "done" ? <button className="adm-btn adm-btn--ghost" onClick={onClose}>Close</button> : null}
        </div>

        {/* progress dots */}
        {progress ? (
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= progress ? "var(--accent, #f0b429)" : "rgba(255,255,255,0.1)" }} />
            ))}
          </div>
        ) : null}

        {/* ── STEP 1: ABOUT ── */}
        {step === "about" ? (
          <div>
            <h2 style={h}>Who is {fn}?</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>The basics, in your own words. The goal of all this is to learn who {fn} is and write their page in their voice, not ours.</p>

            <div style={card}>
              <label style={label}>What kind of creator are they?</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {NICHES.map((nn) => (
                  <button key={nn.id} className={niche === nn.id ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"} style={{ padding: "6px 12px" }} onClick={() => setNiche(nn.id)}>{nn.label}</button>
                ))}
              </div>
            </div>

            <label style={label}>What do they make, and what is their world about?</label>
            <textarea className="adm-input" rows={3} value={makes} onChange={(e) => setMakes(e.target.value)} placeholder="e.g. She films fitness and travel from wherever she lands, plus honest wellness stuff." style={{ width: "100%", marginBottom: 14, resize: "vertical" }} />

            <label style={label}>Who follows them?</label>
            <input className="adm-input" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Women in their 20s and 30s into fitness and travel." style={{ width: "100%", marginBottom: 14 }} />

            <label style={label}>How would a friend describe them? (optional)</label>
            <input className="adm-input" value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="e.g. Warm, funny, a little chaotic, always on the move." style={{ width: "100%", marginBottom: 18 }} />

            <button className="adm-btn adm-btn--primary" disabled={!makes.trim()} onClick={() => setStep("personality")}>Next</button>
          </div>
        ) : null}

        {/* ── STEP 2: PERSONALITY ── */}
        {step === "personality" ? (
          <div>
            <h2 style={h}>How does {fn} come across?</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>Quick taps, skip anything you're unsure about. This is how we learn to write the page in their voice instead of ours.</p>

            <div style={card}>
              <label style={label}>Their pronouns</label>
              <Pills value={pronouns} set={setPronouns} opts={["she / her", "he / him", "they / them", "mix it up"]} />
            </div>

            <div style={card}>
              <label style={label}>Do they use emojis when they text?</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className={usesEmojis === true ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"} onClick={() => setUsesEmojis(true)}>Yes, all the time 😄</button>
                <button className={usesEmojis === false ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"} onClick={() => setUsesEmojis(false)}>Not really</button>
              </div>
              {usesEmojis !== null ? <p style={{ fontSize: 12, color: "var(--muted,#888)", margin: "8px 0 0" }}>{usesEmojis ? "Then we'll weave emojis into their bio and tiers too." : "Then we'll keep their copy clean, no emojis."}</p> : null}
            </div>

            <div style={card}>
              <label style={label}>How do they text?</label>
              <Pills value={textingStyle} set={setTextingStyle} opts={["lowercase and casual", "proper and polished"]} />
            </div>

            <div style={card}>
              <label style={label}>Their humor</label>
              <Pills value={humor} set={setHumor} opts={["dry and sarcastic", "playful and silly", "warm and sincere"]} />
            </div>

            <div style={card}>
              <label style={label}>How do they show excitement?</label>
              <Pills value={excitement} set={setExcitement} opts={["lots of !!!", "ALL CAPS energy", "keep it low-key"]} />
            </div>

            <div style={card}>
              <label style={label}>Their language</label>
              <Pills value={language} set={setLanguage} opts={["keep it clean", "a little edgy", "unfiltered"]} />
            </div>

            <div style={card}>
              <label style={label}>What do they call their fans?</label>
              <input className="adm-input" value={fanName} onChange={(e) => setFanName(e.target.value)} placeholder="e.g. babe, fam, loves, team, y'all" style={{ width: "100%" }} />
            </div>

            <div style={card}>
              <label style={label}>Pick a few words that describe them</label>
              <MultiPills values={vibeWords} set={setVibeWords} opts={["cozy", "glam", "gritty", "soft", "chaotic", "polished", "dreamy", "sporty", "bubbly", "mysterious", "down-to-earth", "bold"]} />
            </div>

            <div style={card}>
              <label style={label}>What are they into?</label>
              <MultiPills values={interests} set={setInterests} opts={["music", "gaming", "fashion", "food", "fitness", "art", "beauty", "travel", "anime", "books", "cars", "plants", "sports", "tech"]} />
            </div>

            <div style={card}>
              <label style={label}>Into astrology?</label>
              <div style={{ display: "flex", gap: 8, marginBottom: astrology ? 12 : 0 }}>
                <button className={astrology === true ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"} onClick={() => setAstrology(true)}>Yes ✨</button>
                <button className={astrology === false ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"} onClick={() => { setAstrology(false); setSign(""); }}>Not really</button>
              </div>
              {astrology ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SIGNS.map((sg) => (
                    <button key={sg} className={sign === sg ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"} style={{ padding: "5px 10px" }} onClick={() => setSign(sg)}>{sg}</button>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={card}>
              <label style={label}>A phrase they say a lot? (optional)</label>
              <input className="adm-input" value={catchphrase} onChange={(e) => setCatchphrase(e.target.value)} placeholder="e.g. let's get into it, stay golden, mwah" style={{ width: "100%" }} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setStep("about")}>Back</button>
              <button className="adm-btn adm-btn--primary" onClick={() => setStep("goal")}>Next</button>
            </div>
          </div>
        ) : null}

        {/* ── STEP 3: GOAL (the campaign gate) ── */}
        {step === "goal" ? (
          <div>
            <h2 style={h}>Is {fn} working toward something right now?</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>
              A campaign only makes sense if there is a real goal fans can rally behind. If there is not one, that is completely fine, we will lean into community instead.
            </p>

            <div style={{ display: "grid", gap: 8, marginBottom: goalReal ? 18 : 22 }}>
              {GOALS.map((g) => (
                <button key={g.id} onClick={() => setGoalType(g.id)}
                  className={goalType === g.id ? "adm-btn adm-btn--primary" : "adm-btn adm-btn--ghost"}
                  style={{ justifyContent: "flex-start", textAlign: "left", padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 16 }}>{g.emoji}</span> {g.label}
                </button>
              ))}
            </div>

            {goalReal ? (
              <div style={card}>
                <label style={label}>What exactly are they raising for?</label>
                <input className="adm-input" value={goalDetail} onChange={(e) => setGoalDetail(e.target.value)} placeholder="e.g. A two month trip through Southeast Asia to film a series." style={{ width: "100%", marginBottom: 12 }} />
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <label style={label}>Roughly how much?</label>
                    <input className="adm-input" type="number" min="0" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder="4500" style={{ width: 140 }} />
                  </div>
                  <div>
                    <label style={label}>Any deadline? (optional)</label>
                    <input className="adm-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="e.g. before spring" style={{ width: 200 }} />
                  </div>
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setStep("personality")}>Back</button>
              <button className="adm-btn adm-btn--primary" disabled={!goalType || (goalReal && !goalDetail.trim())} onClick={() => setStep("community")}>Next</button>
            </div>
          </div>
        ) : null}

        {/* ── STEP 3: COMMUNITY ── */}
        {step === "community" ? (
          <div>
            <h2 style={h}>What would fans pay to get closer to?</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>This shapes the tier names and what each one gives.</p>

            <label style={label}>What do they make regularly that fans love?</label>
            <textarea className="adm-input" rows={2} value={regular} onChange={(e) => setRegular(e.target.value)} placeholder="e.g. Weekly workout videos, travel vlogs, behind the scenes." style={{ width: "100%", marginBottom: 14, resize: "vertical" }} />

            <label style={label}>What is the most exclusive thing they would give their biggest supporters?</label>
            <textarea className="adm-input" rows={2} value={exclusive} onChange={(e) => setExclusive(e.target.value)} placeholder="e.g. Private live streams, direct messages, a say in where she travels next." style={{ width: "100%", marginBottom: 18, resize: "vertical" }} />

            <div style={{ display: "flex", gap: 8 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setStep("goal")}>Back</button>
              <button className="adm-btn adm-btn--primary" onClick={() => setStep("modules")}>Next</button>
            </div>
          </div>
        ) : null}

        {/* ── STEP 4: MODULES ── */}
        {step === "modules" ? (
          <div>
            <h2 style={h}>What else will {fn} use?</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>We will set up a first idea for each one you turn on. You can ignore the rest.</p>

            {[
              { on: wantsLive, set: setWantsLive, label: "Live streams", desc: "Go live for members." },
              { on: wantsMerch, set: setWantsMerch, label: "Merch", desc: "Sell branded items." },
              { on: wantsMarketplace, set: setWantsMarketplace, label: "A marketplace", desc: "Sell physical items and pieces from their collection." },
            ].map((m) => (
              <button key={m.label} onClick={() => m.set(!m.on)} className="adm-btn adm-btn--ghost"
                style={{ width: "100%", justifyContent: "flex-start", textAlign: "left", padding: "12px 14px", marginBottom: 8, display: "flex", gap: 12, alignItems: "center", borderColor: m.on ? "var(--accent, #f0b429)" : undefined }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid var(--accent, #f0b429)", background: m.on ? "var(--accent, #f0b429)" : "transparent", color: "#09090C", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.on ? "✓" : ""}</span>
                <span><span style={{ color: "#fff" }}>{m.label}</span> <span style={{ color: "var(--muted,#888)", fontSize: 12 }}>· {m.desc}</span></span>
              </button>
            ))}

            {genErr ? <div style={{ ...card, borderColor: "var(--red, #f87171)", color: "var(--red, #f87171)", fontSize: 13 }}>{genErr}</div> : null}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setStep("community")}>Back</button>
              <button className="adm-btn adm-btn--primary" onClick={generate}>✨ Build the recommendation</button>
            </div>
          </div>
        ) : null}

        {/* ── GENERATING ── */}
        {step === "generating" ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>✨</div>
            <h2 style={h}>Putting {fn}&apos;s page together…</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)" }}>Naming the tiers, writing the rewards, and deciding on a campaign.</p>
          </div>
        ) : null}

        {/* ── RECOMMENDATION ── */}
        {step === "recommend" ? (
          <div>
            <h2 style={h}>Here is what I recommend for {fn}</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>The reasoning, before you see the full page.</p>

            {/* campaign decision */}
            <div style={{ ...card, borderColor: campaignRecommended ? "var(--accent, #f0b429)" : "var(--border, rgba(255,255,255,0.08))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 15 }}>{campaignRecommended ? "✓" : "○"}</span>
                <strong style={{ color: "#fff" }}>{campaignRecommended ? "A campaign makes sense" : "No campaign for now"}</strong>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted, #aaa)", margin: 0, lineHeight: 1.6 }}>{reasonCampaign}</p>
              {campaignRecommended ? (
                <div style={{ marginTop: 10, fontSize: 13, color: "#fff" }}>
                  {campTitle} · goal ${Number(campGoal || 0).toLocaleString()}
                </div>
              ) : null}
            </div>

            {/* tiers */}
            <div style={card}>
              <div style={{ marginBottom: 8 }}><strong style={{ color: "#fff" }}>Their community tiers</strong></div>
              <p style={{ fontSize: 13, color: "var(--muted, #aaa)", margin: "0 0 10px", lineHeight: 1.6 }}>{reasonTiers}</p>
              <div style={{ fontSize: 13, color: "#fff", display: "grid", gap: 4 }}>
                <div style={{ color: "var(--muted,#888)" }}>{freeName || "Free tier"} · free</div>
                {tiers.map((t, i) => <div key={i}>{t.name} · ${t.price_monthly}/mo</div>)}
              </div>
            </div>

            {/* modules */}
            {(wantsLive || wantsMerch || wantsMarketplace) ? (
              <div style={card}>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#fff" }}>Also setting up</strong></div>
                <div style={{ fontSize: 13, color: "var(--muted, #aaa)", lineHeight: 1.7 }}>
                  {wantsLive ? <div>Live: {liveTitle}</div> : null}
                  {wantsMerch ? <div>Merch: {merchIdea}</div> : null}
                  {wantsMarketplace ? <div>Marketplace: {mktIdea}</div> : null}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setStep("modules")}>Back to questions</button>
              <button className="adm-btn adm-btn--primary" onClick={() => setStep("preview")}>See the full preview →</button>
            </div>
          </div>
        ) : null}

        {/* ── PREVIEW + APPROVE ── */}
        {step === "preview" ? (
          <div>
            <h2 style={h}>Preview {fn}&apos;s page</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18 }}>Edit anything. Nothing is created until you approve.</p>

            <div style={card}>
              <label style={label}>Bio</label>
              <textarea className="adm-input" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} style={{ width: "100%", resize: "vertical" }} />
            </div>

            <div style={card}>
              <label style={label}>Free tier</label>
              <input className="adm-input" value={freeName} onChange={(e) => setFreeName(e.target.value)} placeholder="Name" style={{ width: "100%", marginBottom: 8 }} />
              <input className="adm-input" value={freeBlurb} onChange={(e) => setFreeBlurb(e.target.value)} placeholder="One line" style={{ width: "100%", marginBottom: 8 }} />
              <textarea className="adm-input" rows={3} value={freePerks} onChange={(e) => setFreePerks(e.target.value)} placeholder="What they get for free (one per line)" style={{ width: "100%", resize: "vertical" }} />
            </div>

            <div style={{ ...kicker, color: "var(--muted,#888)", marginTop: 6 }}>Paid tiers</div>
            {tiers.map((t, i) => (
              <div key={i} style={card}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input className="adm-input" value={t.name} onChange={(e) => patchTier(i, { name: e.target.value })} placeholder="Tier name" style={{ flex: 1 }} />
                  <input className="adm-input" type="number" min="0" step="0.01" value={t.price_monthly || ""} onChange={(e) => patchTier(i, { price_monthly: Number(e.target.value) || 0 })} placeholder="$/mo" style={{ width: 90 }} />
                </div>
                <input className="adm-input" value={t.description} onChange={(e) => patchTier(i, { description: e.target.value })} placeholder="One line" style={{ width: "100%", marginBottom: 8 }} />
                <textarea className="adm-input" rows={3} value={t.perks.join("\n")} onChange={(e) => patchTier(i, { perks: e.target.value.split("\n").map((p) => p.trim()).filter(Boolean) })} placeholder="Perks (one per line)" style={{ width: "100%", resize: "vertical" }} />
              </div>
            ))}

            {/* campaign */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#fff", margin: "10px 0 10px" }}>
              <input type="checkbox" checked={includeCampaign} onChange={(e) => setIncludeCampaign(e.target.checked)} />
              Include a campaign{!campaignRecommended ? " (not recommended for them yet)" : ""}
            </label>
            {includeCampaign ? (
              <>
                <div style={card}>
                  <label style={label}>Campaign</label>
                  <input className="adm-input" value={campTitle} onChange={(e) => setCampTitle(e.target.value)} placeholder="Title" style={{ width: "100%", marginBottom: 8 }} />
                  <textarea className="adm-input" rows={2} value={campDesc} onChange={(e) => setCampDesc(e.target.value)} placeholder="Description" style={{ width: "100%", marginBottom: 8, resize: "vertical" }} />
                  <div>
                    <label style={label}>Goal (USD)</label>
                    <input className="adm-input" type="number" min="0" value={campGoal} onChange={(e) => setCampGoal(e.target.value)} placeholder="Goal" style={{ width: 160 }} />
                  </div>
                </div>
                <div style={{ ...kicker, color: "var(--muted,#888)" }}>Backer tiers and rewards</div>
                {campTiers.map((t, i) => (
                  <div key={i} style={card}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input className="adm-input" value={t.title} onChange={(e) => patchCamp(i, { title: e.target.value })} placeholder="Reward tier name" style={{ flex: 1 }} />
                      <input className="adm-input" type="number" min="0" value={t.amount || ""} onChange={(e) => patchCamp(i, { amount: Number(e.target.value) || 0 })} placeholder="$" style={{ width: 90 }} />
                    </div>
                    <textarea className="adm-input" rows={2} value={t.rewards.map((r) => r.label).join("\n")}
                      onChange={(e) => patchCamp(i, { rewards: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).map((label, idx) => ({ type: t.rewards[idx]?.type || "content", label })) })}
                      placeholder="What this backer gets (one per line)" style={{ width: "100%", resize: "vertical" }} />
                  </div>
                ))}
              </>
            ) : null}

            {saveErr ? <div style={{ ...card, borderColor: "var(--red, #f87171)", color: "var(--red, #f87171)", fontSize: 13 }}>{saveErr}</div> : null}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setStep("recommend")} disabled={saving}>Back</button>
              <button className="adm-btn adm-btn--primary" onClick={commit} disabled={saving}>{saving ? "Building…" : "Approve and build →"}</button>
            </div>
          </div>
        ) : null}

        {/* ── DONE ── */}
        {step === "done" ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>✓</div>
            <h2 style={h}>{fn}&apos;s page is built</h2>
            <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 20 }}>
              Bio, free tier, and paid tiers are set up{includeCampaign ? ", and the campaign is running" : ""}. Edit anything below, then send them the preview link.
            </p>
            <button className="adm-btn adm-btn--primary" onClick={onDone}>Done</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
