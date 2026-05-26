"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  new_subscriber: "🎉",
  tip: "💛",
  super_tip: "⭐",
  new_comment: "💬",
  campaign_donation: "🎯",
  gift_sub: "🎁",
  message: "✉️",
  live_viewer: "👁",
};

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const unread = notifs.filter(n => !n.read).length;

  async function load() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setNotifs(data.notifications ?? []);
    setLoading(false);
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  useEffect(() => {
    load();

    // Realtime subscription for new notifications
    const channel = supabase
      .channel(`notifications_${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifs(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const mono = "var(--font-mono, DM Mono, monospace)";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open && unread > 0) markAllRead(); }}
        style={{
          position: "relative", background: "none", border: "none",
          cursor: "pointer", padding: "6px 8px", borderRadius: 6,
          color: "var(--text-soft)", fontSize: 18, lineHeight: 1,
          transition: "color 0.15s",
        }}
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            width: 16, height: 16, borderRadius: "50%",
            background: "var(--accent)", color: "#09090C",
            fontFamily: mono, fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 340, maxHeight: 480, overflowY: "auto",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          zIndex: 100,
        }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>
              Notifications
            </p>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: "none", border: "none", fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", cursor: "pointer", padding: 0 }}>
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading…</div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>🔔</p>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Nothing yet. When fans subscribe or tip you, it shows up here.</p>
            </div>
          ) : (
            notifs.map(n => (
              <div
                key={n.id}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: n.read ? "transparent" : "rgba(242,184,75,0.04)",
                  display: "flex", gap: 12, alignItems: "flex-start",
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{TYPE_ICON[n.type] ?? "📣"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 2px", fontWeight: n.read ? 400 : 500 }}>
                    {n.title}
                  </p>
                  {n.body && <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", lineHeight: 1.5 }}>{n.body}</p>}
                  <p style={{ fontFamily: mono, fontSize: 10, color: "var(--muted-faint)", margin: 0, letterSpacing: "0.04em" }}>
                    {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {n.link && (
                  <Link href={n.link} style={{ color: "var(--accent)", fontSize: 12, flexShrink: 0, marginTop: 2, textDecoration: "none" }}>
                    →
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
