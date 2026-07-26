"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ImportResponse {
  ok?: boolean;
  error?: string;
  inserted?: number;
  skippedExisting?: number;
  duplicatesInFile?: number;
  totalDataLines?: number;
  unknownHeaders?: string[];
  invalidRows?: { line: number; errors: string[] }[];
  errors?: { line: number; errors: string[] }[];
}

export default function ProspectImport() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [source, setSource] = useState("csv");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function readFile(file: File) {
    setCsv(await file.text());
    setResult(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/admin/prospects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, source }),
      });
      const json: ImportResponse = await res.json().catch(() => ({}));
      setResult(json);
      if (res.ok) { setCsv(""); router.refresh(); }
    } finally {
      setBusy(false);
    }
  }

  const problems = result?.invalidRows ?? result?.errors ?? [];

  return (
    <section>
      <h2 style={h2}>Import a CSV</h2>
      <p style={note}>
        Needs a <strong>name</strong> column. Also understands platform, handle, url, email, niche,
        followers, location, source, score, notes, and follow-up. Existing prospects are skipped,
        never overwritten.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>Upload a file</span>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
            style={{ ...input, padding: 6 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>…or paste CSV</span>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={7}
            placeholder={"name,platform,handle,email,niche,followers\nJane Doe,youtube,janedoe,press@janedoe.com,cooking,120000"}
            style={{ ...input, resize: "vertical", fontFamily: "'DM Mono', monospace", fontSize: 12 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 220 }}>
          <span style={lbl}>Default source</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} style={input} />
        </label>

        <div>
          <button type="submit" className="adm-btn" disabled={busy || !csv.trim()}>
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </form>

      {result ? (
        <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.7 }}>
          {result.error ? <p style={{ color: "#ff6b6b", margin: "0 0 8px" }}>{result.error}</p> : null}
          {result.ok ? (
            <p style={{ color: "#4ade80", margin: "0 0 8px" }}>
              Imported {result.inserted} of {result.totalDataLines} row{result.totalDataLines === 1 ? "" : "s"}.
            </p>
          ) : null}

          <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.6)" }}>
            {result.skippedExisting ? <li>{result.skippedExisting} already existed and were left untouched.</li> : null}
            {result.duplicatesInFile ? <li>{result.duplicatesInFile} duplicate row(s) within the file were skipped.</li> : null}
            {result.unknownHeaders?.length ? <li>Ignored unknown columns: {result.unknownHeaders.join(", ")}.</li> : null}
          </ul>

          {problems.length > 0 ? (
            <>
              <p style={{ color: "#ff9f43", margin: "10px 0 4px" }}>
                {problems.length} row{problems.length === 1 ? "" : "s"} could not be imported:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.6)", maxHeight: 200, overflowY: "auto" }}>
                {problems.slice(0, 50).map((p, i) => (
                  <li key={i}>Line {p.line}: {p.errors.join(" ")}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
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
