"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";

interface Message {
  id: string;
  display_name: string;
  message: string;
  is_tip?: boolean;
  tip_amount_usd?: number;
  created_at: string;
  moderated?: boolean;
}

interface Tip {
  id: string;
  display_name: string;
  amount_usd: number;
  message?: string;
  created_at: string;
}

interface Props {
  streamId: string;
  playbackUrl: string;
  isCreator?: boolean;
  creatorHandle?: string;
  isBackstage?: boolean;
  children?: React.ReactNode; // stream video/controls slot
}

export default function LiveStreamView({
  streamId, playbackUrl, isCreator, creatorHandle, isBackstage, children
}: Props) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [input, setInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sending, setSending] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipMsg, setTipMsg] = useState("");
  const [tipOpen, setTipOpen] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "leaderboard">("chat");
  const [userProfile, setUserProfile] = useState<{ display_name?: string } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load user profile for display name
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from("creator_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.display_name) setDisplayName(data.display_name);
      setUserProfile(data);
    });
  }, []);

  // Load initial messages
  useEffect(() => {
    fetch(`/api/live/chat?streamId=${streamId}`)
      .then(r => r.json())
      .then(d => setMessages(d.messages ?? []));

    fetch(`/api/live/tip?streamId=${streamId}`)
      .then(r => r.json())
      .then(d => setTips(d.tips ?? []));
  }, [streamId]);

  // Supabase Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`live_chat_${streamId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "live_chat_messages",
        filter: `stream_id=eq.${streamId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "live_stream_tips",
        filter: `stream_id=eq.${streamId}`,
      }, (payload) => {
        const tip = payload.new as Tip;
        setTips(prev => [...prev, tip].sort((a, b) => b.amount_usd - a.amount_usd));
        // Also inject into chat feed
        setMessages(prev => [...prev, {
          id: `tip-${tip.id}`,
          display_name: tip.display_name,
          message: tip.message || `Sent a $${tip.amount_usd} tip!`,
          is_tip: true,
          tip_amount_usd: tip.amount_usd,
          created_at: tip.created_at,
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamId]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim()) return;
    setSending(true);
    setMsgErr(null);

    const res = await fetch("/api/live/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streamId,
        message: input.trim(),
        displayName: displayName || "Audience",
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMsgErr(data.error);
    } else {
      setInput("");
    }
    setSending(false);
  }

  async function sendTip() {
    setTipping(true);
    const res = await fetch("/api/live/tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streamId,
        amountUsd: tipAmount,
        message: tipMsg.trim() || null,
        displayName: displayName || "Anonymous",
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.open(data.url, "_blank");
      setTipOpen(false);
      setTipMsg("");
    } else {
      setMsgErr(data.error || "Tip failed");
    }
    setTipping(false);
  }

  const TIP_AMOUNTS = [1, 5, 10, 25, 50, 100];

  const mono = "var(--font-mono, DM Mono, monospace)";
  const serif = "var(--font-serif, Cormorant Garamond, Georgia, serif)";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 380px",
      gap: 2,
      height: "calc(100vh - 60px)",
      background: "var(--bg)",
    }}>

      {/* LEFT — Stream */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, background: "#000", position: "relative" }}>
          {children || (
            <iframe
              src={playbackUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          )}
        </div>
        {isCreator && (
          <div style={{
            padding: "12px 20px",
            background: "var(--surface)",
            borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--red)", animation: "pulse 1.4s infinite" }} />
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--red)" }}>Live</span>
            </div>
            <span style={{ fontFamily: mono, fontSize: 11, color: "var(--muted)" }}>
              {messages.length} messages · ${tips.reduce((s, t) => s + t.amount_usd, 0).toFixed(0)} in tips
            </span>
          </div>
        )}
      </div>

      {/* RIGHT — Chat + Leaderboard */}
      <div style={{
        display: "flex", flexDirection: "column",
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        overflow: "hidden",
      }}>

        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {(["chat", "leaderboard"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "12px 0",
              fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
              background: "none", border: "none", cursor: "pointer",
              color: activeTab === tab ? "var(--accent)" : "var(--muted)",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.15s",
            }}>
              {tab === "chat" ? `💬 Chat` : `🏆 Leaderboard`}
            </button>
          ))}
        </div>

        {/* Chat tab */}
        {activeTab === "chat" && (
          <>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.length === 0 && (
                <p style={{ fontFamily: serif, fontSize: 16, fontStyle: "italic", color: "var(--muted)", textAlign: "center", marginTop: 40 }}>
                  Be the first to say something.
                </p>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{
                  display: "flex", flexDirection: "column", gap: 2,
                  padding: msg.is_tip ? "10px 12px" : "6px 0",
                  background: msg.is_tip ? "rgba(242,184,75,0.08)" : "transparent",
                  border: msg.is_tip ? "1px solid rgba(242,184,75,0.2)" : "none",
                  borderRadius: msg.is_tip ? 6 : 0,
                  borderLeft: msg.is_tip ? "3px solid var(--accent)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: msg.is_tip ? "var(--accent)" : "rgba(242,242,240,0.9)", flexShrink: 0 }}>
                      {msg.is_tip && "💛 "}
                      {msg.display_name}
                      {msg.is_tip && msg.tip_amount_usd && (
                        <span style={{ marginLeft: 6, color: "var(--accent)" }}>${msg.tip_amount_usd}</span>
                      )}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: "rgba(242,242,240,0.75)", lineHeight: 1.5 }}>
                    {msg.message}
                  </span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Error */}
            {msgErr && (
              <div style={{ padding: "8px 16px", background: "var(--red-soft)", borderTop: "1px solid var(--red-border)" }}>
                <p style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>⚠ {msgErr}</p>
              </div>
            )}

            {/* Tip panel */}
            {tipOpen && (
              <div style={{ padding: "16px", borderTop: "1px solid var(--border)", background: "rgba(242,184,75,0.06)" }}>
                <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>Send a tip</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {TIP_AMOUNTS.map(a => (
                    <button key={a} onClick={() => setTipAmount(a)} style={{
                      padding: "6px 12px", borderRadius: 4, border: "1px solid",
                      borderColor: tipAmount === a ? "rgba(242,184,75,0.5)" : "var(--border)",
                      background: tipAmount === a ? "rgba(242,184,75,0.12)" : "var(--surface-2)",
                      color: tipAmount === a ? "var(--accent)" : "var(--muted)",
                      fontFamily: mono, fontSize: 11, cursor: "pointer",
                    }}>${a}</button>
                  ))}
                </div>
                <input
                  value={tipMsg}
                  onChange={e => setTipMsg(e.target.value)}
                  placeholder="Add a message (optional)"
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 12px", color: "var(--text)", fontSize: 13, outline: "none", marginBottom: 10, fontFamily: "inherit" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={sendTip} disabled={tipping} style={{
                    flex: 1, background: "var(--accent)", color: "#09090C",
                    fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                    padding: "10px 0", border: "none", borderRadius: 4, cursor: "pointer",
                    opacity: tipping ? 0.5 : 1,
                  }}>
                    {tipping ? "Processing…" : `Send $${tipAmount} tip`}
                  </button>
                  <button onClick={() => setTipOpen(false)} style={{
                    background: "none", border: "1px solid var(--border)", borderRadius: 4,
                    color: "var(--muted)", fontFamily: mono, fontSize: 10, padding: "10px 14px", cursor: "pointer",
                  }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Input bar */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {!userProfile && (
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "7px 12px", color: "var(--text)", fontSize: 12, outline: "none", fontFamily: "inherit" }}
                />
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                  placeholder="Say something…"
                  maxLength={300}
                  style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                />
                <button onClick={() => setTipOpen(o => !o)} style={{
                  background: tipOpen ? "rgba(242,184,75,0.15)" : "var(--surface-2)",
                  border: "1px solid var(--border)", borderRadius: 4,
                  color: "var(--accent)", cursor: "pointer", padding: "0 12px", fontSize: 16,
                }}>💛</button>
                <button onClick={sendMessage} disabled={sending || !input.trim()} style={{
                  background: "var(--accent)", color: "#09090C",
                  fontFamily: mono, fontSize: 10, letterSpacing: "0.1em",
                  textTransform: "uppercase", border: "none", borderRadius: 4,
                  padding: "0 14px", cursor: "pointer",
                  opacity: sending || !input.trim() ? 0.45 : 1,
                }}>
                  Send
                </button>
              </div>
            </div>
          </>
        )}

        {/* Leaderboard tab */}
        {activeTab === "leaderboard" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>
              Top tippers this stream
            </p>
            {tips.length === 0 && (
              <p style={{ fontFamily: serif, fontSize: 16, fontStyle: "italic", color: "var(--muted)", textAlign: "center", marginTop: 40 }}>
                No tips yet. Be the first.
              </p>
            )}
            {tips.map((tip, i) => (
              <div key={tip.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 0", borderBottom: "1px solid var(--border)",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: i === 0 ? "rgba(242,184,75,0.2)" : i === 1 ? "rgba(192,132,252,0.15)" : i === 2 ? "rgba(251,146,60,0.15)" : "var(--surface-2)",
                  border: `1px solid ${i === 0 ? "rgba(242,184,75,0.4)" : i === 1 ? "rgba(192,132,252,0.3)" : i === 2 ? "rgba(251,146,60,0.3)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: mono, fontSize: 11, fontWeight: 700,
                  color: i === 0 ? "var(--accent)" : i === 1 ? "#C084FC" : i === 2 ? "#FB923C" : "var(--muted)",
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text)", margin: "0 0 2px", fontWeight: 600 }}>{tip.display_name}</p>
                  {tip.message && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tip.message}</p>}
                </div>
                <div style={{ fontFamily: mono, fontSize: 13, color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>
                  ${tip.amount_usd.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
