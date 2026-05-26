"use client";

import { useRef, useState } from "react";

interface Props {
  onUpload: (result: { videoId: string; playbackUrl: string; cdnUrl: string }) => void;
  label?: string;
}

export default function VideoUpload({ onUpload, label = "Upload video" }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const okTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/mpeg"];
    if (!okTypes.includes(file.type)) {
      setError("Please upload an MP4, MOV, WebM, or AVI file.");
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);
    setDone(false);

    // 1. Get upload credentials from our API
    const credRes = await fetch("/api/upload-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: file.name }),
    });

    if (!credRes.ok) {
      const err = await credRes.json().catch(() => ({ error: "Upload failed" }));
      setError(err.error || "Upload failed");
      setUploading(false);
      return;
    }

    const { videoId, uploadUrl, accessKey, playbackUrl, cdnUrl } = await credRes.json();

    // 2. Upload directly to BunnyCDN with progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("AccessKey", accessKey);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    }).catch(err => {
      setError(err.message);
      setUploading(false);
      return;
    });

    setProgress(100);
    setDone(true);
    setUploading(false);
    onUpload({ videoId, playbackUrl, cdnUrl });
    e.target.value = "";
  }

  const mono = "var(--font-mono, DM Mono, monospace)";

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      {!uploading && !done && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: "var(--r-2)", padding: "12px 20px",
            color: "rgba(242,242,240,0.7)", cursor: "pointer",
            fontFamily: mono, fontSize: 11, letterSpacing: "0.1em",
            textTransform: "uppercase", transition: "border-color 0.15s",
          }}
        >
          <span style={{ fontSize: 18 }}>🎬</span> {label}
        </button>
      )}

      {uploading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              Uploading…
            </span>
            <span style={{ fontFamily: mono, fontSize: 11, color: "var(--accent)" }}>{progress}%</span>
          </div>
          <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: "var(--accent)",
              width: `${progress}%`,
              transition: "width 0.2s ease",
            }} />
          </div>
          <p style={{ fontFamily: mono, fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em" }}>
            Uploading directly to CDN — large files are fine.
          </p>
        </div>
      )}

      {done && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--accent-open)", fontSize: 16 }}>✓</span>
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-open)" }}>
            Video uploaded
          </span>
          <button
            type="button"
            onClick={() => { setDone(false); setProgress(0); ref.current?.click(); }}
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Replace
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: "var(--red)", marginTop: 6, fontFamily: mono }}>⚠ {error}</p>
      )}

      {!uploading && !done && (
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, fontFamily: mono, letterSpacing: "0.04em" }}>
          MP4, MOV, or WebM · No size limit · Uploads directly to CDN
        </p>
      )}
    </div>
  );
}
