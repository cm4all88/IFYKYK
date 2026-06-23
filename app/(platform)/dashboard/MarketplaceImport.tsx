"use client";

import { useEffect, useState, useCallback } from "react";

// "Import Existing Listings" — source-agnostic. The creator brings their store
// (CSV export, photos + AI, or a marketplace they name) and reviews drafts with
// full photo control before anything publishes. Photos are always copied into
// Spotlightly storage by the API; this UI only ever handles Spotlightly URLs.

type Draft = {
  id: string;
  title: string;
  description: string | null;
  price_usd: number;
  condition: string;
  category: string;
  images: string[];
  brand: string | null;
  size: string | null;
  source_platform: string | null;
  needs_photos: boolean;
};

type SourceStat = { source: string; runs: number; imported: number; photosSaved: number; photosFailed: number; lastAt: string | null };
type Summary = { draftCount: number; missingPhotos: number; inventoryValue: number; photosSaved: number; photosFailed: number };

const SOURCES = [
  { id: "poshmark", label: "Poshmark", export: false },
  { id: "mercari", label: "Mercari", export: false },
  { id: "depop", label: "Depop", export: false },
  { id: "facebook", label: "Facebook Marketplace", export: false },
  { id: "ebay", label: "eBay", export: true },
  { id: "etsy", label: "Etsy", export: true },
  { id: "other", label: "Somewhere else", export: true },
];
const CATEGORIES = ["clothing", "accessories", "prints", "gear", "signed", "personal", "other"];
const CONDITIONS = ["new", "like_new", "good", "fair"];
const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));

function usd(n: number) { return "$" + Math.round(n).toLocaleString("en-US"); }

async function uploadFiles(files: File[]): Promise<{ urls: string[]; failed: number }> {
  const urls: string[] = [];
  let failed = 0;
  for (const file of files) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) urls.push(data.url); else failed += 1;
    } catch { failed += 1; }
  }
  return { urls, failed };
}

