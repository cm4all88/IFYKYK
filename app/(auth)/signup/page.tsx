"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import NichePicker from "@/components/NichePicker";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import type { Database } from "@/lib/database.types";

type Phase = "referred" | "pick_niche" | "pick_backstage" | "chat" | "account";
type BackstageChoice = "just_spotlight" | "with_backstage";
type ChatMessage = { role: "user" | "assistant"; content: string };
type AccountForm = {
  email: string; password: string; displayName: string;
  spotlightHandle: string; backstageHandle: string;
};

const HANDLE_RE = /^[a-zA-Z0-9_-]{3,30}$/;

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [referrerHandle, setReferrerHandle] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [referrerAvatar, setReferrerAvatar] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("pick_backstage");
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [backstageChoice, setBackstageChoice] = useState<BackstageChoice | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamErr, setStreamErr] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [form, setForm] = useState<AccountForm>({
    email: "", password: "", displayName: "", spotlightHandle: "", backstageHandle: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  // ── Read ?ref= param and look up referrer ─────────────────────
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref")
      ?? localStorage.getItem("spotlightly_creator_ref");
    if (!ref) return;

    localStorage.setItem("spotlightly_creator_ref", ref);
    setReferrerHandle(ref);
    setPhase("referred");

    // Look up their display name + avatar
    (supabase as any)
      .from("creator_profiles")
      .select("display_name, avatar_url")
      .eq("handle", ref)
      .eq("kind", "spotlight")
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.display_name) setReferrerName(data.display_name);
        if (data?.avatar_url) setReferrerAvatar(data.avatar_url);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (phase === "chat" && messages.length === 0 && !streaming) {
      void sendToAdvisor([], { isOpening: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function pickBackstage(c: BackstageChoice) {
    setBackstageChoice(c);
    setPhase("chat");
  }

  function continueToAccount() {
    abortRef.current?.abort();
    setPhase("account");
  }

  async function sendToAdvisor(history: ChatMessage[], opts: { isOpening?: boolean } = {}) {
    setStreamErr(null);
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/advisor/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: opts.isOpening ? [] : history, backstageChoice, niche: selectedNiche }),
        signal: controller.signal,
      });
      let text = "";
      let extracted: { displayName?: string | null; suggestedHandle?: string | null } = {};
      try {
        const data = await res.json();
        text = data.response ?? "";
        extracted = data.extracted ?? {};
      } catch { /* empty */ }

      // Apply any extracted fields to the account form
      if (extracted.displayName) {
        setForm((f) => ({ ...f, displayName: extracted.displayName! }));
      }
      if (extracted.suggestedHandle) {
        const handle = extracted.suggestedHandle.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
        setForm((f) => ({ ...f, spotlightHandle: handle }));
      }

      if (!text.trim()) {
        setMessages((m) => m.slice(0, -1));
        setStreamErr("The advisor didn't respond. Try sending again.");
      } else {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === "assistant") next[next.length - 1] = { ...last, content: text };
          return next;
        });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages((m) => m.slice(0, -1));
        setStreamErr(e?.message ?? "Something went wrong.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function onChatSubmit(e: FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || streaming) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setChatInput("");
    void sendToAdvisor(next);
  }

  function validateAccount(): string | null {
    const f = form;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "Enter a valid email.";
    if (f.password.length < 8) return "Password must be at least 8 characters.";
    if (!f.displayName.trim()) return "Display name is required.";
    if (!HANDLE_RE.test(f.spotlightHandle))
      return "Spotlight handle must be 3–30 chars: letters, numbers, dashes, underscores.";
    if (backstageChoice === "with_backstage") {
      if (!HANDLE_RE.test(f.backstageHandle))
        return "Backstage handle must be 3–30 chars: letters, numbers, dashes, underscores.";
      if (f.backstageHandle === f.spotlightHandle)
        return "Use a different handle for Backstage to keep identities separate.";
    }
    return null;
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const v = validateAccount();
    if (v) { setFormErr(v); return; }
    setSubmitting(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email, password: form.password,
      });
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Signup succeeded but no user was returned.");

      const rows: Database["public"]["Tables"]["creator_profiles"]["Insert"][] = [{
        user_id: userId, kind: "spotlight", handle: form.spotlightHandle,
        display_name: form.displayName, creator_type: "spotlight", linked: false,
      }];
      if (backstageChoice === "with_backstage") {
        rows.push({
          user_id: userId, kind: "backstage", handle: form.backstageHandle,
          display_name: form.displayName, creator_type: "backstage", linked: false,
        });
      }
      const { error: insertErr } = await supabase.from("creator_profiles").insert(rows);
      if (insertErr) throw insertErr;

      fetch("/api/email/welcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email }) }).catch(() => {});
      fetch("/api/billing", { method: "POST" }).catch(() => {});

      const refHandle = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("ref") ?? localStorage.getItem("spotlightly_creator_ref")
        : null;
      if (refHandle) {
        fetch("/api/referrals/creator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referrerHandle: refHandle, referredUserId: userId, referredHandle: form.spotlightHandle }),
        }).catch(() => {});
        localStorage.removeItem("spotlightly_creator_ref");
      }

      router.push("/onboarding");
    } catch (e: any) {
      setFormErr(e?.message ?? "Something went wrong creating your account.");
      setSubmitting(false);
    }
  }

  return (
    <main className="signup">
      <div className="frame">
        <header className="topbar">
          <div className="brand">Spot<span>light</span>ly</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/fan-signup" style={{ fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: "0.1em", color: "#6b6b80", textDecoration: "none" }}>
              Join as a fan instead
            </a>
            <PhaseDots phase={phase} hasReferral={!!referrerHandle} />
          </div>
        </header>

        <div className="stage">
          {phase === "referred" && referrerHandle && (
            <ReferredWelcome
              handle={referrerHandle}
              displayName={referrerName}
              avatarUrl={referrerAvatar}
              onContinue={() => setPhase("pick_niche")}
            />
          )}
          {phase === "pick_niche" && (
            <div>
              <p className="kicker">Creator account · Step one</p>
              <h1 className="title">What do you <em>create?</em></h1>
              <p className="lede">Pick your niche and we'll personalize your onboarding — showing you the features that matter most for you.</p>
              <NichePicker
                selected={selectedNiche}
                onSelect={(slug) => setSelectedNiche(slug)}
                onSkip={() => setPhase("pick_backstage")}
              />
              {selectedNiche && (
                <button
                  onClick={() => setPhase("pick_backstage")}
                  style={{
                    marginTop: 20, padding: "14px 32px",
                    background: "#f5c842", color: "#09090C", border: "none",
                    borderRadius: 4, fontFamily: "DM Mono, monospace",
                    fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                    fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Continue →
                </button>
              )}
            </div>
          )}
          {phase === "pick_backstage" && <BackstagePicker onPick={pickBackstage} />}
          {phase === "chat" && (
            <ChatStage
              backstageChoice={backstageChoice}
              messages={messages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              streaming={streaming}
              streamErr={streamErr}
              onSubmit={onChatSubmit}
              onContinue={continueToAccount}
              chatEndRef={chatEndRef}
            />
          )}
          {phase === "account" && (
            <AccountForm
              backstageChoice={backstageChoice}
              form={form}
              setForm={setForm}
              submitting={submitting}
              formErr={formErr}
              onSubmit={createAccount}
            />
          )}
        </div>
      </div>
      <SignupStyles />
    </main>
  );
}

// ── Referred welcome screen ────────────────────────────────────────
function ReferredWelcome({
  handle,
  displayName,
  avatarUrl,
  onContinue,
}: {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  onContinue: () => void;
}) {
  const name = displayName ?? `@${handle}`;
  const initial = name.replace("@", "")[0]?.toUpperCase() ?? "?";

  return (
    <div className="referred-stage">
      {/* Avatar */}
      <div className="ref-avatar-wrap">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="ref-avatar-img" />
        ) : (
          <div className="ref-avatar-fallback">{initial}</div>
        )}
        <div className="ref-avatar-ring" />
      </div>

      <p className="ref-invited-by">You were invited by</p>
      <h1 className="ref-name">{name}</h1>
      <p className="ref-handle">@{handle} on Spotlightly</p>

      <p className="ref-lede">
        {displayName
          ? `${displayName} thinks you belong here. Build your audience, share your work, and keep what you earn.`
          : "You were referred by a creator on Spotlightly. Build your audience, share your work, and keep what you earn."
        }
      </p>

      <button className="ref-cta" onClick={onContinue}>
        Claim your stage →
      </button>

      <p className="ref-footnote">
        Takes about 2 minutes. Free to start.
      </p>
    </div>
  );
}

