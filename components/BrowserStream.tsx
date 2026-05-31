"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  profileId: string;
  title: string;
  onEnd: () => void;
}

type StreamState = "idle" | "requesting" | "preview" | "connecting" | "live" | "error";

export default function BrowserStream({ profileId, title, onEnd }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<StreamState>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [devices, setDevices] = useState<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({ cameras: [], mics: [] });
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load available devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(all => {
      const cameras = all.filter(d => d.kind === "videoinput");
      const mics = all.filter(d => d.kind === "audioinput");
      setDevices({ cameras, mics });
      if (cameras[0]) setSelectedCamera(cameras[0].deviceId);
      if (mics[0]) setSelectedMic(mics[0].deviceId);
    }).catch(() => {});
  }, []);

  async function requestPermissions() {
    setState("requesting");
    setErr(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      };
      const media = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = media;
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        videoRef.current.muted = true; // prevent echo in preview
      }
      setState("preview");
    } catch (e: any) {
      setErr(e.message || "Camera/mic access denied");
      setState("error");
    }
  }

  async function startStream() {
    if (!streamRef.current) return;
    setState("connecting");
    setErr(null);

    try {
      // 1. Create stream on BunnyCDN
      const startRes = await fetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Live Stream", creatorProfileId: profileId }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error);

      const vid = startData.streamId;
      const whipUrl = startData.whipUrl;
      setVideoId(vid);
      setPlaybackUrl(startData.playbackUrl);

      // 2. Set up WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // Add tracks from local stream
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current!);
      });

      // 3. Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>(resolve => {
        if (pc.iceGatheringState === "complete") { resolve(); return; }
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") resolve();
        };
        setTimeout(resolve, 3000); // fallback timeout
      });

      // 4. Publish the offer straight to Cloudflare's WHIP endpoint for this input
      if (!whipUrl) throw new Error("No WHIP URL returned — is Cloudflare Stream configured?");
      const whipRes = await fetch(whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription!.sdp,
      });

      if (!whipRes.ok) {
        const whipErr = await whipRes.text().catch(() => "");
        throw new Error(`WHIP failed (${whipRes.status})${whipErr ? ": " + whipErr.slice(0, 120) : ""}`);
      }

      // 5. Set remote description from the WHIP answer
      const sdpAnswer = await whipRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });

      setState("live");
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    } catch (e: any) {
      setErr(e.message || "Failed to start stream");
      setState("preview");
      cleanup();
    }
  }

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
  }

  async function endStream() {
    cleanup();
    if (videoId) {
      await fetch("/api/live/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorProfileId: profileId }),
      });
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    onEnd();
  }

  function toggleMute() {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  }

  function toggleCamera() {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach(t => { t.enabled = cameraOff; });
    setCameraOff(c => !c);
  }

  function formatTime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  const btnBase: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em",
    textTransform: "uppercase", border: "none", borderRadius: 4,
    cursor: "pointer", padding: "10px 20px", transition: "all 0.15s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Camera preview */}
      <div style={{
        position: "relative", background: "#000", borderRadius: 8,
        overflow: "hidden", aspectRatio: "16/9",
        border: state === "live" ? "2px solid var(--red)" : "1px solid var(--border)",
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            display: state === "idle" || state === "requesting" ? "none" : "block",
            transform: "scaleX(-1)", // mirror for natural selfie view
          }}
        />

        {(state === "idle" || state === "requesting") && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 40 }}>📷</div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              {state === "requesting" ? "Requesting access…" : "Camera preview"}
            </p>
          </div>
        )}

        {state === "live" && (
          <div style={{
            position: "absolute", top: 12, left: 12,
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "6px 12px",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--red)", animation: "pulse 1.4s infinite" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#fff", letterSpacing: "0.1em" }}>
              LIVE · {formatTime(elapsed)}
            </span>
          </div>
        )}

        {state === "connecting" && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Connecting…
            </p>
          </div>
        )}

        {/* Live controls overlay */}
        {(state === "live" || state === "preview") && (
          <div style={{
            position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 8,
          }}>
            <button onClick={toggleMute} style={{
              ...btnBase,
              background: muted ? "rgba(248,113,113,0.9)" : "rgba(0,0,0,0.7)",
              color: "#fff", fontSize: 16, padding: "8px 14px",
            }}>
              {muted ? "🔇" : "🎙️"}
            </button>
            <button onClick={toggleCamera} style={{
              ...btnBase,
              background: cameraOff ? "rgba(248,113,113,0.9)" : "rgba(0,0,0,0.7)",
              color: "#fff", fontSize: 16, padding: "8px 14px",
            }}>
              {cameraOff ? "🚫" : "📷"}
            </button>
          </div>
        )}
      </div>

      {err && (
        <div style={{ background: "var(--red-soft)", border: "1px solid var(--red-border)", borderRadius: 6, padding: "12px 16px", color: "var(--red)", fontSize: 13 }}>
          ⚠ {err}
        </div>
      )}

      {/* Device selectors — only shown in idle/preview */}
      {(state === "idle" || state === "preview") && devices.cameras.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 6 }}>Camera</label>
            <select value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}
              style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 12px", color: "var(--text)", fontSize: 13, outline: "none" }}>
              {devices.cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 6 }}>Microphone</label>
            <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
              style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 12px", color: "var(--text)", fontSize: 13, outline: "none" }}>
              {devices.mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        {state === "idle" && (
          <button onClick={requestPermissions} style={{ ...btnBase, background: "var(--accent)", color: "#09090C", flex: 1 }}>
            Enable camera & mic
          </button>
        )}

        {state === "preview" && (
          <>
            <button onClick={startStream} style={{ ...btnBase, background: "var(--red)", color: "#fff", flex: 1 }}>
              🔴 Go live
            </button>
            <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setState("idle"); }}
              style={{ ...btnBase, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
              Cancel
            </button>
          </>
        )}

        {state === "live" && (
          <button onClick={endStream} style={{ ...btnBase, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "var(--red)", flex: 1 }}>
            End stream
          </button>
        )}

        {state === "connecting" && (
          <button disabled style={{ ...btnBase, background: "var(--surface-2)", color: "var(--muted)", flex: 1, opacity: 0.5 }}>
            Connecting…
          </button>
        )}

        {state === "error" && (
          <button onClick={() => setState("idle")} style={{ ...btnBase, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)", flex: 1 }}>
            Try again
          </button>
        )}
      </div>

      {/* Playback link when live */}
      {state === "live" && playbackUrl && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 18px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
            Your audience sees this live
          </p>
          <a href={playbackUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
            {playbackUrl}
          </a>
        </div>
      )}
    </div>
  );
}