export default function MarketplaceImport({ onGoToMarketplace }: { onGoToMarketplace?: () => void }) {
  const [view, setView] = useState<"home" | "method" | "marketplace" | "running" | "review" | "summary">("home");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sources, setSources] = useState<SourceStat[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorRuns, setErrorRuns] = useState<{ source: string; errors: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{ found: number; imported: number; skipped: number; photosSaved: number; inventoryValue: number } | null>(null);
  const [pickedSource, setPickedSource] = useState<string>("poshmark");
  const [storeName, setStoreName] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/marketplace/import/drafts");
      const data = await res.json();
      if (data.error) return;
      setDrafts((data.drafts ?? []).map((d: any) => ({ ...d, price_usd: Number(d.price_usd) || 0, images: d.images ?? [] })));
      setSources(data.sources ?? []);
      setSummary(data.summary ?? null);
      setErrorRuns(((data.runs ?? []) as any[]).filter((r) => (r.errors?.length)).map((r) => ({ source: r.source, errors: r.errors })).slice(0, 5));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  // ── import methods ───────────────────────────────────────────────────────
  async function runCsv(file: File) {
    setBusy(true); setView("running"); setNote(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source", pickedSource || "csv");
      if (storeName.trim()) fd.append("username", storeName.trim());
      const res = await fetch("/api/marketplace/import/csv", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) { setNote(data.error); setView("method"); setBusy(false); return; }
      setLastRun({ found: data.found, imported: data.imported, skipped: data.skipped, photosSaved: data.photosSaved, inventoryValue: 0 });
      await load();
      setView("review");
    } catch { setNote("Import failed. Try again."); setView("method"); }
    setBusy(false);
  }

  async function runPhotos(files: File[]) {
    setBusy(true); setView("running"); setNote(null);
    try {
      const { urls } = await uploadFiles(files);
      if (urls.length === 0) { setNote("Those photos could not be uploaded."); setView("method"); setBusy(false); return; }
      const res = await fetch("/api/marketplace/import/photos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: urls }),
      });
      const data = await res.json();
      if (data.error) { setNote(data.error); setView("method"); setBusy(false); return; }
      setLastRun({ found: 1, imported: data.imported, skipped: 0, photosSaved: data.photosSaved, inventoryValue: 0 });
      await load();
      setView("review");
    } catch { setNote("Could not draft from those photos."); setView("method"); }
    setBusy(false);
  }

  // ── approval actions ───────────────────────────────────────────────────────
  async function act(d: Draft, action: "import" | "edit" | "skip") {
    setBusy(true);
    try {
      const res = await fetch("/api/marketplace/import/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: d.id, action,
          fields: { title: d.title, description: d.description ?? "", price: d.price_usd, category: d.category, condition: d.condition, brand: d.brand ?? "", size: d.size ?? "" },
          images: d.images,
        }),
      });
      const data = await res.json();
      if (data.error) { setNote(data.error); setBusy(false); return; }
      if (action === "import" || action === "skip") setDrafts((ds) => ds.filter((x) => x.id !== d.id));
      else setNote("Saved.");
      load();
    } catch { setNote("That didn't save. Try again."); }
    setBusy(false);
  }

  async function addPhotos(d: Draft, files: File[]) {
    setBusy(true);
    const { urls } = await uploadFiles(files);
    if (urls.length) updateDraft(d.id, { images: [...d.images, ...urls], needs_photos: false });
    setBusy(false);
  }
  function movePhoto(d: Draft, i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= d.images.length) return;
    const imgs = [...d.images]; [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    updateDraft(d.id, { images: imgs });
  }
  function removePhoto(d: Draft, i: number) {
    updateDraft(d.id, { images: d.images.filter((_, idx) => idx !== i) });
  }

  // ── shared bits ────────────────────────────────────────────────────────────
  const kicker = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "var(--muted)" };

  // ===========================================================================
  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 6, ...kicker }}>Your store</div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600, color: "var(--text)", margin: "0 0 6px" }}>Bring your existing store</h2>
      <p style={{ color: "var(--text-soft)", fontSize: 14, margin: "0 0 24px", maxWidth: 560 }}>
        You already built your listings once. Import them here, photos and all, and review everything before a single one goes live.
      </p>

      {note ? (
        <div className="card card--accent" style={{ marginBottom: 16, fontSize: 13 }}>{note}</div>
      ) : null}

      {/* Review banner — drafts waiting */}
      {summary && summary.draftCount > 0 && view !== "review" ? (
        <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{summary.draftCount} {summary.draftCount === 1 ? "draft" : "drafts"} ready to review</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              {usd(summary.inventoryValue)} potential inventory{summary.missingPhotos > 0 ? ` · ${summary.missingPhotos} need photos` : ""}
            </div>
          </div>
          <button className="btn btn--primary btn--small" onClick={() => setView("review")}>Review {summary.draftCount}</button>
        </div>
      ) : null}

      {/* Import Dashboard strip */}
      {sources.length > 0 && view === "home" ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...kicker, marginBottom: 10 }}>Imported from</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {sources.map((s) => (
              <div key={s.source} className="card card--tight">
                <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>{SOURCE_LABEL[s.source] ?? s.source}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
                  {s.imported} imported · {s.photosSaved} photos saved
                  {s.photosFailed > 0 ? <span style={{ color: "var(--red)" }}> · {s.photosFailed} failed</span> : null}
                </div>
              </div>
            ))}
          </div>
          {summary && (summary.photosFailed > 0 || summary.missingPhotos > 0) ? (
            <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>
              {summary.photosSaved} photos saved total
              {summary.missingPhotos > 0 ? ` · ${summary.missingPhotos} listings still need photos` : ""}
              {summary.photosFailed > 0 ? ` · ${summary.photosFailed} photo errors` : ""}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* HOME — the question */}
      {view === "home" ? (
        <div className="card">
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)", marginBottom: 4 }}>Do you already sell items online?</div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px" }}>Poshmark, Mercari, eBay, Depop, Etsy, Facebook Marketplace, anywhere.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn--primary" onClick={() => setView("method")}>Yes, bring my store</button>
            {onGoToMarketplace ? <button className="btn btn--secondary" onClick={onGoToMarketplace}>No, start fresh</button> : null}
          </div>
        </div>
      ) : null}

      {/* METHOD — choose how */}
      {view === "method" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <button className="btn btn--ghost btn--small" style={{ alignSelf: "flex-start" }} onClick={() => setView("home")}>← Back</button>

          <div className="card">
            <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Upload a CSV of your listings</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
              eBay and Etsy can export one from your seller tools. If it has image links, we download and store every photo. Needs a <strong>title</strong> column at minimum.
            </p>
            <label className="btn btn--primary btn--small" style={{ cursor: "pointer", display: "inline-block" }}>
              Choose CSV
              <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) runCsv(f); }} />
            </label>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Add photos and let us draft it</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
              Upload the photos for one item. We store them and draft the title, description, category, and a price for you to adjust.
            </p>
            <label className="btn btn--primary btn--small" style={{ cursor: "pointer", display: "inline-block" }}>
              Choose photos
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) runPhotos(fs); }} />
            </label>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Bring it from a marketplace</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>Tell us where you sell so your imports stay organized.</p>
            <button className="btn btn--secondary btn--small" onClick={() => setView("marketplace")}>Choose a marketplace</button>
          </div>
        </div>
      ) : null}

      {/* MARKETPLACE — pick platform + store name, then CSV */}
      {view === "marketplace" ? (
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <button className="btn btn--ghost btn--small" style={{ justifySelf: "flex-start" }} onClick={() => setView("method")}>← Back</button>
          <div>
            <div className="label">Where do you currently sell?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {SOURCES.map((s) => (
                <button key={s.id} className={pickedSource === s.id ? "btn btn--primary btn--small" : "btn btn--secondary btn--small"} onClick={() => setPickedSource(s.id)}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="storeName">Your store / closet / shop name</label>
            <input id="storeName" className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. @yourcloset" />
          </div>
          {SOURCES.find((s) => s.id === pickedSource)?.export ? (
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
              {SOURCE_LABEL[pickedSource]} lets you export your listings to a CSV from your seller tools. Upload it below and we will bring the photos across.
            </p>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
              {SOURCE_LABEL[pickedSource]} has no export file. The in-browser importer that pulls these straight from your closet is on the way. For now, the photo drafter above is the fastest path, or upload a CSV if you keep one.
            </p>
          )}
          <label className="btn btn--primary btn--small" style={{ cursor: "pointer", justifySelf: "flex-start", display: "inline-block" }}>
            Upload CSV for {SOURCE_LABEL[pickedSource]}
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) runCsv(f); }} />
          </label>
        </div>
      ) : null}

      {/* RUNNING */}
      {view === "running" ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)", marginBottom: 6 }}>Bringing your store across…</div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Downloading and saving every photo into your Spotlightly storage.</p>
        </div>
      ) : null}

      {/* SUMMARY (last run quick recap appears atop review) */}
      {lastRun && view === "review" ? (
        <div className="card card--green" style={{ marginBottom: 16, fontSize: 13 }}>
          Found {lastRun.found} · imported {lastRun.imported} as drafts{lastRun.skipped ? ` · skipped ${lastRun.skipped}` : ""} · {lastRun.photosSaved} photos saved. Nothing is live yet. Approve what you want below.
        </div>
      ) : null}

      {/* REVIEW — the approval screen */}
      {view === "review" ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div style={{ ...kicker }}>Review · {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--ghost btn--small" onClick={() => setView("home")}>Done for now</button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--text)", marginBottom: 6 }}>All caught up</div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>No drafts waiting. Import more, or head to your marketplace.</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="btn btn--secondary btn--small" onClick={() => setView("method")}>Import more</button>
                {onGoToMarketplace ? <button className="btn btn--primary btn--small" onClick={onGoToMarketplace}>Go to marketplace</button> : null}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {drafts.map((d) => (
                <div key={d.id} className="card" style={{ display: "grid", gap: 12 }}>
                  {/* photos */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ ...kicker }}>Photos{d.source_platform ? ` · from ${SOURCE_LABEL[d.source_platform] ?? d.source_platform}` : ""}</div>
                      {d.images.length === 0 ? <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 700 }}>Needs photos</span> : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {d.images.map((img, i) => (
                        <div key={img + i} style={{ position: "relative", width: 92, height: 92, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          <div style={{ position: "absolute", inset: "auto 0 0 0", display: "flex", justifyContent: "space-between", background: "rgba(9,9,12,0.6)" }}>
                            <button title="Move left" onClick={() => movePhoto(d, i, -1)} style={photoBtn} disabled={i === 0}>‹</button>
                            <button title="Remove" onClick={() => removePhoto(d, i)} style={{ ...photoBtn, color: "var(--red)" }}>✕</button>
                            <button title="Move right" onClick={() => movePhoto(d, i, 1)} style={photoBtn} disabled={i === d.images.length - 1}>›</button>
                          </div>
                        </div>
                      ))}
                      <label style={{ width: 92, height: 92, borderRadius: 8, border: "1px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted)", fontSize: 12, textAlign: "center" }}>
                        + Add
                        <input type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) addPhotos(d, fs); }} />
                      </label>
                    </div>
                  </div>

                  {/* fields */}
                  <input className="input" value={d.title} onChange={(e) => updateDraft(d.id, { title: e.target.value })} placeholder="Title" />
                  <textarea className="textarea" rows={2} value={d.description ?? ""} onChange={(e) => updateDraft(d.id, { description: e.target.value })} placeholder="Description" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                    <div>
                      <label className="label">Price (USD)</label>
                      <input className="input" type="number" min={1} step="0.01" value={d.price_usd || ""} onChange={(e) => updateDraft(d.id, { price_usd: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">Category</label>
                      <select className="select" value={d.category} onChange={(e) => updateDraft(d.id, { category: e.target.value })}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Condition</label>
                      <select className="select" value={d.condition} onChange={(e) => updateDraft(d.id, { condition: e.target.value })}>
                        {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Brand</label>
                      <input className="input" value={d.brand ?? ""} onChange={(e) => updateDraft(d.id, { brand: e.target.value })} placeholder="optional" />
                    </div>
                    <div>
                      <label className="label">Size</label>
                      <input className="input" value={d.size ?? ""} onChange={(e) => updateDraft(d.id, { size: e.target.value })} placeholder="optional" />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <button className="btn btn--primary btn--small" disabled={busy} onClick={() => act(d, "import")}>✓ Import</button>
                    <button className="btn btn--secondary btn--small" disabled={busy} onClick={() => act(d, "edit")}>✎ Save edits</button>
                    <button className="btn btn--ghost btn--small" disabled={busy} onClick={() => act(d, "skip")} style={{ marginLeft: "auto", color: "var(--muted)" }}>🗑 Skip</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const photoBtn: React.CSSProperties = {
  flex: 1, border: "none", background: "transparent", color: "#fff",
  fontSize: 14, lineHeight: 1, padding: "5px 0", cursor: "pointer",
};
