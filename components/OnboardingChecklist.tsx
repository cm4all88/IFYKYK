"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  hasAvatar: boolean;
  hasBio: boolean;
  hasStripe: boolean;
  hasPost: boolean;
  hasChannel: boolean;
  onDismiss: () => void;
  onSetPane?: (p: string) => void;
}

export default function OnboardingChecklist({ hasAvatar, hasBio, hasStripe, hasPost, hasChannel, onDismiss, onSetPane }: Props) {
  const steps = [
    { done: hasAvatar && hasBio, label: "Complete your profile", desc: "Add a photo and bio so fans know who you are.", pane: "profile" },
    { done: hasStripe, label: "Connect Stripe", desc: "Required before any fan can pay you.", pane: "payments" },
    { done: hasChannel, label: "Create a subscription tier", desc: "Give fans a reason to subscribe.", pane: "tiers" },
    { done: hasPost, label: "Publish your first post", desc: "Free posts build your audience.", pane: "posts" },
  ];

  const done = steps.filter(s => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  const mono = "var(--font-mono, DM Mono, monospace)";
  const serif = "var(--font-serif, Cormorant Garamond, Georgia, serif)";

  if (done === steps.length) return null;

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderLeft: "3px solid var(--accent)", borderRadius: "var(--r-3)",
      padding: "24px 28px", marginBottom: "var(--s-8)", position: "relative",
    }}>
      <button onClick={onDismiss} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)", margin: 0 }}>
          Getting started
        </p>
        <p style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", margin: 0 }}>{done}/{steps.length} complete</p>
      </div>

      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((step, i) => {
          const itemStyle: React.CSSProperties = {
            display: "flex", alignItems: "center", gap: 14,
            padding: "10px 14px", borderRadius: "var(--r-2)",
            textDecoration: "none", color: "inherit",
            background: step.done ? "transparent" : "rgba(242,184,75,0.03)",
            border: `1px solid ${step.done ? "transparent" : "rgba(242,184,75,0.08)"}`,
            opacity: step.done ? 0.5 : 1,
            transition: "background 0.15s",
            cursor: step.done ? "default" : "pointer",
            width: "100%", textAlign: "left" as const,
          };
          const inner = (
            <>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${step.done ? "var(--accent-open)" : "rgba(242,184,75,0.3)"}`,
                background: step.done ? "rgba(52,211,153,0.15)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
              }}>
                {step.done ? "✓" : ""}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: step.done ? 400 : 500, color: step.done ? "var(--muted)" : "var(--text)", margin: "0 0 2px" }}>
                  {step.label}
                </p>
                {!step.done && <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{step.desc}</p>}
              </div>
              {!step.done && <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 14, opacity: 0.7 }}>→</span>}
            </>
          );

          // Use onSetPane if available (within dashboard), otherwise fall back to Link
          return onSetPane && !step.done ? (
            <button key={i} style={{ ...itemStyle, background: "rgba(242,184,75,0.03)", border: "1px solid rgba(242,184,75,0.08)" }} onClick={() => onSetPane(step.pane)}>
              {inner}
            </button>
          ) : (
            <Link key={i} href={`/dashboard?pane=${step.pane}`} style={itemStyle}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
