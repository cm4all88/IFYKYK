"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import type { Database } from "@/lib/database.types";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

type Phase = "pick_backstage" | "chat" | "account";
type BackstageChoice = "just_spotlight" | "with_backstage";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AccountForm = {
  email: string;
  password: string;
  displayName: string;
  spotlightHandle: string;
  backstageHandle: string; // only used when backstageChoice === "with_backstage"
};

const HANDLE_RE = /^[a-zA-Z0-9_-]{3,30}$/;

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>("pick_backstage");
  const [backstageChoice, setBackstageChoice] = useState<BackstageChoice | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamErr, setStreamErr] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Account state
  const [form, setForm] = useState<AccountForm>({
    email: "",
    password: "",
    displayName: "",
    spotlightHandle: "",
    backstageHandle: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  // ────────────────────────────────────────────────────────────────
  // Phase transitions
  // ────────────────────────────────────────────────────────────────

  function pickBackstage(c: BackstageChoice) {
    setBackstageChoice(c);
    setPhase("chat");
  }

  function continueToAccount() {
    abortRef.current?.abort();
    setPhase("account");
  }

  // ────────────────────────────────────────────────────────────────
  // Scroll chat to bottom on new messages
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Persist ?ref= param to localStorage so it survives navigation
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("spotlightly_creator_ref", ref);
  }, []);

  // Kick off the conversation when we land on the chat phase
  useEffect(() => {
    if (phase === "chat" && messages.length === 0 && !streaming) {
      void sendToAdvisor([], { isOpening: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function sendToAdvisor(
    history: ChatMessage[],
    opts: { isOpening?: boolean } = {}
  ) {
    setStreamErr(null);
    setStreaming(true);

    // Append an empty assistant bubble we'll fill as tokens arrive
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: opts.isOpening ? [] : history,
          backstageChoice,
          opening: !!opts.isOpening,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Advisor responded ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: acc };
          }
          return next;
        });
      }

      if (acc.trim().length === 0) {
        setMessages((m) => m.slice(0, -1));
        setStreamErr("The advisor didn't respond. Try sending again.");
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

  // ────────────────────────────────────────────────────────────────
  // Account form
  // ────────────────────────────────────────────────────────────────

  function validateAccount(): string | null {
    const f = form;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "Enter a valid email.";
    if (f.password.length < 8) return "Password must be at least 8 characters.";
    if (!f.displayName.trim()) return "Display name is required.";

    if (!HANDLE_RE.test(f.spotlightHandle)) {
      return "Spotlight handle must be 3–30 chars: lowercase letters, numbers, dashes, underscores.";
    }

    if (backstageChoice === "with_backstage") {
      if (!HANDLE_RE.test(f.backstageHandle)) {
        return "Backstage handle must be 3–30 chars: lowercase letters, numbers, dashes, underscores.";
      }
      if (f.backstageHandle === f.spotlightHandle) {
        return "Use a different handle for Backstage to keep identities separate.";
      }
    }

    return null;
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    setFormErr(null);

    const v = validateAccount();
    if (v) {
      setFormErr(v);
      return;
    }

    setSubmitting(true);

    try {
      // 1. Auth signup
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Signup succeeded but no user was returned.");

      // 2. Build the rows to insert
      const rows: Database["public"]["Tables"]["creator_profiles"]["Insert"][] = [];

      rows.push({
        user_id: userId,
        kind: "spotlight",
        handle: form.spotlightHandle,
        display_name: form.displayName,
        creator_type: "spotlight",
        linked: false,
      });

      if (backstageChoice === "with_backstage") {
        rows.push({
          user_id: userId,
          kind: "backstage",
          handle: form.backstageHandle,
          display_name: form.displayName,
          creator_type: "backstage",
          linked: false,
        });
      }

      const { error: insertErr } = await supabase
        .from("creator_profiles")
        .insert(rows);
      if (insertErr) throw insertErr;

      // Welcome email (fire and forget)
      fetch("/api/email/welcome", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email: form.email}) }).catch(()=>{});

      // Start 30-day free trial
      fetch("/api/billing", { method:"POST" }).catch(()=>{});

      // Record creator referral if ?ref= was present
      const refHandle = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("ref")
          ?? localStorage.getItem("spotlightly_creator_ref")
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

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <main className="signup">
      <div className="frame">
        <header className="topbar">
          <div className="brand">
            Spot<span>light</span>ly
          </div>
          <PhaseDots phase={phase} />
        </header>

        <div className="stage">
          {phase === "pick_backstage" && (
            <BackstagePicker onPick={pickBackstage} />
          )}

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

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function PhaseDots({ phase }: { phase: Phase }) {
  const steps: Phase[] = ["pick_backstage", "chat", "account"];
  const idx = steps.indexOf(phase);

  return (
    <div className="dots">
      {steps.map((s, i) => (
        <span
          key={s}
          className={`dot ${i <= idx ? "on" : ""} ${i === idx ? "active" : ""}`}
        />
      ))}
    </div>
  );
}

function BackstagePicker({
  onPick,
}: {
  onPick: (c: BackstageChoice) => void;
}) {
  return (
    <div className="picker">
      <p className="kicker">Step One</p>
      <h1 className="title">
        Are you opening <em>a Backstage</em> too?
      </h1>
      <p className="lede">
        Backstage is our adult-content tier. It&apos;s a separate public
        profile — nobody sees the connection to your Spotlight unless you choose
        to link them. You can add it later from your dashboard, but if you know
        now, it saves a step.
      </p>

      <div className="cards two">
        <button
          className="choice spot"
          onClick={() => onPick("just_spotlight")}
        >
          <div className="choice-rule" />
          <div className="choice-tag">Recommended to start</div>
          <div className="choice-name">Just Spotlight</div>
          <p className="choice-desc">
            One profile, one identity. You can open a Backstage from your
            dashboard at any time — nothing locks you out.
          </p>
          <div className="choice-meta">
            <span>One handle</span>
            <span>Stripe</span>
            <span>Add Backstage later</span>
          </div>
        </button>

        <button
          className="choice back"
          onClick={() => onPick("with_backstage")}
        >
          <div className="choice-rule" />
          <div className="choice-tag">Adult content · 18+ verified</div>
          <div className="choice-name">Spotlight + Backstage</div>
          <p className="choice-desc">
            Two public profiles, one dashboard, one wallet. Linked or unlinked
            is your call — and it&apos;s off by default. Age verification and
            2257 records handled before you publish.
          </p>
          <div className="choice-meta">
            <span>Two handles</span>
            <span>CCBill for Backstage</span>
            <span>Unlinked by default</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function ChatStage({
  backstageChoice,
  messages,
  chatInput,
  setChatInput,
  streaming,
  streamErr,
  onSubmit,
  onContinue,
  chatEndRef,
}: {
  backstageChoice: BackstageChoice | null;
  messages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  streaming: boolean;
  streamErr: string | null;
  onSubmit: (e: FormEvent) => void;
  onContinue: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
}) {
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const continuePrompt = userMsgCount >= 1;

  return (
    <div className="chat-stage">
      <p className="kicker">Step Two</p>
      <h1 className="title">
        Now let&apos;s <em>shape your stage.</em>
      </h1>
      <p className="lede">
        A quick conversation about what you make and who it&apos;s for.
        We&apos;ll use it to set up your profile sensibly. No wrong answers.
      </p>

      <PathBadge backstageChoice={backstageChoice} />

      <div className="chat">
        <div className="chat-scroll">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content ||
                (streaming && i === messages.length - 1 ? <Dots /> : null)}
            </div>
          ))}
          {streamErr && <div className="bubble error">⚠ {streamErr}</div>}
          <div ref={chatEndRef} />
        </div>

        <form className="chat-input" onSubmit={onSubmit}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={streaming ? "Thinking…" : "Type your reply"}
            disabled={streaming}
            autoFocus
          />
          <button type="submit" disabled={streaming || !chatInput.trim()}>
            Send
          </button>
        </form>

        <button
          className={`continue ${continuePrompt ? "ready" : ""}`}
          onClick={onContinue}
        >
          {continuePrompt
            ? "Continue to account →"
            : "Skip ahead to account creation"}
        </button>
      </div>
    </div>
  );
}