// ── Phase dots ────────────────────────────────────────────────────
function PhaseDots({ phase, hasReferral }: { phase: Phase; hasReferral: boolean }) {
  const steps: Phase[] = hasReferral
    ? ["referred", "pick_niche", "pick_backstage", "chat", "account"]
    : ["pick_niche", "pick_backstage", "chat", "account"];
  const idx = steps.indexOf(phase);
  return (
    <div className="dots">
      {steps.map((s, i) => (
        <span key={s} className={`dot ${i <= idx ? "on" : ""} ${i === idx ? "active" : ""}`} />
      ))}
    </div>
  );
}

// ── Backstage picker ──────────────────────────────────────────────
function BackstagePicker({ onPick }: { onPick: (c: BackstageChoice) => void }) {
  return (
    <div className="picker">
      <p className="kicker">Creator account · Step one</p>
      <h1 className="title">Are you opening <em>a Backstage</em> too?</h1>
      <p className="lede">
        Backstage is our adult-content tier. It&apos;s a separate public
        profile — nobody sees the connection to your Spotlight unless you choose
        to link them. You can add it later from your dashboard.
      </p>
      <div className="cards two">
        <button className="choice spot" onClick={() => onPick("just_spotlight")}>
          <div className="choice-rule" />
          <div className="choice-tag">Recommended to start</div>
          <div className="choice-name">Just Spotlight</div>
          <p className="choice-desc">One profile, one identity. You can open a Backstage from your dashboard at any time — nothing locks you out.</p>
          <div className="choice-meta">
            <span>One handle</span><span>Stripe</span><span>Add Backstage later</span>
          </div>
        </button>
        <button className="choice back" onClick={() => onPick("with_backstage")}>
          <div className="choice-rule" />
          <div className="choice-tag">Adult content · 18+ verified</div>
          <div className="choice-name">Spotlight + Backstage</div>
          <p className="choice-desc">Two public profiles, one dashboard, one wallet. Linked or unlinked is your call — off by default. Age verification and 2257 records handled before you publish.</p>
          <div className="choice-meta">
            <span>Two handles</span><span>CCBill for Backstage</span><span>Unlinked by default</span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Chat stage ────────────────────────────────────────────────────
function ChatStage({ backstageChoice, messages, chatInput, setChatInput, streaming, streamErr, onSubmit, onContinue, chatEndRef }: {
  backstageChoice: BackstageChoice | null; messages: ChatMessage[]; chatInput: string;
  setChatInput: (v: string) => void; streaming: boolean; streamErr: string | null;
  onSubmit: (e: FormEvent) => void; onContinue: () => void; chatEndRef: React.RefObject<HTMLDivElement>;
}) {
  const continuePrompt = messages.length >= 2;
  return (
    <div className="chat-stage">
      <p className="kicker">Step Two</p>
      <h1 className="title">Now let&apos;s <em>shape your stage.</em></h1>
      <p className="lede">A quick conversation about what you make and who it&apos;s for. No wrong answers.</p>
      <PathBadge backstageChoice={backstageChoice} />
      <div className="chat">
        <div className="chat-scroll">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content || (streaming && i === messages.length - 1 ? <Dots /> : null)}
            </div>
          ))}
          {streamErr && <div className="bubble error">⚠ {streamErr}</div>}
          <div ref={chatEndRef} />
        </div>
        <form className="chat-input" onSubmit={onSubmit}>
          <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            placeholder={streaming ? "Thinking…" : "Type your reply"} disabled={streaming} autoFocus />
          <button type="submit" disabled={streaming || !chatInput.trim()}>Send</button>
        </form>
        <button
          onClick={onContinue}
          style={{
            display: "block", width: "100%", border: "none",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: continuePrompt ? "20px" : "14px",
            background: continuePrompt ? "#f5c842" : "transparent",
            color: continuePrompt ? "#0a0a0f" : "#6b6b80",
            fontFamily: "DM Mono, monospace",
            fontSize: continuePrompt ? "12px" : "11px",
            letterSpacing: continuePrompt ? "0.18em" : "0.15em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontWeight: continuePrompt ? 600 : 400,
            transition: "all 0.2s ease",
          }}
        >
          {continuePrompt ? "Continue — claim your handle →" : "Skip to account creation"}
        </button>
      </div>
    </div>
  );
}

