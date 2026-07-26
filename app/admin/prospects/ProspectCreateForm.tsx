"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROSPECT_PLATFORMS, PROSPECT_SOURCES } from "@/lib/prospects";

const EMPTY = {
  display_name: "", platform: "", platform_handle: "", profile_url: "", email: "",
  niche: "", follower_count: "", location: "", handle_wanted: "",
  source: "manual", source_detail: "", score: "", notes: "", follow_up_at: "",
};

export default function ProspectCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState(false);

  function set(k: keyof typeof EMPTY, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors([]); setOk(false);
    try {
      const res = await fetch("/api/admin/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(json.errors ?? [json.error ?? "Could not save this prospect."]);
        return;
      }
      setForm({ ...EMPTY });
      setOk(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 style={h2}>Add a prospect</h2>
      <p style={note}>
        Only public information. Adding somebody here contacts nobody and creates no page.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <Field label="Name *" value={form.display_name} onChange={(v) => set("display_name", v)} required />
        <Row>
          <Select label="Platform" value={form.platform} onChange={(v) => set("platform", v)}
                  options={["", ...PROSPECT_PLATFORMS]} />
          <Field label="Handle" value={form.platform_handle} onChange={(v) => set("platform_handle", v)} placeholder="without @" />
        </Row>
        <Field label="Profile URL" value={form.profile_url} onChange={(v) => set("profile_url", v)} placeholder="https://…" />
        <Field label="Public business email" value={form.email} onChange={(v) => set("email", v)} placeholder="press@example.com" />
        <Row>
          <Field label="Niche" value={form.niche} onChange={(v) => set("niche", v)} />
          <Field label="Followers" value={form.follower_count} onChange={(v) => set("follower_count", v)} placeholder="12000" />
        </Row>
        <Row>
          <Field label="Location" value={form.location} onChange={(v) => set("location", v)} />
          <Field label="Wanted handle" value={form.handle_wanted} onChange={(v) => set("handle_wanted", v)} />
        </Row>
        <Row>
          <Select label="Source" value={form.source} onChange={(v) => set("source", v)} options={[...PROSPECT_SOURCES]} />
          <Field label="Source detail" value={form.source_detail} onChange={(v) => set("source_detail", v)} placeholder="e.g. VidCon 2026" />
        </Row>
        <Row>
          <Field label="Score (0-100)" value={form.score} onChange={(v) => set("score", v)} />
          <Field label="Follow up" value={form.follow_up_at} onChange={(v) => set("follow_up_at", v)} type="date" />
        </Row>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>Notes</span>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} />
        </label>

        {errors.length > 0 ? (
          <ul style={{ color: "#ff6b6b", fontSize: 13, margin: 0, paddingLeft: 18 }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        ) : null}
        {ok ? <p style={{ color: "#4ade80", fontSize: 13, margin: 0 }}>Prospect added.</p> : null}

        <div>
          <button type="submit" className="adm-btn" disabled={busy}>
            {busy ? "Saving…" : "Add prospect"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>;
}

function Field(props: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={lbl}>{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        required={props.required}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        style={input}
      />
    </label>
  );
}

function Select(props: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={lbl}>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)} style={input}>
        {props.options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    </label>
  );
}

const h2: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 24, margin: "0 0 6px", color: "#fff" };
const note: React.CSSProperties = { color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 18px", lineHeight: 1.6 };
const lbl: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
};
const input: React.CSSProperties = {
  background: "#111118", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
  color: "#e8e8f0", padding: "8px 10px", fontSize: 13, width: "100%",
};