function PathBadge({
  backstageChoice,
}: {
  backstageChoice: BackstageChoice | null;
}) {
  return (
    <div className="path-badge">
      <span className="pb spot">Spotlight</span>
      {backstageChoice === "with_backstage" && (
        <span className="pb back">+ Backstage</span>
      )}
    </div>
  );
}

function Dots() {
  return (
    <span className="typing">
      <span />
      <span />
      <span />
    </span>
  );
}

function AccountForm({
  backstageChoice,
  form,
  setForm,
  submitting,
  formErr,
  onSubmit,
}: {
  backstageChoice: BackstageChoice | null;
  form: AccountForm;
  setForm: React.Dispatch<React.SetStateAction<AccountForm>>;
  submitting: boolean;
  formErr: string | null;
  onSubmit: (e: FormEvent) => void;
}) {
  function update<K extends keyof AccountForm>(k: K, v: AccountForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="form-stage">
      <p className="kicker">Final Step</p>
      <h1 className="title">
        Claim <em>your handle.</em>
      </h1>
      <p className="lede">Last bit. After this you&apos;re in the dashboard.</p>

      <form className="account-form" onSubmit={onSubmit}>
        <div className="field-row">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        </div>

        <label>
          <span>Display name</span>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            placeholder="The name your fans will see"
            required
          />
        </label>

        <label>
          <span>
            Spotlight handle
            <em className="hint">spotlightly.app/c/your-handle</em>
          </span>
          <input
            type="text"
            value={form.spotlightHandle}
            onChange={(e) =>
              update("spotlightHandle", e.target.value.toLowerCase())
            }
            placeholder="your-handle"
            required
          />
        </label>

        {backstageChoice === "with_backstage" && (
          <label>
            <span>
              Backstage handle
              <em className="hint">
                A different handle keeps your identities separate
              </em>
            </span>
            <input
              type="text"
              value={form.backstageHandle}
              onChange={(e) =>
                update("backstageHandle", e.target.value.toLowerCase())
              }
              placeholder="alter-ego"
              required
            />
          </label>
        )}

        {formErr && <div className="form-err">⚠ {formErr}</div>}

        <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", marginTop:4 }}>
          <input
            type="checkbox"
            required
            style={{ marginTop:3, flexShrink:0, accentColor:"var(--accent)", width:16, height:16 }}
          />
          <span style={{ fontSize:12, color:"rgba(232,232,240,0.55)", lineHeight:1.6, fontFamily:"var(--font-body)" }}>
            I am 18 or older and I agree to the{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color:"var(--accent)" }}>Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color:"var(--accent)" }}>Privacy Policy</a>.
          </span>
        </label>

        <button type="submit" className="submit" disabled={submitting}>
          {submitting ? "Setting up your stage…" : "Open the curtain →"}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Styles — bible-aligned dark/serif/mono aesthetic
