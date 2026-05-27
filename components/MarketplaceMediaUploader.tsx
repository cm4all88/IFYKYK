"use client";

import { useRef, useState } from "react";

interface Props {
  images: string[];
  videoUrl: string;
  onImagesChange: (urls: string[]) => void;
  onVideoChange: (url: string) => void;
}

interface UploadState {
  id: string;
  name: string;
  progress: number; // 0–100
  url: string;
  error: string;
}

const MAX_IMAGES = 8;

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
  return json.url as string;
}

async function uploadVideo(
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  // Step 1: get upload credentials from our API
  const credRes = await fetch("/api/upload-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: file.name }),
  });
  const creds = await credRes.json();
  if (!credRes.ok || creds.error) throw new Error(creds.error ?? "Could not get upload credentials");

  // Step 2: PUT directly to BunnyCDN (bypasses Vercel 4.5MB limit)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", creds.uploadUrl);
    xhr.setRequestHeader("AccessKey", creds.accessKey);
    xhr.setRequestHeader("Content-Type", "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(creds.cdnUrl as string);
      else reject(new Error(`BunnyCDN upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during video upload"));
    xhr.send(file);
  });
}

const s: Record<string, React.CSSProperties> = {
  section: { display: "flex", flexDirection: "column", gap: 12 },
  label: {
    fontFamily: "DM Mono, monospace",
    fontSize: 9,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#71717a",
    marginBottom: 4,
  },
  dropzone: {
    border: "1px dashed rgba(255,255,255,0.15)",
    borderRadius: 6,
    padding: "28px 24px",
    textAlign: "center",
    cursor: "pointer",
    background: "rgba(255,255,255,0.02)",
    transition: "border-color 0.15s, background 0.15s",
  },
  dropzoneHover: {
    borderColor: "#F0B429",
    background: "rgba(240,180,41,0.04)",
  },
  thumbGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 6,
  },
  thumb: {
    position: "relative",
    aspectRatio: "1",
    borderRadius: 4,
    overflow: "hidden",
    background: "#111118",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.75)",
    border: "none",
    color: "#fff",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  primaryBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    fontFamily: "DM Mono, monospace",
    fontSize: 8,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    background: "#F0B429",
    color: "#09090C",
    padding: "2px 6px",
    borderRadius: 2,
  },
  progressBar: {
    height: 2,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 1,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: {
    height: "100%",
    background: "#F0B429",
    transition: "width 0.2s",
  },
  videoPreview: {
    position: "relative",
    borderRadius: 6,
    overflow: "hidden",
    background: "#111118",
    aspectRatio: "16/9",
  },
  removeBtn: {
    padding: "6px 14px",
    fontSize: 12,
    fontFamily: "DM Mono, monospace",
    letterSpacing: "0.05em",
    background: "transparent",
    color: "#71717a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4,
    cursor: "pointer",
    marginTop: 8,
  },
  errText: {
    fontSize: 12,
    color: "#f87171",
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: "#52525b",
    marginTop: 4,
  },
};

export default function MarketplaceMediaUploader({
  images,
  videoUrl,
  onImagesChange,
  onVideoChange,
}: Props) {
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);
  const [imgUploads, setImgUploads] = useState<UploadState[]>([]);
  const [vidUpload, setVidUpload] = useState<UploadState | null>(null);
  const [hovering, setHovering] = useState(false);

  // --- Image upload ---
  async function handleImageFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_IMAGES - images.length;
    const toUpload = Array.from(files).slice(0, remaining);

    const placeholders: UploadState[] = toUpload.map((f) => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      progress: 0,
      url: "",
      error: "",
    }));

    setImgUploads((prev) => [...prev, ...placeholders]);

    for (let i = 0; i < toUpload.length; i++) {
      const id = placeholders[i].id;
      try {
        // Fake progress tick while uploading
        setImgUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, progress: 30 } : u))
        );
        const url = await uploadImage(toUpload[i]);
        onImagesChange([...images, url]);
        setImgUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, progress: 100, url } : u))
        );
        // Remove from in-progress list after 1s
        setTimeout(() => {
          setImgUploads((prev) => prev.filter((u) => u.id !== id));
        }, 1000);
      } catch (err: any) {
        setImgUploads((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, error: err.message ?? "Upload failed" } : u
          )
        );
      }
    }
  }

  function removeImage(idx: number) {
    const next = images.filter((_, i) => i !== idx);
    onImagesChange(next);
  }

  function setPrimary(idx: number) {
    const next = [images[idx], ...images.filter((_, i) => i !== idx)];
    onImagesChange(next);
  }

  // --- Video upload ---
  async function handleVideoFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const placeholder: UploadState = {
      id: "video",
      name: file.name,
      progress: 0,
      url: "",
      error: "",
    };
    setVidUpload(placeholder);

    try {
      const url = await uploadVideo(file, (pct) => {
        setVidUpload((prev) => prev ? { ...prev, progress: pct } : prev);
      });
      onVideoChange(url);
      setVidUpload((prev) => prev ? { ...prev, progress: 100, url } : prev);
    } catch (err: any) {
      setVidUpload((prev) => prev ? { ...prev, error: err.message ?? "Upload failed" } : prev);
    }
  }

  // --- Drag & drop ---
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setHovering(false);
    handleImageFiles(e.dataTransfer.files);
  }

  const canAddMore = images.length < MAX_IMAGES;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* IMAGES */}
      <div style={s.section}>
        <p style={s.label}>Photos — up to {MAX_IMAGES} ({images.length}/{MAX_IMAGES})</p>

        {/* Existing image thumbnails */}
        {images.length > 0 && (
          <div style={s.thumbGrid}>
            {images.map((url, idx) => (
              <div key={url + idx} style={s.thumb}>
                <img src={url} alt={`Item photo ${idx + 1}`} style={s.thumbImg} />
                {idx === 0 && <span style={s.primaryBadge}>Primary</span>}
                <button
                  type="button"
                  style={s.thumbRemove}
                  onClick={() => removeImage(idx)}
                  title="Remove"
                >
                  ×
                </button>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => setPrimary(idx)}
                    style={{
                      position: "absolute",
                      bottom: 4,
                      left: 4,
                      fontFamily: "DM Mono, monospace",
                      fontSize: 8,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      background: "rgba(0,0,0,0.6)",
                      color: "#a1a1aa",
                      border: "1px solid rgba(255,255,255,0.15)",
                      padding: "2px 6px",
                      borderRadius: 2,
                      cursor: "pointer",
                    }}
                  >
                    Set primary
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* In-progress uploads */}
        {imgUploads.map((u) => (
          <div key={u.id}>
            <p style={{ fontSize: 12, color: "#71717a" }}>{u.name}</p>
            {u.error ? (
              <p style={s.errText}>{u.error}</p>
            ) : (
              <div style={s.progressBar}>
                <div style={{ ...s.progressFill, width: `${u.progress}%` }} />
              </div>
            )}
          </div>
        ))}

        {/* Dropzone */}
        {canAddMore && (
          <>
            <div
              style={{ ...s.dropzone, ...(hovering ? s.dropzoneHover : {}) }}
              onDragOver={(e) => { e.preventDefault(); setHovering(true); }}
              onDragLeave={() => setHovering(false)}
              onDrop={onDrop}
              onClick={() => imgInput.current?.click()}
            >
              <p style={{ fontSize: 13, color: "#71717a", margin: 0 }}>
                Drop photos here or <span style={{ color: "#F0B429" }}>click to browse</span>
              </p>
              <p style={{ fontSize: 11, color: "#52525b", margin: "6px 0 0" }}>
                JPG, PNG, WEBP · Max 10MB each · First photo is your hero image
              </p>
            </div>
            <input
              ref={imgInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleImageFiles(e.target.files)}
            />
          </>
        )}
      </div>

      {/* VIDEO */}
      <div style={s.section}>
        <p style={s.label}>Video preview — optional, max 60 seconds</p>

        {videoUrl ? (
          <div>
            <div style={s.videoPreview}>
              <video
                src={videoUrl}
                controls
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <button
              type="button"
              style={s.removeBtn}
              onClick={() => { onVideoChange(""); setVidUpload(null); }}
            >
              Remove video
            </button>
          </div>
        ) : vidUpload ? (
          <div>
            <p style={{ fontSize: 12, color: "#71717a" }}>{vidUpload.name}</p>
            {vidUpload.error ? (
              <p style={s.errText}>{vidUpload.error}</p>
            ) : (
              <>
                <div style={s.progressBar}>
                  <div style={{ ...s.progressFill, width: `${vidUpload.progress}%` }} />
                </div>
                <p style={{ fontSize: 11, color: "#52525b", marginTop: 4 }}>
                  {vidUpload.progress < 100 ? `${vidUpload.progress}% uploaded…` : "Processing…"}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div
              style={{ ...s.dropzone, cursor: "pointer" }}
              onClick={() => vidInput.current?.click()}
            >
              <p style={{ fontSize: 13, color: "#71717a", margin: 0 }}>
                Add a short video — show it off, talk about the item
              </p>
              <p style={{ fontSize: 11, color: "#52525b", margin: "6px 0 0" }}>
                MP4, MOV, WEBM · Max 500MB · Uploads directly to CDN
              </p>
            </div>
            <input
              ref={vidInput}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              style={{ display: "none" }}
              onChange={(e) => handleVideoFile(e.target.files)}
            />
          </>
        )}
      </div>

    </div>
  );
}
