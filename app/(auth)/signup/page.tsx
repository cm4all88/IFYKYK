"use client";
import { useState, useRef, useEffect, FormEvent, type RefObject, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Channel {
  name: string;
  slug: string;
  content_rating: "G" | "PG" | "M" | "R" | "X";
  monthly_price: number;
}

interface PlanData {
  ready: boolean;
  creator_type?: "spotlight" | "backstage" | "opening_act";
  recommended_tier?: string;
  estimated_monthly_revenue?: string;
  channels?: Channel[];
  warm_moment?: string;
  rationale?: string;
}

type Phase = "chat" | "account";

const PASSWORD_MIN = 8;
const OPENING_LINE = "Hey. I'm here to figure out the best setup for you. So tell me - what do you do?";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>("chat");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: OPENING_LINE }]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [planCollapsed, setPlanCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  async function streamAdvisor(history: Message[]) {
    setStreaming(true);
    setStreamError(null);
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      // Drop the synthetic opening greeting from history before sending - it's UX, not real history
      const apiHistory = history.filter((m, i) => !(i === 0 && m.role === "assistant" && m.content === OPENING_LINE));
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiHistory }),
      });
      if (!res.ok || !res.body) throw new Error(`Advisor returned ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              assembled += parsed.text;
              setMessages([...history, { role: "assistant", content: assembled }]);
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch {}
        }
      }

      const planMatch = assembled.match(/```json\s*([\s\S]*?)\s*```/);
      if (planMatch) {
        try {
          const parsed = JSON.parse(planMatch[1]) as PlanData;
          if (parsed.ready) {
            setPlan(parsed);
            setTimeout(() => setPhase("account"), 800);
          }
        } catch {}
      }
    } catch (err) {
      console.error("Advisor stream error:", err);
      setStreamError("Connection hiccup. Try again?");
      setMessages(history);
    } finally {
      setStreaming(false);
    }
  }

  async function sendChat(e: FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || streaming) return;
    const next: Message[] = [...messages, { role: "user", content: chatInput }];
    setChatInput("");
    await streamAdvisor(next);
  }

  function retryStream() {
    if (messages.length === 0) return;
    const truncated = messages.slice(0, -1);
    streamAdvisor(truncated);
  }

  function validateAccount(): string | null {
    if (!displayName.trim()) return "Display name is required.";
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanHandle.length < 3) return "Handle must be at least 3 characters.";
    if (cleanHandle.length > 30) return "Handle must be 30 characters or fewer.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "That email does not look right.";
    if (password.length < PASSWORD_MIN) return `Password needs at least ${PASSWORD_MIN} characters.`;
    return null;
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    const validationError = validateAccount();
    if (validationError) { setFormError(validationError); return; }
    setSubmitting(true);
    setFormError(null);

    try {
      const creator_type = plan?.creator_type ?? "spotlight";
      const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_]/g, "");

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: displayName, creator_type, handle: cleanHandle } },
      });
      if (authError) { setFormError(authError.message); setSubmitting(false); return; }
      if (!authData.user) { setFormError("Account creation failed. Try again?"); setSubmitting(false); return; }

      const { data: creator, error: creatorError } = await supabase
        .from("creators")
        .insert({ user_id: authData.user.id, handle: cleanHandle, display_name: displayName, creator_type })
        .select().single();
      if (creatorError || !creator) {
        if (creatorError?.message.includes("duplicate") || creatorError?.message.includes("unique")) {
          setFormError("That handle is taken. Try another?");
        } else {
          setFormError(creatorError?.message ?? "Could not create your creator profile.");
        }
        setSubmitting(false);
        return;
      }

      if (plan?.channels && plan.channels.length > 0) {
        const channelRows = plan.channels.map((ch, i) => ({
          creator_id: creator.id,
          name: ch.name,
          slug: ch.slug,
          content_rating: ch.content_rating,
          subscription_price: ch.monthly_price,
          sort_order: i,
        }));
        await supabase.from("channels").insert(channelRows);
      }

      if (creator_type === "backstage") router.push("/verify");
      else if (creator_type === "opening_act") router.push("/verify/parent");
      else router.push("/onboarding");
    } catch (err) {
      console.error(err);
      setFormError("Something went wrong. Try again?");
      setSubmitting(false);
    }
  }
  return (
    <div style={S.shell}>
      <div style={S.logo}>
        <div style={S.logoMark}>S</div>
        <span style={S.logoText}>Spotlightly</span>
      </div>

      <div style={S.container}>
        {phase === "chat" && (
          <>
            <div style={S.chatBox}>
              {messages.map((m, i) => {
                const cleanContent = m.content.replace(/```json[\s\S]*?```/g, "").trim();
                const isLastAssistant = i === messages.length - 1 && m.role === "assistant";
                const showDots = streaming && isLastAssistant && cleanContent === "";
                return (
                  <div key={i} style={{ marginBottom: 14, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "86%", background: m.role === "user" ? "#d4680a" : "#faf8f4", color: m.role === "user" ? "#fff" : "#1a1614", padding: "12px 16px", borderRadius: 16, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {showDots ? (
                        <span style={{ display: "inline-flex", gap: 4 }}>
                          {[0,1,2].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#7a6e64", animation: `dot-pulse 1.2s ${d * 0.15}s infinite ease-in-out` }} />)}
                          <style>{`@keyframes dot-pulse { 0%,80%,100% { opacity: 0.3 } 40% { opacity: 1 } }`}</style>
                        </span>
                      ) : cleanContent}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {streamError && (
              <div style={S.errorBanner}>
                {streamError} <button onClick={retryStream} style={S.retryBtn}>Retry</button>
              </div>
            )}

            <form onSubmit={sendChat} style={S.chatForm}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={streaming ? "Thinking..." : "Type your answer..."} disabled={streaming} style={S.chatInput} autoFocus />
              <button type="submit" disabled={streaming || !chatInput.trim()} style={{ ...S.primaryButton, width: "auto", padding: "0 22px", opacity: streaming || !chatInput.trim() ? 0.5 : 1 }}>Send</button>
            </form>
          </>
        )}

        {phase === "account" && plan?.ready && (
          <>
            <h1 style={S.h1}>Ready to start?</h1>
            <p style={S.subtitle}>Let us get your page live.</p>

            <div style={S.planCard}>
              <button onClick={() => setPlanCollapsed(!planCollapsed)} style={S.planHeader}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#7a6e64", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your Plan</span>
                <span style={{ fontSize: 13, color: "#7a6e64" }}>{planCollapsed ? "Show" : "Hide"}</span>
              </button>
              {!planCollapsed && (
                <div style={{ padding: "0 20px 20px" }}>
                  {plan.estimated_monthly_revenue && (
                    <div style={S.planRow}><span style={S.planLabel}>Projected monthly revenue</span><span style={{ ...S.planValue, color: "#2a8a50" }}>{plan.estimated_monthly_revenue}</span></div>
                  )}
                  {plan.recommended_tier && (
                    <div style={S.planRow}><span style={S.planLabel}>Recommended tier</span><span style={S.planValue}>{plan.recommended_tier.charAt(0).toUpperCase() + plan.recommended_tier.slice(1)}</span></div>
                  )}
                  {plan.channels && plan.channels.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={S.planLabel}>Your channels</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        {plan.channels.map((ch, i) => (
                          <div key={i} style={{ background: "#faf8f4", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1614" }}>{ch.name}</div>
                              <div style={{ fontSize: 12, color: "#7a6e64", marginTop: 2 }}>Rating: {ch.content_rating}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1614" }}>${ch.monthly_price.toFixed(2)}/mo</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {plan.warm_moment && (
                    <div style={{ marginTop: 14 }}>
                      <div style={S.planLabel}>Your warm moment</div>
                      <div style={{ fontSize: 14, color: "#1a1614", marginTop: 4, lineHeight: 1.55 }}>{plan.warm_moment}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={createAccount} style={S.formCard}>
              <Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Your name" />
              <Field label="Handle" value={handle} onChange={setHandle} placeholder="yourname" prefix="@" />
              <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
              <Field label="Password" value={password} onChange={setPassword} type="password" placeholder={`At least ${PASSWORD_MIN} characters`} />
              {formError && <div style={S.formError}>{formError}</div>}
              <button type="submit" disabled={submitting} style={{ ...S.primaryButton, marginTop: 8, opacity: submitting ? 0.7 : 1 }}>{submitting ? "Creating your page..." : "Start your page"}</button>
            </form>
          </>
        )}

        <p style={S.signinLink}>Already have an account? <a href="/login" style={S.link}>Sign in</a></p>
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (s: string) => void; type?: string; placeholder?: string; prefix?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={S.fieldLabel}>{props.label}</label>
      <div style={S.fieldWrap}>
        {props.prefix && <span style={S.fieldPrefix}>{props.prefix}</span>}
        <input type={props.type ?? "text"} value={props.value} onChange={e => props.onChange(e.target.value)} placeholder={props.placeholder} style={S.fieldInput} required />
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  shell: { minHeight: "100vh", background: "#faf8f4", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" },
  container: { width: "100%", maxWidth: 640 },
  logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 32 },
  logoMark: { width: 32, height: 32, background: "#d4680a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff" },
  logoText: { fontSize: 20, fontWeight: 800, color: "#1a1614" },
  h1: { textAlign: "center", fontSize: 28, fontWeight: 800, color: "#1a1614", letterSpacing: "-0.03em", marginBottom: 12, marginTop: 0 },
  subtitle: { textAlign: "center", color: "#7a6e64", marginBottom: 24, fontSize: 16 },
  chatBox: { background: "#fff", border: "1px solid #e8e0d4", borderRadius: 16, padding: 20, marginBottom: 14, minHeight: 320, maxHeight: 540, overflowY: "auto" },
  chatForm: { display: "flex", gap: 8 },
  chatInput: { flex: 1, background: "#fff", border: "1px solid #e8e0d4", borderRadius: 12, padding: "14px 16px", fontSize: 15, outline: "none", color: "#1a1614" },
  primaryButton: { width: "100%", background: "#d4680a", border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  errorBanner: { background: "rgba(200,48,48,0.07)", color: "#c83030", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" },
  retryBtn: { background: "#c83030", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  planCard: { background: "#fff", border: "1px solid #e8e0d4", borderRadius: 16, marginBottom: 16, overflow: "hidden" },
  planHeader: { width: "100%", padding: "16px 20px", background: "transparent", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f2ede4" },
  planRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px dashed #f2ede4" },
  planLabel: { fontSize: 12, fontWeight: 700, color: "#7a6e64", textTransform: "uppercase", letterSpacing: "0.06em" },
  planValue: { fontSize: 16, fontWeight: 700, color: "#1a1614" },
  formCard: { background: "#fff", border: "1px solid #e8e0d4", borderRadius: 16, padding: 24 },
  fieldLabel: { display: "block", color: "#7a6e64", fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" },
  fieldWrap: { display: "flex", alignItems: "center", background: "#faf8f4", border: "1px solid #e8e0d4", borderRadius: 10 },
  fieldPrefix: { paddingLeft: 14, color: "#7a6e64", fontSize: 14 },
  fieldInput: { width: "100%", background: "transparent", border: "none", padding: "11px 14px", fontSize: 14, color: "#1a1614", outline: "none" },
  formError: { color: "#c83030", fontSize: 13, marginBottom: 14, background: "rgba(200,48,48,0.07)", borderRadius: 8, padding: "8px 12px" },
  signinLink: { textAlign: "center", marginTop: 24, color: "#7a6e64", fontSize: 14 },
  link: { color: "#d4680a", fontWeight: 600, textDecoration: "none" },
};