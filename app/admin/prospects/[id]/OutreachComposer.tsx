"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface OutreachRow {
  id: string;
  channel: string;
  subject: string | null;
  body: string;
  claim_url_sent: string | null;
  status: string;
  approved_at: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

const DEFAULT_BODY = `Hi {{name}},

I came across your work on {{platform}} and thought of Spotlightly — it's a home page for creators where your people can support you directly. No cut of your earnings.

I've put together a page for you already so you can see what it would look like rather than just take my word for it.

If it's not for you, no hard feelings — just ignore this and you won't hear from me again.`;

export default function OutreachComposer(props: {
  prospectId: string;
  prospectName: string;
  hasEmail: boolean;
  doNotContact: boolean;
  optedOut: boolean;
  hasPage: boolean;
  outreach: OutreachRow[];
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(`A page I made for you, ${props.prospectName}`);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const blocked = props.doNotContact || props.optedOut || !props.hasEmail;
  const blockedReason = props.doNotContact
    ? "This prospect is marked do-not-contact."
    : props.optedOut
    ? "This prospect has unsubscribed."
    : !props.hasEmail
    ? "Add a public business email before drafting a message."
    : "";

  async function call(method: string, payload: Record<string, unknown>) {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/prospects/outreach", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error ?? "Something went wrong."); return false; }
      router.refresh();
      return true;
    } finally { setBusy(false); }
  }

  return (
    <section style={card}>
      <h2 style={h2}>Outreach</h2>
      <p style={note}>
        Drafting saves a message for review. <strong>Nothing is sent until you approve it and then
        explicitly send it</strong> — and the database refuses to record a send without a recorded
        approval, so that gate cannot be bypassed by any code path.
      </p>

      {blocked ? (
        <p style={{ ...note, color: "#ff9f43" }}>{blockedReason}</p>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={lbl}>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={input} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={lbl}>Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} style={{ ...input, resize: "vertical", lineHeight: 1.6 }} />
          </label>
          <p style={{ ...note, margin: 0 }}>
            Placeholders: <code>{"{{name}}"}</code>, <code>{"{{platform}}"}</code>,{" "}
            <code>{"{{handle}}"}</code>, <code>{"{{niche}}"}</code>, <code>{"{{claim_url}}"}</code>.
            {props.hasPage
              ? " A claim link is attached automatically."
              : " No page has been built, so no claim link will be attached."}
          </p>
          <div>
            <button
              className="adm-btn"
              disabled={busy || !subject.trim() || !body.trim()}
              onClick={() => call("POST", { prospect_id: props.prospectId, subject, body })}
            >
              {busy ? "Saving…" : "Save draft for review"}
            </button>
          </div>
        </div>
      )}

      {err ? <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 12 }}>{err}</p> : null}

      <hr style={hr} />

      <h2 style={h2}>History</h2>
      {props.outreach.length === 0 ? (
        <p style={note}>No messages yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 12 }}>
          {props.outreach.map((o) => (
            <li key={o.id} style={{ padding: "14px 16px", borderRadius: 10, background: "#0d0d14", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong style={{ color: "#fff", fontSize: 14 }}>{o.subject ?? "(no subject)"}</strong>
                <span style={statusStyle(o.status)}>{o.status}</span>
              </div>
              <p style={{ ...note, whiteSpace: "pre-wrap", marginTop: 8 }}>{o.body}</p>
              {o.claim_url_sent ? (
                <p style={{ ...note, marginTop: 6 }}>
                  Claim link recorded: <code style={{ color: "rgba(255,255,255,0.6)" }}>{o.claim_url_sent}</code>
                </p>
              ) : null}
              <p style={{ ...note, marginTop: 6, fontSize: 12 }}>
                Drafted {new Date(o.created_at).toLocaleString("en-US")}
                {o.approved_at ? ` · approved ${new Date(o.approved_at).toLocaleString("en-US")}` : ""}
                {o.sent_at ? ` · sent ${new Date(o.sent_at).toLocaleString("en-US")}` : ""}
              </p>
              {o.error ? <p style={{ color: "#ff6b6b", fontSize: 12, marginTop: 6 }}>{o.error}</p> : null}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {o.status === "pending" ? (
                  <>
                    <button className="adm-btn" disabled={busy} onClick={() => call("PATCH", { id: o.id, action: "approve" })}>
                      Approve
                    </button>
                    <button className="adm-btn" disabled={busy} onClick={() => call("PATCH", { id: o.id, action: "reject" })}>
                      Reject
                    </button>
                  </>
                ) : null}
                {o.status === "approved" ? (
                  <button
                    className="adm-btn"
                    style={{ borderColor: "#f5c842", color: "#f5c842" }}
                    disabled={busy}
                    onClick={() => {
                      if (!confirm(`Send this message to ${props.prospectName} now? This delivers a real email.`)) return;
                      call("PUT", { id: o.id });
                    }}
                  >
                    Send now
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function statusStyle(status: string): React.CSSProperties {
  const color =
    status === "sent" ? "#4ade80"
    : status === "approved" ? "#f5c842"
    : status === "rejected" || status === "failed" ? "#ff6b6b"
    : "rgba(255,255,255,0.45)";
  return {
    fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color, border: `1px solid ${color}`, borderRadius: 4,
    padding: "2px 7px", alignSelf: "flex-start",
  };
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
  color: "#e8e8f0", padding: "8px 10px", fontSize: 13, width: "100%",
};
