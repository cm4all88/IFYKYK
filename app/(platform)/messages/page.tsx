"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";

type Thread = { id: string; fan_user_id: string; last_message_at: string; creator_unread: number; };
type Message = { id: string; content: string; sender_user_id: string; is_front_row: boolean; created_at: string; };

export default function MessagesPage() {
  const supabase = createClient();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);
      const { data: profile } = await (supabase as any).from("creator_profiles").select("id").eq("user_id", user.id).eq("kind", "spotlight").single();
      if (!profile) return;
      setProfileId(profile.id);
      const { data: t } = await (supabase as any).from("message_threads").select("*").eq("creator_profile_id", profile.id).order("last_message_at", { ascending: false });
      setThreads(t ?? []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!active) return;
    const load = async () => {
      const { data } = await (supabase as any).from("messages").select("*").eq("thread_id", active.id).order("created_at", { ascending: true });
      setMessages(data ?? []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [active]);

  async function send() {
    if (!reply.trim() || !active || !profileId || !myId) return;
    setSending(true);
    await (supabase as any).from("messages").insert({ thread_id: active.id, sender_user_id: myId, creator_profile_id: profileId, content: reply.trim() });
    await (supabase as any).from("message_threads").update({ last_message_at: new Date().toISOString() }).eq("id", active.id);
    setReply(""); setSending(false);
    const { data } = await (supabase as any).from("messages").select("*").eq("thread_id", active.id).order("created_at", { ascending: true });
    setMessages(data ?? []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const s: Record<string, any> = {
    page: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)" },
    header: { borderBottom: "1px solid var(--border)", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 10, background: "var(--bg)" },
    brand: { fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text)", textDecoration: "none" },
    back: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "var(--muted)", textDecoration: "none" },
    shell: { display: "grid", gridTemplateColumns: "280px 1fr", height: "calc(100vh - 57px)" },
    sidebar: { borderRight: "1px solid var(--border)", overflowY: "auto" as const },
    sideHead: { padding: "14px 20px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".22em", textTransform: "uppercase" as const, color: "var(--muted)" },
    empty: { padding: 24, color: "var(--muted)", fontSize: 13, lineHeight: 1.7 },
    msgs: { flex: 1, overflowY: "auto" as const, padding: "24px 28px", display: "flex", flexDirection: "column" as const, gap: 12 },
    inputRow: { borderTop: "1px solid var(--border)", padding: "14px 28px", display: "flex", gap: 10 },
    input: { flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "11px 16px", borderRadius: "var(--r-2)", fontSize: 14, fontFamily: "inherit", outline: "none" },
  };

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" className="brand-logo" style={{ fontSize: 22 }}>Spot<span>light</span>ly</a>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>/ Messages</span>
        </div>
        <a href="/dashboard" style={s.back}>← Dashboard</a>
      </header>
      <div style={s.shell}>
        <aside style={s.sidebar}>
          <div style={s.sideHead}>Inbox</div>
          {loading && <div style={s.empty}>Loading...</div>}
          {!loading && threads.length === 0 && <div style={s.empty}>No messages yet. When fans message you, they appear here.</div>}
          {threads.map(t => (
            <div key={t.id} onClick={() => setActive(t)} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: active?.id === t.id ? "var(--surface-2)" : "transparent", borderLeft: `3px solid ${active?.id === t.id ? "var(--accent)" : "transparent"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Fan message</span>
                {t.creator_unread > 0 && <span style={{ background: "var(--accent)", color: "#0a0a0f", borderRadius: 99, fontSize: 10, padding: "1px 7px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{t.creator_unread}</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{new Date(t.last_message_at).toLocaleDateString()}</div>
            </div>
          ))}
        </aside>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>Select a conversation</div>
          ) : (
            <>
              <div style={s.msgs}>
                {messages.map(m => {
                  const isMe = m.sender_user_id === myId;
                  return (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      {m.is_front_row && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 3 }}>★ Front Row</div>}
                      <div style={{ maxWidth: "72%", padding: "11px 16px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isMe ? "rgba(245,200,66,.12)" : "var(--surface)", border: `1px solid ${isMe ? "rgba(245,200,66,.2)" : "var(--border)"}`, fontSize: 14, lineHeight: 1.65, color: "var(--text)", whiteSpace: "pre-wrap" as const }}>
                        {m.content}
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 5, fontFamily: "var(--font-mono)" }}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div style={s.inputRow}>
                <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} placeholder="Reply..." style={s.input} />
                <button onClick={send} disabled={sending || !reply.trim()} className="btn btn--primary" style={{ padding: "11px 20px" }}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