function PathBadge({ backstageChoice }: { backstageChoice: BackstageChoice | null }) {
  return (
    <div className="path-badge">
      <span className="pb spot">Spotlight</span>
      {backstageChoice === "with_backstage" && <span className="pb back">+ Backstage</span>}
    </div>
  );
}

function Dots() {
  return (
    <span className="typing"><span /><span /><span /></span>
  );
}

// ── Account form ──────────────────────────────────────────────────
function AccountForm({ backstageChoice, form, setForm, submitting, formErr, onSubmit }: {
  backstageChoice: BackstageChoice | null; form: AccountForm;
  setForm: React.Dispatch<React.SetStateAction<AccountForm>>; submitting: boolean;
  formErr: string | null; onSubmit: (e: FormEvent) => void;
}) {
  function update<K extends keyof AccountForm>(k: K, v: AccountForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  return (
    <div className="form-stage">
      <p className="kicker">Final Step</p>
      <h1 className="title">Claim <em>your handle.</em></h1>
      <p className="lede">Last bit. After this you&apos;re in the dashboard.</p>
      <form className="account-form" onSubmit={onSubmit}>
        <div className="field-row">
          <label><span>Email</span><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" required /></label>
          <label><span>Password</span><input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} autoComplete="new-password" minLength={8} required /></label>
        </div>
        <label><span>Display name</span><input type="text" value={form.displayName} onChange={(e) => update("displayName", e.target.value)} placeholder="The name your fans will see" required /></label>
        <label>
          <span>Spotlight handle<em className="hint">spotlightly.app/c/your-handle</em></span>
          <input type="text" value={form.spotlightHandle} onChange={(e) => update("spotlightHandle", e.target.value.toLowerCase())} placeholder="your-handle" required />
        </label>
        {backstageChoice === "with_backstage" && (
          <label>
            <span>Backstage handle<em className="hint">A different handle keeps identities separate</em></span>
            <input type="text" value={form.backstageHandle} onChange={(e) => update("backstageHandle", e.target.value.toLowerCase())} placeholder="alter-ego" required />
          </label>
        )}
        {formErr && <div className="form-err">⚠ {formErr}</div>}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginTop: 4 }}>
          <input type="checkbox" required style={{ marginTop: 3, flexShrink: 0, accentColor: "var(--accent-spot)", width: 16, height: 16 }} />
          <span style={{ fontSize: 12, color: "rgba(232,232,240,0.55)", lineHeight: 1.6, fontFamily: "var(--font-body)" }}>
            I am 18 or older and I agree to the{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-spot)" }}>Terms of Service</a>{" "}and{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-spot)" }}>Privacy Policy</a>.
          </span>
        </label>
        <button type="submit" className="submit" disabled={submitting}>
          {submitting ? "Setting up your stage…" : "Open the curtain →"}
        </button>
      </form>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
