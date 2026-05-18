"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type MediaItem = { url: string; name: string; type: string; size: number; uploaded: string; };

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setErr(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setItems(prev => [{ url: data.url, name: file.name, type: file.type, size: file.size, uploaded: new Date().toISOString() }, ...prev]);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(upload);
  }

  function copy(url: string) {
    navigator.clipboard.writeText(url);
  }

  const isImage = (type: string) => type.startsWith("image/");
  const isVideo = (type: string) => type.startsWith("video/");
  const fmt = (bytes: number) => bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${Math.round(bytes / 1000)}KB`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", fontWeight: 300 }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 10, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text)", textDecoration: "none" }}>Spot<span style={{ color: "var(--accent)" }}>light</span>ly</Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>/ Media</span>
        </div>
        <Link href="/dashboard" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "var(--muted)", textDecoration: "none" }}>← Dashboard</Link>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 12 }}>Media</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-.02em", marginBottom: 36 }}>Your <em style={{ fontStyle: "italic", color: "var(--accent)" }}>files.</em></h1>

        {/* Upload zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          style={{ border: "2px dashed var(--border)", borderRadius: "var(--r-3)", padding: "48px 32px", textAlign: "center" as const, cursor: "pointer", marginBottom: 24, transition: "border-color .15s" }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)"}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"}
        >
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontStyle: "italic", color: "#fff", marginBottom: 8 }}>
            {uploading ? "Uploading..." : "Drop files here or click to upload"}
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Images and video. Files are stored on BunnyCDN and served globally.</p>
        </div>

        {err && <div style={{ color: "var(--red)", fontSize: 13, padding: "10px 14px", background: "var(--red-soft)", border: "1px solid var(--red-border)", borderRadius: "var(--r-2)", marginBottom: 16 }}>⚠ {err}</div>}

        {items.length === 0 && !uploading ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "40px 32px", textAlign: "center" as const }}>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No files uploaded yet. Upload your first image or video above.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 2 }}>
            {items.map((item, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{ height: 140, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {isImage(item.type) ? (
                    <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 32 }}>🎬</span>
                  )}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>{fmt(item.size)}</div>
                  <button onClick={() => copy(item.url)} className="btn btn--ghost btn--small" style={{ width: "100%" }}>Copy URL</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
