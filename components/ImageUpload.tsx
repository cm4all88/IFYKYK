"use client";
import { useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  shape?: "circle" | "rect";
  label?: string;
  hint?: string;
  previewWidth?: number;
  previewHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export default function ImageUpload({
  value,
  onChange,
  shape = "circle",
  label = "Upload photo",
  hint = "JPG, PNG or WebP · Max 10MB",
  previewWidth = 80,
  previewHeight = 80,
  minWidth,
  minHeight,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resWarning, setResWarning] = useState<string | null>(null);

  const radius = shape === "circle" ? "50%" : "10px";

  async function checkResolution(file: File): Promise<string | null> {
    if (!minWidth && !minHeight) return null;
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (minWidth && img.width < minWidth) {
          resolve(`Image is ${img.width}px wide — minimum ${minWidth}px recommended for best quality.`);
        } else if (minHeight && img.height < minHeight) {
          resolve(`Image is ${img.height}px tall — minimum ${minHeight}px recommended for best quality.`);
        } else {
          resolve(null);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setResWarning(null);
    const warn = await checkResolution(file);
    if (warn) setResWarning(warn);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Upload failed");
    } else {
      onChange(data.url);
    }

    setUploading(false);
    e.target.value = "";
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      {/* Preview */}
      <div style={{
        width: previewWidth, height: previewHeight,
        borderRadius: radius,
        background: value ? "transparent" : "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        overflow: "hidden", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {value ? (
          <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : shape === "circle" ? (
          <svg width="42%" height="42%" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg width="38%" height="38%" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
          </svg>
        )}
      </div>

      {/* Controls */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={handleFile}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={uploading}
            style={{
              fontFamily: "var(--font-display, 'DM Sans', sans-serif)",
              fontSize: 12, fontWeight: 700,
              padding: "8px 16px", borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.15)",
              background: uploading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
              color: uploading ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)",
              cursor: uploading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {uploading ? "Uploading…" : label}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              style={{
                fontSize: 11, fontFamily: "var(--font-display, 'DM Sans', sans-serif)",
                background: "none", border: "none",
                color: "rgba(248,113,113,0.6)", cursor: "pointer", padding: "4px 8px",
              }}
            >
              Remove
            </button>
          )}
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6, lineHeight: 1.5 }}>
          {hint}
        </p>
        {resWarning && (
          <p style={{ fontSize: 11.5, color: "#F2B84B", marginTop: 6, lineHeight: 1.5 }}>
            {resWarning} It still uploads, but a larger image stays crisp on big screens.
          </p>
        )}
        {error && (
          <p style={{ fontSize: 12, color: "#F87171", marginTop: 6 }}>
            {error.includes("not configured")
              ? "⚠ File upload not set up yet — add BunnyCDN keys in Admin → Credentials."
              : `⚠ ${error}`}
          </p>
        )}
      </div>
    </div>
  );
}