function SignupStyles() {
  return (
    <style jsx global>{`
      @import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap");
      :root {
        --bg: #0a0a0f; --surface: #111118; --surface-2: #161620;
        --border: rgba(255,255,255,0.08); --border-strong: rgba(255,255,255,0.18);
        --text: #e8e8f0; --muted: #6b6b80;
        --accent-spot: #f5c842; --accent-open: #6ee7b7; --accent-back: #c084fc; --red: #f87171;
      }
      html, body { background: var(--bg); color: var(--text); font-family: "DM Sans", -apple-system, sans-serif; font-weight: 300; }
      .signup {
        min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px 20px;
        background:
          radial-gradient(ellipse 60% 40% at 50% 30%, rgba(245,200,66,0.05) 0%, transparent 70%),
          radial-gradient(ellipse 40% 30% at 20% 90%, rgba(110,231,183,0.03) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 90% 80%, rgba(192,132,252,0.04) 0%, transparent 60%),
          var(--bg);
      }
      .frame { width: 100%; max-width: 920px; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; }
      .topbar { display: flex; align-items: center; justify-content: space-between; padding: 24px 36px; border-bottom: 1px solid var(--border); }
      .brand { font-family: "Cormorant Garamond", serif; font-size: 26px; font-weight: 300; letter-spacing: -0.01em; color: #fff; }
      .brand span { color: var(--accent-spot); }
      .dots { display: flex; gap: 6px; }
      .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.1); transition: all 0.3s; }
      .dot.on { background: var(--accent-spot); }
      .dot.active { width: 18px; border-radius: 3px; }
      .stage { padding: 56px 56px 64px; }
      .kicker { font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
      .title { font-family: "Cormorant Garamond", serif; font-size: clamp(32px,5vw,44px); font-weight: 300; line-height: 1.1; margin-bottom: 16px; color: #fff; }
      .title em { font-style: italic; color: var(--accent-spot); }
      .lede { font-size: 16px; line-height: 1.7; color: rgba(232,232,240,0.7); max-width: 580px; margin-bottom: 40px; }

      /* ── Referred welcome ── */
      .referred-stage {
        display: flex; flex-direction: column; align-items: center;
        text-align: center; padding: 24px 0 8px;
      }
      .ref-avatar-wrap {
        position: relative; width: 96px; height: 96px; margin-bottom: 28px;
      }
      .ref-avatar-img {
        width: 96px; height: 96px; border-radius: 50%; object-fit: cover;
        border: 2px solid rgba(245,200,66,0.25); display: block;
      }
      .ref-avatar-fallback {
        width: 96px; height: 96px; border-radius: 50%;
        background: rgba(245,200,66,0.08); border: 2px solid rgba(245,200,66,0.2);
        display: flex; align-items: center; justify-content: center;
        font-family: "Cormorant Garamond", serif; font-size: 40px; font-weight: 300;
        color: rgba(245,200,66,0.7);
      }
      .ref-avatar-ring {
        position: absolute; inset: -5px; border-radius: 50%;
        border: 1px solid rgba(245,200,66,0.15); pointer-events: none;
      }
      .ref-invited-by {
        font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: 0.22em;
        text-transform: uppercase; color: var(--muted); margin-bottom: 10px;
      }
      .ref-name {
        font-family: "Cormorant Garamond", serif; font-size: clamp(36px,6vw,54px);
        font-weight: 300; color: #fff; line-height: 1; margin-bottom: 8px;
      }
      .ref-handle {
        font-family: "DM Mono", monospace; font-size: 12px; color: var(--accent-spot);
        letter-spacing: 0.08em; margin-bottom: 28px;
      }
      .ref-lede {
        font-size: 16px; line-height: 1.7; color: rgba(232,232,240,0.6);
        max-width: 460px; margin-bottom: 40px;
      }
      .ref-cta {
        background: var(--accent-spot); color: #0a0a0f; border: none;
        padding: 16px 40px; font-family: "DM Mono", monospace; font-size: 12px;
        letter-spacing: 0.18em; text-transform: uppercase; font-weight: 500;
        cursor: pointer; border-radius: 3px; margin-bottom: 16px;
        transition: opacity 0.15s;
      }
      .ref-cta:hover { opacity: 0.88; }
      .ref-footnote {
        font-family: "DM Mono", monospace; font-size: 10px; color: var(--muted);
        letter-spacing: 0.1em;
      }

      /* ── Cards ── */
      .cards { display: grid; gap: 16px; }
      .cards.two { grid-template-columns: 1fr 1fr; }
      .choice { text-align: left; background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; padding: 32px 28px; cursor: pointer; position: relative; overflow: hidden; transition: all 0.2s ease; font-family: inherit; color: inherit; }
      .choice:hover { border-color: var(--border-strong); transform: translateY(-2px); }
      .choice-rule { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
      .choice.spot .choice-rule { background: var(--accent-spot); }
      .choice.back .choice-rule { background: var(--accent-back); }
      .choice-tag { font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
      .choice-name { font-family: "Cormorant Garamond", serif; font-size: 30px; font-weight: 400; margin-bottom: 12px; }
      .choice.spot .choice-name { color: var(--accent-spot); }
      .choice.back .choice-name { color: var(--accent-back); }
      .choice-desc { font-size: 14px; line-height: 1.7; color: rgba(232,232,240,0.65); margin-bottom: 20px; }
      .choice-meta { display: flex; flex-wrap: wrap; gap: 6px; }
      .choice-meta span { font-family: "DM Mono", monospace; font-size: 10px; padding: 4px 10px; border: 1px solid var(--border); border-radius: 2px; color: var(--muted); }

      /* ── Chat ── */
      .path-badge { display: flex; gap: 6px; margin-bottom: 24px; }
      .pb { font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 12px; border-radius: 2px; border: 1px solid var(--border); }
      .pb.spot { color: var(--accent-spot); background: rgba(245,200,66,0.08); border-color: rgba(245,200,66,0.2); }
      .pb.back { color: var(--accent-back); background: rgba(192,132,252,0.08); border-color: rgba(192,132,252,0.2); }
      .chat { background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
      .chat-scroll { height: 380px; overflow-y: auto; padding: 24px 28px; display: flex; flex-direction: column; gap: 14px; }
      .bubble { max-width: 82%; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; }
      .bubble.assistant { background: rgba(255,255,255,0.04); color: rgba(232,232,240,0.9); border-top-left-radius: 2px; align-self: flex-start; }
      .bubble.user { background: rgba(245,200,66,0.12); color: var(--text); border-top-right-radius: 2px; align-self: flex-end; border: 1px solid rgba(245,200,66,0.2); }
      .bubble.error { background: rgba(248,113,113,0.08); color: var(--red); border: 1px solid rgba(248,113,113,0.2); align-self: stretch; font-size: 13px; }
      .typing { display: inline-flex; gap: 4px; align-items: center; height: 18px; }
      .typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: typing 1.2s infinite; }
      .typing span:nth-child(2) { animation-delay: 0.15s; }
      .typing span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes typing { 0%,60%,100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
      .chat-input { display: flex; border-top: 1px solid var(--border); }
      .chat-input input { flex: 1; background: transparent; border: none; padding: 16px 20px; color: var(--text); font-family: inherit; font-size: 14px; outline: none; }
      .chat-input input::placeholder { color: var(--muted); }
      .chat-input button { background: var(--accent-spot); color: #0a0a0f; border: none; padding: 0 28px; font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 500; cursor: pointer; transition: opacity 0.15s; }
      .chat-input button:disabled { opacity: 0.3; cursor: not-allowed; }
      .continue { display: block; width: 100%; background: transparent; border: none; border-top: 1px solid var(--border); padding: 18px; color: var(--muted); font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
      .continue:hover { color: var(--text); background: rgba(255,255,255,0.02); }
      .continue.ready { color: #0a0a0f; background: var(--accent-spot); font-size: 12px; letter-spacing: 0.18em; }
      .continue.ready:hover { opacity: 0.9; }

      /* ── Form ── */
      .account-form { display: flex; flex-direction: column; gap: 20px; max-width: 540px; }
      .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .account-form label { display: flex; flex-direction: column; gap: 8px; }
      .account-form label > span { font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); display: flex; justify-content: space-between; align-items: baseline; }
      .account-form label .hint { font-style: normal; text-transform: none; letter-spacing: 0; font-size: 11px; color: var(--muted); font-family: "DM Sans", sans-serif; font-weight: 300; }
      .account-form input[type="text"], .account-form input[type="email"], .account-form input[type="password"] { background: var(--surface-2); border: 1px solid var(--border); padding: 14px 16px; color: var(--text); font-family: inherit; font-size: 14px; border-radius: 3px; outline: none; transition: border-color 0.15s; }
      .account-form input:focus { border-color: var(--accent-spot); }
      .account-form input::placeholder { color: var(--muted); }
      .form-err { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); padding: 12px 16px; color: var(--red); font-size: 13px; border-radius: 3px; }
      .submit { background: var(--accent-spot); color: #0a0a0f; border: none; padding: 16px 24px; font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 500; cursor: pointer; border-radius: 3px; margin-top: 12px; transition: opacity 0.15s; }
      .submit:disabled { opacity: 0.5; cursor: not-allowed; }

      @media (max-width: 700px) {
        .stage { padding: 36px 24px 40px; }
        .topbar { padding: 18px 24px; }
        .cards.two { grid-template-columns: 1fr; }
        .field-row { grid-template-columns: 1fr; }
        .chat-scroll { height: 320px; }
        .ref-name { font-size: 36px; }
      }
    `}</style>
  );
}
