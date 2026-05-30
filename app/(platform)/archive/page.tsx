"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";

type Post = { id: string; caption: string | null; tier: string; created_at: string; archived_at: string; };

export default function ArchivePage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await (supabase as any).from("creator_profiles").select("id").eq("user_id", user.id).eq("kind", "spotlight").single();
      if (!profile) return;
      setProfileId(profile.id);
      const { data } = await (supabase as any).from("posts").select("*").eq("creator_profile_id", profile.id).not("archived_at", "is", null).order("archived_at", { ascending: false });
      setPosts(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function restore(id: string) {
    await (supabase as any).from("posts").update({ archived_at: null, status: "live" }).eq("id", id);
    setPosts(p => p.filter(x => x.id !== id));
  }

  async function deleteForever(id: string) {
    if (!confirm("Permanently delete this post? This cannot be undone.")) return;
    await (supabase as any).from("posts").delete().eq("id", id);
    setPosts(p => p.filter(x => x.id !== id));
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", fontWeight: 300 }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 10, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="brand-logo" style={{ fontSize: 22 }}>Spot<span>light</span>ly</Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>/ Archive</span>
        </div>
        <Link href="/dashboard" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "var(--muted)", textDecoration: "none" }}>← Dashboard</Link>
      </header>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 28px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 12 }}>Archived Posts</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-.02em", marginBottom: 36 }}>The <em style={{ fontStyle: "italic", color: "var(--accent)" }}>archive.</em></h1>
        {loading && <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading...</div>}
        {!loading && posts.length === 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "40px 32px", textAlign: "center" as const }}>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontStyle: "italic", color: "#fff", marginBottom: 8 }}>Nothing archived.</p>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Archived posts appear here. You can restore them or delete permanently.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
          {posts.map(p => (
            <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px 24px", display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.65, marginBottom: 8 }}>
                  {p.caption ? (p.caption.length > 140 ? p.caption.slice(0, 140) + "…" : p.caption) : <em style={{ color: "var(--muted)" }}>No caption</em>}
                </div>
                <div style={{ display: "flex", gap: 14, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" as const, color: "var(--muted)" }}>
                  <span>{p.tier}</span>
                  <span>Archived {new Date(p.archived_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => restore(p.id)} className="btn btn--ghost btn--small">Restore</button>
                <button onClick={() => deleteForever(p.id)} className="btn btn--small" style={{ background: "var(--red-soft)", color: "var(--red)", border: "1px solid var(--red-border)" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
