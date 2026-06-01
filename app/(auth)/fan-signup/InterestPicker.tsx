"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CREATOR_CATEGORIES } from "@/lib/categories";

interface Props {
  returnUrl: string;
  onDone?: () => void;
}

export default function InterestPicker({ returnUrl, onDone }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  async function save() {
    setSaving(true);
    if (selected.length > 0) {
      await fetch("/api/fan/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: selected }),
      });
    }
    if (onDone) { onDone(); return; }
    router.push(returnUrl);
  }

  return (
    <main style={{ minHeight:"100vh", background:"#09090C", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
      <div style={{ width:"100%", maxWidth:520 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <p style={{ fontFamily:"monospace", fontSize:10, letterSpacing:".2em", textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:12 }}>One last thing</p>
          <h1 style={{ fontFamily:"Georgia,serif", fontSize:32, fontWeight:300, color:"#fff", marginBottom:10, lineHeight:1.1 }}>
            What do you love?
          </h1>
          <p style={{ fontSize:14, color:"rgba(242,242,240,0.45)", lineHeight:1.7 }}>
            Pick the kinds of content you&apos;re into. We&apos;ll use this to recommend creators you&apos;ll actually like.
          </p>
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center", marginBottom:40 }}>
          {CREATOR_CATEGORIES.filter(c => c.id !== "adult").map(cat => {
            const active = selected.includes(cat.id);
            return (
              <button key={cat.id} onClick={() => toggle(cat.id)} style={{
                display:"flex", alignItems:"center", gap:8,
                padding:"10px 16px", borderRadius:999, border:"1px solid", cursor:"pointer", fontSize:13, fontWeight:500,
                background: active ? "rgba(240,180,41,0.1)" : "rgba(255,255,255,0.04)",
                color: active ? "#F0B429" : "rgba(242,242,240,0.55)",
                borderColor: active ? "rgba(240,180,41,0.3)" : "rgba(255,255,255,0.1)",
                transition: "all 0.15s",
              }}>
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <button onClick={save} disabled={saving} style={{
            width:"100%", background:"#F0B429", color:"#09090C",
            fontWeight:700, fontSize:14, padding:"14px 0",
            borderRadius:999, border:"none", cursor:"pointer",
          }}>
            {saving ? "Saving…" : selected.length > 0 ? `Let's go — ${selected.length} selected →` : "Skip for now →"}
          </button>
        </div>
      </div>
    </main>
  );
}
