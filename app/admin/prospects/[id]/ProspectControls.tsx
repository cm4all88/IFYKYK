"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ADMIN_SETTABLE_STAGES, type ProspectStage } from "@/lib/prospects";

const STAGE_LABELS: Record<string, string> = {
  identified: "Identified", qualified: "Qualified", contacted: "Contacted",
  replied: "Replied", disqualified: "Disqualified",
};

export default function ProspectControls(props: {
  id: string;
  stage: ProspectStage;
  doNotContact: boolean;
  optedOutAt: string | null;
  handleWanted: string | null;
  displayName: string;
  creatorProfileId: string | null;
  profileHandle: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [handle, setHandle] = useState(props.handleWanted ?? "");
  const [reason, setReason] = useState("");

  async function patch(payload: Record<string, unknown>) {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/prospects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: props.id, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error ?? "Could not update."); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function buildPage() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/prospects/build-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: props.id, handle, display_name: props.displayName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error ?? "Could not build the page."); return; }
      router.push(json.buildUrl ?? "/admin/prospects");
    } finally { setBusy(false); }
  }

  return (
    <section style={card}>
      <h2 style={h2}>Pipeline</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {ADMIN_SETTABLE_STAGES.map((s) => (
          <button
            key={s}
            disabled={busy || props.stage === s || props.stage === "joined"}
            onClick={() => patch(s === "disqualified" ? { stage: s, disqualified_reason: reason } : { stage: s })}
            className="adm-btn"
            style={props.stage === s ? { borderColor: "#f5c842", color: "#f5c842" } : undefined}
          >
            {STAGE_LABELS[s]}
          </button>
        ))}
      </div>
      {props.stage === "joined" ? (
        <p style={{ ...note, marginTop: 10 }}>
          This creator has claimed their page, so the pipeline is complete. Stage is no longer editable.
        </p>
      ) : (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (used if you disqualify)"
          style={{ ...input, marginTop: 10, maxWidth: 420 }}
        />
      )}

      <hr style={hr} />

      <h2 style={h2}>Contact controls</h2>
      <p style={note}>
        Do-not-contact is enforced when a message is sent, not merely hidden in the interface.
        {props.optedOutAt ? " This person has also unsubscribed themselves, which cannot be overridden here." : ""}
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={props.doNotContact}
          disabled={busy}
          onChange={(e) => patch({ do_not_contact: e.target.checked })}
        />
        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>Do not contact</span>
      </label>

      <hr style={hr} />

      <h2 style={h2}>Spotlightly page</h2>
      {props.creatorProfileId ? (
        <>
          <p style={note}>
            A page exists at <strong>@{props.profileHandle}</strong>. It is unpublished and carries a
            no-index directive until it is claimed.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <a className="adm-btn" href={`/admin/creators/${props.creatorProfileId}/build`}>Open page builder →</a>
            <a className="adm-btn" href={`/${props.profileHandle}`} target="_blank" rel="noreferrer noopener">Preview page ↗</a>
          </div>
        </>
      ) : (
        <>
          <p style={note}>
            Building a page reserves the handle and creates a real, unclaimed creator account.
            Nothing is emailed and the page stays out of Explore and search until it is claimed.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={lbl}>Spotlightly handle</span>
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="janedoe" style={input} />
            </label>
            <button className="adm-btn" disabled={busy || !handle.trim()} onClick={buildPage}>
              {busy ? "Working…" : "Build page"}
            </button>
          </div>
        </>
      )}

      {err ? <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 12 }}>{err}</p> : null}
    </section>
  );
}

const card: React.CSSProperties = {
  margin: "24px 0", padding: "20px 22px", borderRadius: 12,
  background: "#111118", border: "1px solid rgba(255,255,255,0.07)",
};
const h2: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 22, margin: 0, color: "#fff" };
const note: React.CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: "8px 0 0" };
const hr: React.CSSProperties = { border: 0, borderTop: "1px solid rgba(255,255,255,0.07)", margin: "24px 0" };
const lbl: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
};
const input: React.CSSProperties = {
  background: "#0d0d14", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
  color: "#e8e8f0", padding: "8px 10px", fontSize: 13,
};