// ──────────────────────────────────────────────────────────────────

function SignupStyles() {
  return (
    <style jsx global>{`
      @import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap");

      :root {
        --bg: #0a0a0f;
        --surface: #111118;
        --surface-2: #161620;
        --border: rgba(255, 255, 255, 0.08);
        --border-strong: rgba(255, 255, 255, 0.18);
        --text: #e8e8f0;
        --muted: #6b6b80;
        --accent-spot: #f5c842;
        --accent-open: #6ee7b7;
        --accent-back: #c084fc;
        --red: #f87171;
      }

      html,
      body {
        background: var(--bg);
        color: var(--text);
        font-family: "DM Sans", -apple-system, sans-serif;
        font-weight: 300;
      }

      .signup {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 20px;
        background:
          radial-gradient(ellipse 60% 40% at 50% 30%, rgba(245, 200, 66, 0.05) 0%, transparent 70%),
          radial-gradient(ellipse 40% 30% at 20% 90%, rgba(110, 231, 183, 0.03) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 90% 80%, rgba(192, 132, 252, 0.04) 0%, transparent 60%),
          var(--bg);
      }

      .frame {
        width: 100%;
        max-width: 920px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 4px;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px 36px;
        border-bottom: 1px solid var(--border);
      }

      .brand {
        font-family: "Cormorant Garamond", serif;
        font-size: 26px;
        font-weight: 300;
        letter-spacing: -0.01em;
        color: #fff;
      }
      .brand span {
        color: var(--accent-spot);
      }

      .dots {
        display: flex;
        gap: 6px;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        transition: all 0.3s;
      }
      .dot.on {
        background: var(--accent-spot);
      }
      .dot.active {
        width: 18px;
        border-radius: 3px;
      }

      .stage {
        padding: 56px 56px 64px;
      }

      .kicker {
        font-family: "DM Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 14px;
      }

      .title {
        font-family: "Cormorant Garamond", serif;
        font-size: clamp(32px, 5vw, 44px);
        font-weight: 300;
        line-height: 1.1;
        margin-bottom: 16px;
        color: #fff;
      }
      .title em {
        font-style: italic;
        color: var(--accent-spot);
      }

      .lede {
        font-size: 16px;
        line-height: 1.7;
        color: rgba(232, 232, 240, 0.7);
        max-width: 580px;
        margin-bottom: 40px;
      }

      /* CHOICE CARDS */
      .cards {
        display: grid;
        gap: 16px;
      }
      .cards.two {
        grid-template-columns: 1fr 1fr;
      }

      .choice {
        text-align: left;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 32px 28px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: all 0.2s ease;
        font-family: inherit;
        color: inherit;
      }

      .choice:hover {
        border-color: var(--border-strong);
        transform: translateY(-2px);
      }

      .choice-rule {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
      }
      .choice.open .choice-rule {
        background: var(--accent-open);
      }
      .choice.spot .choice-rule {
        background: var(--accent-spot);
      }
      .choice.back .choice-rule {
        background: var(--accent-back);
      }

      .choice-tag {
        font-family: "DM Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 14px;
      }

      .choice-name {
        font-family: "Cormorant Garamond", serif;
        font-size: 30px;
        font-weight: 400;
        margin-bottom: 12px;
      }
      .choice.open .choice-name {
        color: var(--accent-open);
      }
      .choice.spot .choice-name {
        color: var(--accent-spot);
      }
      .choice.back .choice-name {
        color: var(--accent-back);
      }

      .choice-desc {
        font-size: 14px;
        line-height: 1.7;
        color: rgba(232, 232, 240, 0.65);
        margin-bottom: 20px;
      }

      .choice-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .choice-meta span {
        font-family: "DM Mono", monospace;
        font-size: 10px;
        padding: 4px 10px;
        border: 1px solid var(--border);
        border-radius: 2px;
        color: var(--muted);
      }

      /* CHAT */
      .path-badge {
        display: flex;
        gap: 6px;
        margin-bottom: 24px;
      }
      .pb {
        font-family: "DM Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        padding: 6px 12px;
        border-radius: 2px;
        border: 1px solid var(--border);
      }
      .pb.open {
        color: var(--accent-open);
        background: rgba(110, 231, 183, 0.08);
        border-color: rgba(110, 231, 183, 0.2);
      }
      .pb.spot {
        color: var(--accent-spot);
        background: rgba(245, 200, 66, 0.08);
        border-color: rgba(245, 200, 66, 0.2);
      }
      .pb.back {
        color: var(--accent-back);
        background: rgba(192, 132, 252, 0.08);
        border-color: rgba(192, 132, 252, 0.2);
      }

      .chat {
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 4px;
        overflow: hidden;
      }

      .chat-scroll {
        height: 380px;
        overflow-y: auto;
        padding: 24px 28px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .bubble {
        max-width: 82%;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .bubble.assistant {
        background: rgba(255, 255, 255, 0.04);
        color: rgba(232, 232, 240, 0.9);
        border-top-left-radius: 2px;
        align-self: flex-start;
      }
      .bubble.user {
        background: rgba(245, 200, 66, 0.12);
        color: var(--text);
        border-top-right-radius: 2px;
        align-self: flex-end;
        border: 1px solid rgba(245, 200, 66, 0.2);
      }
      .bubble.error {
        background: rgba(248, 113, 113, 0.08);
        color: var(--red);
        border: 1px solid rgba(248, 113, 113, 0.2);
        align-self: stretch;
        font-size: 13px;
      }

      .typing {
        display: inline-flex;
        gap: 4px;
        align-items: center;
        height: 18px;
      }
      .typing span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--muted);
        animation: typing 1.2s infinite;
      }
      .typing span:nth-child(2) {
        animation-delay: 0.15s;
      }
      .typing span:nth-child(3) {
        animation-delay: 0.3s;
      }
      @keyframes typing {
        0%, 60%, 100% {
          opacity: 0.3;
          transform: translateY(0);
        }
        30% {
          opacity: 1;
          transform: translateY(-3px);
        }
      }

      .chat-input {
        display: flex;
        gap: 0;
        border-top: 1px solid var(--border);
      }
      .chat-input input {
        flex: 1;
        background: transparent;
        border: none;
        padding: 16px 20px;
        color: var(--text);
        font-family: inherit;
        font-size: 14px;
        outline: none;
      }
      .chat-input input::placeholder {
        color: var(--muted);
      }
      .chat-input button {
        background: var(--accent-spot);
        color: #0a0a0f;
        border: none;
        padding: 0 28px;
        font-family: "DM Mono", monospace;
        font-size: 11px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .chat-input button:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .continue {
        display: block;
        width: 100%;
        background: transparent;
        border: none;
        border-top: 1px solid var(--border);
        padding: 16px;
        color: var(--muted);
        font-family: "DM Mono", monospace;
        font-size: 11px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.15s;
      }
      .continue:hover {
        color: var(--text);
        background: rgba(255, 255, 255, 0.02);
      }
      .continue.ready {
        color: var(--accent-spot);
      }

      /* FORM */
      .account-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 540px;
      }

      .field-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .account-form label {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .account-form label > span {
        font-family: "DM Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--muted);
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .account-form label .hint {
        font-style: normal;
        text-transform: none;
        letter-spacing: 0;
        font-size: 11px;
        color: var(--muted);
        font-family: "DM Sans", sans-serif;
        font-weight: 300;
      }

      .account-form input[type="text"],
      .account-form input[type="email"],
      .account-form input[type="password"] {
        background: var(--surface-2);
        border: 1px solid var(--border);
        padding: 14px 16px;
        color: var(--text);
        font-family: inherit;
        font-size: 14px;
        border-radius: 3px;
        outline: none;
        transition: border-color 0.15s;
      }
      .account-form input:focus {
        border-color: var(--accent-spot);
      }
      .account-form input::placeholder {
        color: var(--muted);
      }

      .form-err {
        background: rgba(248, 113, 113, 0.08);
        border: 1px solid rgba(248, 113, 113, 0.2);
        padding: 12px 16px;
        color: var(--red);
        font-size: 13px;
        border-radius: 3px;
      }

      .submit {
        background: var(--accent-spot);
        color: #0a0a0f;
        border: none;
        padding: 16px 24px;
        font-family: "DM Mono", monospace;
        font-size: 11px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        font-weight: 500;
        cursor: pointer;
        border-radius: 3px;
        margin-top: 12px;
        transition: opacity 0.15s;
      }
      .submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (max-width: 700px) {
        .stage {
          padding: 36px 24px 40px;
        }
        .topbar {
          padding: 18px 24px;
        }
        .cards.two {
          grid-template-columns: 1fr;
        }
        .field-row {
          grid-template-columns: 1fr;
        }
        .chat-scroll {
          height: 320px;
        }
      }
    `}</style>
  );
}
