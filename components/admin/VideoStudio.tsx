"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  VideoData,
  VideoType,
  Membership,
  ShopItem,
  MerchItem,
  VideoClip,
} from "@/components/video/types";
import { buildScenes, isStoryType, type SceneId } from "@/components/video/scenes";
import { storyScriptLine, PERSONALITIES, assignStoryPhotos } from "@/components/video/storyEngine";
import type { Personality } from "@/components/video/types";
import { hookFor, hooksFor, scoreHook, type Angle } from "@/components/video/hooks";
import { ANGLE_LABELS, angleLine, captionFor, hashtagsFor } from "@/components/video/angles";
import { MUSIC_GENRES, MUSIC_LIBRARY, tracksByGenre, type MusicGenre } from "@/components/video/musicLibrary";
import { sampleData } from "@/components/video/sampleData";
import CreatorPicker from "./CreatorPicker";

type ReelStatus = "queued" | "rendering" | "ready" | "failed" | "skipped";
type ReelItem = { type: VideoType; label: string; status: ReelStatus; url?: string };
const REEL_TYPES: { type: VideoType; label: string }[] = [
  { type: "behindScenes", label: "Behind the Scenes" },
  { type: "dayInLife", label: "Day in the Life" },
  { type: "storyTime", label: "Story Time" },
  { type: "whyJoin", label: "Why Join" },
  { type: "supportMe", label: "Support Me" },
  { type: "weeklyHighlight", label: "Weekly Highlight" },
  { type: "membership", label: "Membership" },
  { type: "campaign", label: "Campaign" },
  { type: "marketplace", label: "Marketplace" },
  { type: "merch", label: "Merch" },
];
const reelEligible = (t: VideoType, d: VideoData): boolean => {
  const photos = d.feedScreenshots?.length ?? 0;
  switch (t) {
    case "launch": return true;
    case "campaign": return !!d.campaign;
    case "membership":
    case "whyJoin": return !!d.memberships?.length;
    case "marketplace": return !!d.marketplace?.length;
    case "merch": return !!d.merch?.length;
    case "supportMe": return !!d.campaign || !!d.memberships?.length;
    case "behindScenes":
    case "dayInLife": return photos >= 1;
    case "storyTime":
    case "weeklyHighlight": return !!d.memberships?.length || photos >= 1;
    default: return false;
  }
};
const badgeClass = (s: ReelStatus) =>
  s === "ready" ? "badge--green" : s === "rendering" ? "badge--yellow" : s === "failed" ? "badge--red" : "badge--dim";
const statusLabel = (s: ReelStatus) =>
  s === "queued" ? "Queued" : s === "rendering" ? "Rendering" : s === "ready" ? "Ready" : s === "failed" ? "Failed" : "Skipped";
const stripBlobs = (d: VideoData): VideoData =>
  JSON.parse(JSON.stringify(d), (_k, v) => (typeof v === "string" && v.startsWith("blob:") ? undefined : v));

// Template-based voiceover scripts (no AI). Built from the loaded creator data.
// All copy stays hyphen and em dash free, per the Spotlightly writing rule.
const firstNameOf = (n: string) => (n || "").trim().split(/\s+/)[0] || n || "this creator";
const priceNum = (s?: string) => {
  const m = (s || "").replace(/[^0-9.]/g, "");
  return m ? Number(m) : NaN;
};
const lowestPrice = (tiers: { price?: string }[]) => {
  const nums = tiers.map((t) => priceNum(t.price)).filter((n) => !isNaN(n));
  return nums.length ? Math.min(...nums) : null;
};

const SCENE_LABEL: Record<SceneId, string> = {
  hook: "Hook",
  intro: "Opening",
  photo1: "Photo",
  profile: "Profile",
  memberships: "Memberships",
  campaign: "Campaign",
  photo2: "Photo",
  photo3: "Photo",
  clip1: "Clip",
  clip2: "Clip",
  clip3: "Clip",
  posts: "Posts",
  marketplace: "Marketplace",
  merch: "Merch",
  cta: "Closing",
};

export type ScriptSegment = { scene: SceneId; label: string; text: string };

// One narration line per scene that will actually render. The render service
// speaks each line on its own, and each scene holds exactly as long as its line.
function lineForScene(id: SceneId, d: VideoData): string {
  const angle = (d.videoType ?? "launch") as Angle;
  if (id !== "hook") {
    const override = angleLine(angle, id, d);
    if (override) return override;
  }
  const name = d.creator.name || "this creator";
  const fname = firstNameOf(name);
  const tiers = d.memberships ?? [];
  const camp = d.campaign;
  const market = d.marketplace ?? [];
  const low = lowestPrice(tiers);

  switch (id) {
    case "hook":
      return hookFor(d);
    case "intro":
      return `This is ${name}.`;
    case "profile":
      return `Most people only see the highlights.`;
    case "photo1":
      return `There's a lot they don't see.`;
    case "photo2":
      return `The early mornings. The work behind it.`;
    case "memberships":
      return tiers.length
        ? `Members get the rest.${low != null ? ` From $${low} a month.` : ""}`
        : `Members get everything else.`;
    case "campaign":
      if (!camp) return `She's raising money for something bigger.`;
      if (camp.pct >= 5) return `Her ${camp.title} campaign is already ${camp.pct} percent there.`;
      return `She's raising money for ${camp.title}.`;
    case "posts":
      return `The posts only members get to see.`;
    case "marketplace":
      return market.length ? `She sells her own work too. Like ${market[0].title}.` : `She sells her own work too.`;
    case "merch":
      return `And merch, for the people who show up.`;
    case "cta":
      if ((d.goal ?? "subs") === "platform")
        return `Follow along and get closer than ever. Find ${fname} on Spotlightly.`;
      return `Become a member and get closer than ever. Find ${fname} on Spotlightly.`;
    default:
      return "";
  }
}

function buildScriptSegments(type: VideoType, d: VideoData): ScriptSegment[] {
  const withType = { ...d, videoType: type };
  const planned = buildScenes(withType);
  return planned
    .map((s) => ({
      scene: s.id,
      label: SCENE_LABEL[s.id],
      text: isStoryType(type) ? storyScriptLine(type, s.id, withType) : lineForScene(s.id, withType),
    }))
    .filter((s) => s.text.trim().length > 0);
}

function buildScript(type: VideoType, d: VideoData): string {
  return buildScriptSegments(type, d)
    .map((s) => s.text)
    .join(" ");
}

const Player = dynamic(() => import("./VideoStudioPlayer"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        aspectRatio: "1080 / 1920",
        borderRadius: 8,
        background: "#FBFAF7",
        display: "grid",
        placeItems: "center",
        color: "#9A9AA2",
      }}
    >
      Loading preview...
    </div>
  ),
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="adm-field" style={{ marginBottom: 14 }}>
      <label className="adm-label">{label}</label>
      {children}
    </div>
  );
}

function AssetInput({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (f: File) => {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        setErr(json.error || "Upload failed");
        return;
      }
      onChange(json.url); // hosted Bunny url, usable in export
    } catch {
      setErr("Upload failed");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          className="adm-input"
          value={value ?? ""}
          placeholder={placeholder ?? "Paste an image url (BunnyCDN)"}
          onChange={(e) => onChange(e.target.value)}
        />
        <label className="adm-btn adm-btn--ghost" style={{ whiteSpace: "nowrap", cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Uploading..." : "Upload"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </label>
      </div>
      {err ? <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{err}</div> : null}
      {value && value.startsWith("blob:") ? (
        <div style={{ fontSize: 11, color: "#f5c842", marginTop: 4 }}>
          Local preview only. Click Upload again to host it, or it gets skipped on export.
        </div>
      ) : null}
      {value && /^(https?:|data:image\/)/.test(value) ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={value} alt="" style={{ marginTop: 6, maxHeight: 56, borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)" }} />
      ) : null}
    </div>
  );
}

export default function VideoStudio() {
  const [data, setData] = useState<VideoData>(() => structuredClone(sampleData));
  const [renderUrl, setRenderUrl] = useState<string>(
    process.env.NEXT_PUBLIC_RENDER_URL ?? ""
  );
  const [status, setStatus] = useState<{ msg: string; err?: boolean } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");

  const [creators, setCreators] = useState<
    { id: string; display_name: string; handle: string; avatar_url?: string }[]
  >([]);
  const [creatorId, setCreatorId] = useState("");
  const [loadingCreator, setLoadingCreator] = useState(false);
  const videoType = (data.videoType ?? "launch") as VideoType;

  useEffect(() => {
    fetch("/api/admin/video-studio/creators")
      .then((r) => r.json())
      .then((d) => setCreators(d.creators ?? []))
      .catch(() => {});
  }, []);

  const loadCreator = async (id: string) => {
    setCreatorId(id);
    if (!id) return;
    setLoadingCreator(true);
    setStatus({ msg: "Loading creator from the database..." });
    try {
      const r = await fetch(`/api/admin/video-studio/creator/${id}`);
      if (!r.ok) throw new Error("Could not load that creator");
      const json = await r.json();
      const vd = json.data as VideoData;
      setData({ ...vd, videoType });
      setAiHooks(null);
      setSegments(buildScriptSegments(videoType, vd));
      setStatus({ msg: "Loaded from Spotlightly. Edit anything below to override." });
    } catch (e) {
      setStatus({ msg: (e as Error).message, err: true });
    } finally {
      setLoadingCreator(false);
    }
  };

  const setType = (t: VideoType) => {
    setData((d) => ({ ...d, videoType: t }));
    setSegments(buildScriptSegments(t, data));
    setAiHooks(null);
  };

  const [batch, setBatch] = useState<ReelItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const handleSlug = (data.creator.handle || "creator").replace(/[^a-z0-9]/gi, "") || "creator";

  const [segments, setSegments] = useState<ScriptSegment[]>(() =>
    buildScriptSegments((sampleData.videoType ?? "launch") as VideoType, sampleData)
  );
  const [copied, setCopied] = useState(false);
  const [bakeVo, setBakeVo] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [fluidVo, setFluidVo] = useState(false);
  const [musicGenre, setMusicGenre] = useState<MusicGenre | "all">("all");
  const [voLoading, setVoLoading] = useState(false);
  const [voIdx, setVoIdx] = useState<number | null>(null);
  const voAudioRef = useRef<HTMLAudioElement | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [resScale, setResScale] = useState(0.6667); // 1 = 1080p, 0.6667 = 720p, 0.5 = 540p
  const [syncMusic, setSyncMusic] = useState(true); // beat-sync cuts to the music when a track is set
  const [aiHooks, setAiHooks] = useState<string[] | null>(null);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [clipUploading, setClipUploading] = useState<number | null>(null);

  const updateClip = (i: number, patch: Partial<VideoClip>) => {
    const next = [...(data.clips ?? [])];
    next[i] = { ...(next[i] ?? { url: "" }), ...patch };
    set({ clips: next });
  };
  const removeClip = (i: number) => {
    const next = [...(data.clips ?? [])];
    next.splice(i, 1);
    set({ clips: next.length ? next : undefined });
  };
  const uploadClip = async (i: number, f: File) => {
    setClipUploading(i);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        setStatus({ msg: json.error || "Clip upload failed.", err: true });
        return;
      }
      updateClip(i, { url: json.url });
    } catch {
      setStatus({ msg: "Clip upload failed.", err: true });
    } finally {
      setClipUploading(null);
    }
  };

  const writeHooks = async () => {
    setHooksLoading(true);
    try {
      const rows = (data.mediaAnalysis ?? []).filter(Boolean) as any[];
      const categories = Array.from(new Set(rows.map((m) => m.primary_category).filter(Boolean)));
      const summaries = rows.map((m) => m.visual_summary).filter(Boolean);
      const sells = [
        ...(data.marketplace ?? []).map((x: any) => x.title),
        ...(data.merch ?? []).map((x: any) => x.name),
        ...(data.memberships ?? []).map((x: any) => x.name),
      ].filter(Boolean);
      const res = await fetch("/api/admin/video-studio/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.creator.name, bio: data.creator.tagline, angle: videoType, categories, summaries, sells }),
      });
      const json = await res.json();
      setHooksLoading(false);
      if (!json.configured) {
        setStatus({ msg: "Add an Anthropic API key in Admin, Credentials to write hooks.", err: true });
        return;
      }
      if (!json.hooks?.length) {
        setStatus({ msg: "Could not write custom hooks, showing the built in ones.", err: true });
        return;
      }
      setAiHooks(json.hooks);
      setStatus({ msg: `Wrote ${json.hooks.length} hooks from this creator's content.` });
    } catch {
      setHooksLoading(false);
      setStatus({ msg: "Hook writing failed.", err: true });
    }
  };

  const analyzeMedia = async () => {
    if (!creatorId) {
      setStatus({ msg: "Pick a creator first.", err: true });
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/admin/video-studio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId }),
      });
      const json = await res.json();
      setAnalyzing(false);
      if (!res.ok) {
        setStatus({ msg: json.error || "Analyze failed.", err: true });
        return;
      }
      set({ mediaAnalysis: json.analyses });
      setShowAnalysis(true);
      setStatus({
        msg: json.configured
          ? `Analyzed ${json.analyzed}, cached ${json.cached}${json.failed ? `, ${json.failed} failed` : ""} of ${json.total} images.`
          : "Add an Anthropic API key in Admin, Credentials to analyze media.",
        err: !json.configured,
      });
    } catch (e: any) {
      setAnalyzing(false);
      setStatus({ msg: "Analyze failed: " + (e?.message ?? e), err: true });
    }
  };

  const stopVoiceover = () => {
    voAudioRef.current?.pause();
    voAudioRef.current = null;
    setVoIdx(null);
  };

  const previewVoiceover = async () => {
    if (!renderUrl) {
      setStatus({ msg: "Add the render service url first (in Export).", err: true });
      return;
    }
    stopVoiceover();
    setVoLoading(true);
    try {
      const res = await fetch(renderUrl.replace(/\/$/, "") + "/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: narrationSegmentsPayload() }),
      });
      const json = await res.json();
      setVoLoading(false);
      const clips: { audio: string; ok: boolean }[] = (json.clips || []).filter((c: any) => c.ok && c.audio);
      if (!clips.length) {
        setStatus({ msg: "No voiceover came back. Check the ElevenLabs key on the render service.", err: true });
        return;
      }
      let i = 0;
      const playNext = () => {
        if (i >= clips.length) {
          setVoIdx(null);
          voAudioRef.current = null;
          return;
        }
        setVoIdx(i);
        const a = new Audio(clips[i].audio);
        voAudioRef.current = a;
        const advance = () => {
          i += 1;
          playNext();
        };
        a.onended = advance;
        a.onerror = advance;
        a.play().catch(advance);
      };
      playNext();
    } catch (e: any) {
      setVoLoading(false);
      setStatus({ msg: "Voiceover preview failed: " + (e?.message ?? e), err: true });
    }
  };
  const copyScript = async () => {
    await navigator.clipboard.writeText(segments.map((s) => s.text).join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const setSegmentText = (i: number, text: string) =>
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, text } : s)));
  const narrationSegmentsPayload = () => segments.map((s) => ({ scene: s.scene, text: s.text }));
  const hookText = segments.find((s) => s.scene === "hook")?.text || undefined;

  const runBatch = async () => {
    if (!renderUrl) {
      setStatus({ msg: "Set a render service url first to batch render.", err: true });
      return;
    }
    const base = stripBlobs(data);
    setBatch(REEL_TYPES.map((r) => ({ ...r, status: reelEligible(r.type, base) ? "queued" : "skipped" })));
    setBatchRunning(true);
    const update = (type: VideoType, patch: Partial<ReelItem>) =>
      setBatch((prev) => prev.map((it) => (it.type === type ? { ...it, ...patch } : it)));

    for (const r of REEL_TYPES) {
      if (!reelEligible(r.type, base)) continue;
      update(r.type, { status: "rendering" });
      try {
        const res = await fetch(renderUrl.replace(/\/$/, "") + "/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: { ...base, videoType: r.type, feedScreenshots: assignStoryPhotos(r.type, { ...base, videoType: r.type }) },
            narrationSegments: bakeVo && !fluidVo
              ? buildScriptSegments(r.type, base).map((s) => ({ scene: s.scene, text: s.text }))
              : undefined,
            narrationScript: bakeVo && fluidVo
              ? buildScriptSegments(r.type, base).map((s) => s.text).join(" ")
              : undefined,
            captions: captionsOn,
            scale: resScale,
            syncMusic,
          }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const blob = await res.blob();
        update(r.type, { status: "ready", url: URL.createObjectURL(blob) });
      } catch {
        update(r.type, { status: "failed" });
      }
    }
    setBatchRunning(false);
  };

  const downloadAll = () => {
    batch
      .filter((b) => b.status === "ready" && b.url)
      .forEach((b, i) =>
        setTimeout(() => {
          const a = document.createElement("a");
          a.href = b.url as string;
          a.download = `${handleSlug}-${b.type}.mp4`;
          a.click();
        }, i * 500)
      );
  };

  const batchDone = batch.length > 0 && !batchRunning;
  const anyReady = batch.some((b) => b.status === "ready");

  const scenes = useMemo(() => buildScenes(data), [data]);
  const previewData = useMemo(
    () => ({ ...data, hookText, feedScreenshots: assignStoryPhotos(videoType, data) }),
    [data, hookText, videoType]
  );
  const seconds = useMemo(
    () => (scenes.reduce((a, s) => a + s.durationInFrames, 0) / 30).toFixed(1),
    [scenes]
  );

  const set = (patch: Partial<VideoData>) => setData((d) => ({ ...d, ...patch }));
  const setGoal = (g: "subs" | "platform") => {
    const next = { ...data, goal: g };
    setData(next);
    setSegments(buildScriptSegments(videoType, next));
  };
  const setHook = (text: string) => {
    setSegments((prev) => prev.map((s) => (s.scene === "hook" ? { ...s, text } : s)));
  };
  const setPersonality = (p: Personality) => {
    const next = { ...data, personality: p };
    setData(next);
    setSegments(buildScriptSegments(videoType, next));
  };
  const setCreator = (patch: Partial<VideoData["creator"]>) =>
    setData((d) => ({ ...d, creator: { ...d.creator, ...patch } }));
  const setIntro = (patch: Partial<VideoData["intro"]>) =>
    setData((d) => ({ ...d, intro: { ...d.intro, ...patch } }));
  const setCta = (patch: Partial<VideoData["cta"]>) =>
    setData((d) => ({ ...d, cta: { ...d.cta, ...patch } }));
  const setCampaign = (patch: Partial<NonNullable<VideoData["campaign"]>>) =>
    setData((d) => ({
      ...d,
      campaign: { ...(d.campaign ?? { title: "", raised: "", goal: "", pct: 0 }), ...patch },
    }));

  const memberships = data.memberships ?? [];
  const marketplace = data.marketplace ?? [];
  const merch = data.merch ?? [];

  const exportMp4 = async () => {
    if (!renderUrl) {
      setStatus({ msg: "Set a render service url first, or use Copy JSON to render locally.", err: true });
      return;
    }
    try {
      let stripped = false;
      const clean = JSON.parse(JSON.stringify(data), (_k, v) => {
        if (typeof v === "string" && v.startsWith("blob:")) {
          stripped = true;
          return undefined;
        }
        return v;
      }) as VideoData;
      clean.hookText = hookText;
      clean.feedScreenshots = assignStoryPhotos(clean.videoType ?? videoType, clean);
      setStatus({
        msg: stripped
          ? "Rendering... uploaded images are preview only and were skipped. Use hosted urls for export."
          : bakeVo
          ? "Rendering with voiceover... this can take a minute."
          : "Rendering... this can take a minute.",
      });
      const res = await fetch(renderUrl.replace(/\/$/, "") + "/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: clean,
          narrationSegments: bakeVo && !fluidVo ? narrationSegmentsPayload() : undefined,
          narrationScript: bakeVo && fluidVo ? narrationSegmentsPayload().map((s) => s.text).join(" ") : undefined,
          captions: captionsOn,
          scale: resScale,
          syncMusic,
        }),
      });
      if (!res.ok) throw new Error("Render failed (" + res.status + ")");
      const vo = res.headers.get("X-Voiceover");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (data.creator.handle || "spotlightly").replace(/[^a-z0-9]/gi, "") + ".mp4";
      a.click();
      URL.revokeObjectURL(url);
      const voNote = !bakeVo
        ? ""
        : vo === "ok"
        ? " Voiceover baked in, scene by scene."
        : vo === "partial"
        ? " Voiceover baked in. Some scenes were skipped, check the render logs."
        : vo === "disabled"
        ? " No voiceover: the ElevenLabs key is not set on the render service."
        : vo === "failed"
        ? " No voiceover: ElevenLabs synthesis failed. Check the key and the render logs."
        : vo === "empty"
        ? " No voiceover: the script was empty."
        : "";
      setStatus({ msg: "Done. Your MP4 downloaded." + voNote, err: Boolean(bakeVo && vo && vo !== "ok" && vo !== "partial") });
    } catch (e) {
      setStatus({ msg: (e as Error).message, err: true });
    }
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setStatus({ msg: "Copied the JSON. Paste it into the renderer project's data folder to render locally." });
  };

  return (
    <div>
      <div className="kicker">Marketing</div>
      <h1 className="adm-page-title">
        Video <em>Studio</em>
      </h1>
      <p className="adm-page-lede">
        Build a vertical marketing video (1080 x 1920) and preview it live. Works from any
        computer. Paste hosted screenshots, or use the structured cards.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 380px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* LEFT: controls */}
        <div>
          <div className="card">
            <div className="card-title">Source</div>
            <div className="field-grid">
              <Field label="Creator">
                <CreatorPicker creators={creators} value={creatorId} onChange={loadCreator} loading={loadingCreator} />
              </Field>
              <Field label="Video type">
                <select
                  className="adm-select"
                  value={videoType}
                  onChange={(e) => setType(e.target.value as VideoType)}
                >
                  <optgroup label="Stories (Story Engine)">
                    <option value="struggle">The Struggle</option>
                    <option value="breakthrough">The Breakthrough</option>
                    <option value="lesson">A Lesson Learned</option>
                    <option value="normalDay">A Normal Day</option>
                    <option value="challenge">A Challenge</option>
                    <option value="customerStory">A Customer Story</option>
                    <option value="milestone">A Milestone</option>
                    <option value="productLaunch">A Product Launch</option>
                    <option value="reflection">A Personal Reflection</option>
                    <option value="supporterStory">A Supporter Story</option>
                    <option value="businessUpdate">A Business Update</option>
                  </optgroup>
                  <optgroup label="Story angles">
                    <option value="behindScenes">Behind the Scenes</option>
                    <option value="dayInLife">Day in the Life</option>
                    <option value="storyTime">Story Time</option>
                    <option value="whyJoin">Why Join</option>
                    <option value="supportMe">Support Me</option>
                    <option value="weeklyHighlight">Weekly Highlight</option>
                  </optgroup>
                  <optgroup label="Product focus">
                    <option value="launch">Launch (everything)</option>
                    <option value="membership">Membership</option>
                    <option value="campaign">Campaign</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="merch">Merch</option>
                  </optgroup>
                </select>
              </Field>
              <Field label="Goal">
                <select
                  className="adm-select"
                  value={data.goal ?? "subs"}
                  onChange={(e) => setGoal(e.target.value as "subs" | "platform")}
                >
                  <option value="subs">Win the creator subscribers</option>
                  <option value="platform">Bring creators to Spotlightly</option>
                </select>
              </Field>
              <Field label="Offer (optional)">
                <input
                  className="adm-input"
                  value={data.offer ?? ""}
                  placeholder="First week free"
                  onChange={(e) => set({ offer: e.target.value || undefined })}
                />
              </Field>
              <Field label="Personality (creator's voice)">
                <select
                  className="adm-select"
                  value={data.personality ?? "inspirational"}
                  onChange={(e) => setPersonality(e.target.value as Personality)}
                >
                  {PERSONALITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p style={{ fontSize: 11, color: "#d5d5e2", margin: 0 }}>
              {loadingCreator
                ? "Loading..."
                : "Goal sets who the reel speaks to. Win subscribers talks to the creator's fans and ends on a join ask. Bring creators to Spotlightly talks to other creators. Offer adds an incentive on the closing card."}
            </p>
          </div>

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0, padding: 0, border: "none" }}>
                Story media
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="adm-btn adm-btn--ghost" style={{ padding: "6px 14px" }} disabled={analyzing} onClick={analyzeMedia}>
                  {analyzing ? "Analyzing..." : "Analyze creator media"}
                </button>
                {data.mediaAnalysis?.some(Boolean) ? (
                  <button className="adm-btn adm-btn--ghost" style={{ padding: "6px 14px" }} onClick={() => setShowAnalysis((s) => !s)}>
                    {showAnalysis ? "Hide tags" : "Show tags"}
                  </button>
                ) : null}
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#d5d5e2", margin: 0 }}>
              Tags each post image with story beats and emotional tone so the Story Engine matches the
              right photo to the right beat. Cached, so it only analyzes images it has not seen.
            </p>
            {showAnalysis && data.feedScreenshots?.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
                {(data.feedScreenshots ?? []).map((src, i) => {
                  const a = data.mediaAnalysis?.[i];
                  return (
                    <div key={i} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }} />
                      <div style={{ padding: 8, fontSize: 10, color: "#cfcfdd", lineHeight: 1.4 }}>
                        {a ? (
                          <>
                            <div style={{ color: "#f5c842", fontWeight: 600 }}>{a.primary_category ?? "—"}</div>
                            <div>
                              {a.emotional_tone ?? "—"} · {Math.round((a.confidence_score ?? 0) * 100)}%
                            </div>
                            <div style={{ color: "#8fb0ff" }}>{(a.story_beats ?? []).join(", ") || "no beats"}</div>
                          </>
                        ) : (
                          <div style={{ color: "#6b6b80" }}>not analyzed</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>Video clips</div>
            <p style={{ fontSize: 11, color: "#d5d5e2", margin: "0 0 12px" }}>
              Upload short clips from the creator (their reels or TikToks). We stitch them in, muted and
              vertical, with an overlay like "How she made this", timed to the beat. Keep them short, a few
              seconds each. Up to three.
            </p>
            <datalist id="clip-labels">
              <option value="More of this" />
              <option value="Behind the scenes" />
              <option value="How she made this" />
              <option value="Want to see more?" />
              <option value="Come see the rest" />
            </datalist>
            {[0, 1, 2].map((i) => {
              const c = data.clips?.[i];
              return (
                <div key={i} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <label className="adm-btn adm-btn--ghost" style={{ cursor: clipUploading === i ? "default" : "pointer", opacity: clipUploading === i ? 0.6 : 1 }}>
                      {clipUploading === i ? "Uploading..." : c?.url ? "Replace clip" : `Upload clip ${i + 1}`}
                      <input
                        type="file"
                        accept="video/*"
                        style={{ display: "none" }}
                        disabled={clipUploading === i}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadClip(i, f);
                        }}
                      />
                    </label>
                    {c?.url ? (
                      <button className="adm-btn adm-btn--ghost" style={{ padding: "6px 12px" }} onClick={() => removeClip(i)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {c?.url ? (
                    <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "flex-start" }}>
                      <video src={c.url} muted playsInline preload="metadata" style={{ width: 96, borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)" }} />
                      <div style={{ flex: 1 }}>
                        <input
                          className="adm-input"
                          list="clip-labels"
                          value={c.label ?? ""}
                          placeholder='Overlay text, e.g. "How she made this"'
                          onChange={(e) => updateClip(i, { label: e.target.value })}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <label style={{ flex: 1, fontSize: 10, color: "#9a9aae" }}>
                            Start at (sec)
                            <input
                              type="number"
                              className="adm-input"
                              min={0}
                              step={0.5}
                              value={c.trimStart ?? 0}
                              onChange={(e) => updateClip(i, { trimStart: Math.max(0, Number(e.target.value) || 0) })}
                            />
                          </label>
                          <label style={{ flex: 1, fontSize: 10, color: "#9a9aae" }}>
                            Length (sec)
                            <input
                              type="number"
                              className="adm-input"
                              min={1}
                              max={10}
                              step={0.5}
                              value={c.maxSeconds ?? ""}
                              placeholder="auto ~3.7"
                              onChange={(e) =>
                                updateClip(i, {
                                  maxSeconds: e.target.value === "" ? undefined : Math.min(10, Math.max(1, Number(e.target.value) || 0)),
                                })
                              }
                            />
                          </label>
                        </div>
                        <div style={{ fontSize: 10, color: "#9a9aae", marginTop: 6 }}>
                          Start picks where the clip begins. Length caps how much is used. Leave overlay blank for no text.
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0, padding: 0, border: "none" }}>
                Voiceover script
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="adm-btn adm-btn--ghost"
                  style={{ padding: "6px 14px" }}
                  onClick={voIdx !== null ? stopVoiceover : previewVoiceover}
                  disabled={voLoading}
                >
                  {voLoading ? "Synthesizing..." : voIdx !== null ? "Stop" : "Preview voiceover"}
                </button>
                <button className="adm-btn adm-btn--ghost" style={{ padding: "6px 14px" }} onClick={() => setSegments(buildScriptSegments(videoType, data))}>
                  Regenerate
                </button>
                <button className="adm-btn adm-btn--primary" style={{ padding: "6px 14px" }} onClick={copyScript}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <label className="adm-label" style={{ display: "block", margin: 0 }}>
                  Hook engine (strongest first, tap to use)
                </label>
                <button className="adm-btn adm-btn--ghost" style={{ padding: "5px 12px", fontSize: 11 }} disabled={hooksLoading} onClick={writeHooks}>
                  {hooksLoading ? "Writing..." : aiHooks ? "Rewrite hooks" : "Write specific hooks"}
                </button>
              </div>
              {aiHooks ? (
                <div style={{ fontSize: 10, color: "#8fb0ff", marginBottom: 6 }}>Written from this creator's photos and bio. Analyze media first for the best results.</div>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(aiHooks && aiHooks.length
                  ? aiHooks.map((t) => ({ text: t, score: scoreHook(t) })).sort((a, b) => b.score - a.score).slice(0, 6)
                  : hooksFor(data, 3)
                ).map((h, i) => {
                  const inUse = segments.find((s) => s.scene === "hook")?.text === h.text;
                  return (
                    <button
                      key={i}
                      onClick={() => setHook(h.text)}
                      style={{
                        textAlign: "left",
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: `1px solid ${inUse ? "#f5c842" : "rgba(255,255,255,0.12)"}`,
                        background: inUse ? "rgba(245,200,66,0.08)" : "rgba(255,255,255,0.02)",
                        color: "#e8e8f0",
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <span>{h.text}</span>
                      <span style={{ color: "#9a9aae", fontVariantNumeric: "tabular-nums" }}>{h.score}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {segments.map((seg, i) => (
                <div key={seg.scene}>
                  <label className="adm-label" style={{ display: "block", marginBottom: 4 }}>
                    {seg.label}
                    {voIdx === i ? <span style={{ color: "#f5c842", marginLeft: 8 }}>now playing</span> : null}
                  </label>
                  <textarea
                    className="adm-textarea"
                    style={{ minHeight: 56, lineHeight: 1.6, borderColor: voIdx === i ? "#f5c842" : undefined }}
                    value={seg.text}
                    onChange={(e) => setSegmentText(i, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, marginTop: 12, color: "#e8e8f0" }}>
              <input type="checkbox" checked={bakeVo} onChange={(e) => setBakeVo(e.target.checked)} />
              Bake this voiceover into the MP4 on export (narrated with ElevenLabs)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, marginTop: 8, color: bakeVo ? "#e8e8f0" : "#6b6b80" }}>
              <input type="checkbox" checked={captionsOn} disabled={!bakeVo} onChange={(e) => setCaptionsOn(e.target.checked)} />
              Burn in synced captions (word by word, timed to the voice)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, marginTop: 8, color: bakeVo ? "#e8e8f0" : "#6b6b80" }}>
              <input type="checkbox" checked={fluidVo} disabled={!bakeVo} onChange={(e) => setFluidVo(e.target.checked)} />
              Read the whole script as one fluid voiceover (smoother, less choppy)
            </label>
            <p style={{ marginTop: 8, fontSize: 11, color: "#d5d5e2", lineHeight: 1.6 }}>
              One line per scene, built from this creator. Edit any line. With bake on, Export speaks each line
              with ElevenLabs and times that scene to its line, so the picture changes when the narration does,
              with the music ducked underneath. Fluid read speaks the whole script in one take for natural cadence,
              while the visuals still cut on the beat. Or turn bake off and Copy the lines for any other tool.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button className="adm-btn adm-btn--ghost" onClick={() => setData(structuredClone(sampleData))}>
              Load sample
            </button>
            <button
              className="adm-btn adm-btn--ghost"
              onClick={() =>
                setData({
                  creator: { name: "Creator Name", handle: "@handle" },
                  intro: { headline: "One place for your biggest supporters." },
                  cta: { headline: "Turn followers into supporters.", url: "spotlightly.app" },
                })
              }
            >
              Start blank
            </button>
          </div>

          <div className="card">
            <div className="card-title">Creator</div>
            <Field label="Name">
              <input className="adm-input" value={data.creator.name} onChange={(e) => setCreator({ name: e.target.value })} />
            </Field>
            <Field label="Handle">
              <input className="adm-input" value={data.creator.handle} placeholder="@handle" onChange={(e) => setCreator({ handle: e.target.value })} />
            </Field>
            <Field label="Tagline (optional)">
              <input className="adm-input" value={data.creator.tagline ?? ""} onChange={(e) => setCreator({ tagline: e.target.value })} />
            </Field>
            <Field label="Avatar (used if no profile screenshot)">
              <AssetInput value={data.creator.avatar} onChange={(v) => setCreator({ avatar: v })} />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={!!data.creator.founding} onChange={(e) => setCreator({ founding: e.target.checked })} />
              Founding creator badge
            </label>
          </div>

          <div className="card">
            <div className="card-title">Background cover</div>
            <Field label="Cover image (opens the reel and sits behind the scenes)">
              <AssetInput value={data.creator.cover} onChange={(v) => setCreator({ cover: v || undefined })} />
            </Field>
            <Field label={`Background strength: ${Math.round((data.bgIntensity ?? 0.4) * 100)}%`}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: "#9A9AA2", whiteSpace: "nowrap" }}>Off</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={data.bgIntensity ?? 0.4}
                  onChange={(e) => set({ bgIntensity: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: "#f5c842" }}
                />
                <span style={{ fontSize: 11, color: "#9A9AA2", whiteSpace: "nowrap" }}>Bold</span>
              </div>
            </Field>
            <p style={{ fontSize: 12, color: "#71717A", margin: "2px 0 0" }}>
              Off keeps the clean cream stage. The opening shot always uses this image. Clear the field to remove it everywhere.
            </p>
          </div>

          <div className="card">
            <div className="card-title">Opening and closing</div>
            <Field label="Intro headline">
              <input className="adm-input" value={data.intro.headline} onChange={(e) => setIntro({ headline: e.target.value })} />
            </Field>
            <Field label="CTA headline">
              <input className="adm-input" value={data.cta.headline} onChange={(e) => setCta({ headline: e.target.value })} />
            </Field>
            <div className="field-grid">
              <Field label="CTA subline">
                <input className="adm-input" value={data.cta.sub ?? ""} onChange={(e) => setCta({ sub: e.target.value })} />
              </Field>
              <Field label="CTA url">
                <input className="adm-input" value={data.cta.url ?? ""} onChange={(e) => setCta({ url: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Screenshots</div>
            <Field label="Profile screenshot (the page it pans)">
              <AssetInput value={data.profileScreenshot} onChange={(v) => set({ profileScreenshot: v })} />
            </Field>
            <Field label="Exclusive posts screenshot (optional, enables that scene)">
              <AssetInput
                value={data.feedScreenshots?.[0]}
                onChange={(v) => set({ feedScreenshots: v ? [v] : undefined })}
              />
            </Field>
          </div>

          <div className="card">
            <div className="card-title">Memberships</div>
            {memberships.map((m, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input className="adm-input" value={m.name} placeholder="Tier" onChange={(e) => updateList(setData, "memberships", i, { name: e.target.value })} />
                <input className="adm-input" value={m.price} placeholder="$5" onChange={(e) => updateList(setData, "memberships", i, { price: e.target.value })} />
                <input className="adm-input" value={m.cadence ?? "mo"} placeholder="mo" onChange={(e) => updateList(setData, "memberships", i, { cadence: e.target.value })} />
                <button className="adm-btn adm-btn--ghost" onClick={() => removeFromList(setData, "memberships", i)}>x</button>
                <input className="adm-input" style={{ gridColumn: "1 / -1" }} value={(m.perks ?? []).join(", ")} placeholder="Perks, comma separated" onChange={(e) => updateList(setData, "memberships", i, { perks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
              </div>
            ))}
            <button className="adm-btn adm-btn--ghost" onClick={() => addToList(setData, "memberships", { name: "New tier", price: "$5", cadence: "mo", perks: [] } as Membership)}>Add tier</button>
          </div>

          <div className="card">
            <div className="card-title">Campaign</div>
            <Field label="Title">
              <input className="adm-input" value={data.campaign?.title ?? ""} onChange={(e) => setCampaign({ title: e.target.value })} />
            </Field>
            <div className="field-grid">
              <Field label="Raised"><input className="adm-input" value={data.campaign?.raised ?? ""} placeholder="$1,500" onChange={(e) => setCampaign({ raised: e.target.value })} /></Field>
              <Field label="Goal"><input className="adm-input" value={data.campaign?.goal ?? ""} placeholder="$2,000" onChange={(e) => setCampaign({ goal: e.target.value })} /></Field>
              <Field label="Percent"><input className="adm-input" type="number" value={data.campaign?.pct ?? 0} onChange={(e) => setCampaign({ pct: Number(e.target.value) })} /></Field>
              <Field label="Backers"><input className="adm-input" type="number" value={data.campaign?.backers ?? 0} onChange={(e) => setCampaign({ backers: Number(e.target.value) })} /></Field>
            </div>
            <button className="adm-btn adm-btn--ghost" onClick={() => set({ campaign: undefined })}>Remove campaign scene</button>
          </div>

          <div className="card">
            <div className="card-title">Marketplace</div>
            {marketplace.map((it, i) => (
              <ShopRow key={i} title={it.title} price={it.price} image={it.image}
                onTitle={(v) => updateList(setData, "marketplace", i, { title: v })}
                onPrice={(v) => updateList(setData, "marketplace", i, { price: v })}
                onImage={(v) => updateList(setData, "marketplace", i, { image: v })}
                onRemove={() => removeFromList(setData, "marketplace", i)} />
            ))}
            <button className="adm-btn adm-btn--ghost" onClick={() => addToList(setData, "marketplace", { title: "New item", price: "$10" } as ShopItem)}>Add item</button>
          </div>

          <div className="card">
            <div className="card-title">Merch</div>
            {merch.map((it, i) => (
              <ShopRow key={i} title={it.name} price={it.price} image={it.image}
                onTitle={(v) => updateList(setData, "merch", i, { name: v })}
                onPrice={(v) => updateList(setData, "merch", i, { price: v })}
                onImage={(v) => updateList(setData, "merch", i, { image: v })}
                onRemove={() => removeFromList(setData, "merch", i)} />
            ))}
            <button className="adm-btn adm-btn--ghost" onClick={() => addToList(setData, "merch", { name: "New item", price: "$20" } as MerchItem)}>Add item</button>
          </div>

          <div className="card">
            <div className="card-title">Music (optional)</div>
            <div className="field-grid">
              <Field label="Genre">
                <select
                  className="adm-select"
                  value={musicGenre}
                  onChange={(e) => setMusicGenre(e.target.value as MusicGenre | "all")}
                >
                  <option value="all">All genres</option>
                  {MUSIC_GENRES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Track">
                <select
                  className="adm-select"
                  value={MUSIC_LIBRARY.some((t) => t.url === data.music) ? data.music : ""}
                  onChange={(e) => {
                    const t = MUSIC_LIBRARY.find((x) => x.url === e.target.value);
                    set({ music: e.target.value || undefined, ...(t?.volume != null ? { musicVolume: t.volume } : {}) });
                  }}
                >
                  <option value="">
                    {tracksByGenre(musicGenre).length ? "Choose a track..." : "No tracks yet in this genre"}
                  </option>
                  {tracksByGenre(musicGenre).map((t) => (
                    <option key={t.id} value={t.url}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {MUSIC_LIBRARY.length === 0 ? (
              <p style={{ fontSize: 11, color: "#d5d5e2", margin: "0 0 10px" }}>
                The library is empty. Add hosted, track-licensed music (Pixabay or Mixkit) in
                components/video/musicLibrary.ts, or paste a url below. Avoid Epidemic, Uppbeat, and
                Artlist here: their license follows your channel, not the file, so it does not cover a
                reel a creator posts on their own account.
              </p>
            ) : null}
            <Field label="Or paste a url">
              <input
                className="adm-input"
                value={data.music ?? ""}
                placeholder="https://spotlightly.b-cdn.net/music/track.mp3"
                onChange={(e) => set({ music: e.target.value || undefined })}
              />
            </Field>
            <Field label={`Volume (${Math.round((data.musicVolume ?? 0.6) * 100)}%)`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={data.musicVolume ?? 0.6}
                onChange={(e) => set({ musicVolume: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </Field>
            {data.music ? (
              <audio key={data.music} controls src={data.music} style={{ width: "100%", marginTop: 8 }} />
            ) : null}
            {data.music ? (
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "#e7e7f0", cursor: "pointer" }}>
                <input type="checkbox" checked={syncMusic} onChange={(e) => setSyncMusic(e.target.checked)} />
                Sync edit to the music beat
              </label>
            ) : null}
            <p style={{ fontSize: 11, color: "#9a9aae", margin: "8px 0 0" }}>
              Music auto ducks to about a third of this volume while the voiceover plays, then comes
              back up under the photo beats.
              {data.music ? " With beat sync on, the render analyzes the track and lands every cut on a downbeat. The preview here is not beat synced, only the final render is." : ""}
            </p>
          </div>

          <button className="adm-btn adm-btn--ghost" onClick={() => { setShowJson((s) => !s); setJsonText(JSON.stringify(data, null, 2)); }}>
            {showJson ? "Hide" : "Show"} raw JSON
          </button>
          {showJson ? (
            <div style={{ marginTop: 10 }}>
              <textarea className="adm-textarea" style={{ minHeight: 220, fontFamily: "monospace", fontSize: 12 }} value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
              <button className="adm-btn adm-btn--ghost" style={{ marginTop: 8 }} onClick={() => {
                try { setData(JSON.parse(jsonText)); setStatus({ msg: "Applied JSON." }); }
                catch { setStatus({ msg: "That JSON did not parse.", err: true }); }
              }}>Apply JSON</button>
            </div>
          ) : null}
        </div>

        {/* RIGHT: preview + export */}
        <div style={{ position: "sticky", top: 24 }}>
          <Player data={previewData} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "#d5d5e2" }}>
            <span>{scenes.length} scenes</span>
            <span>{seconds}s . 1080x1920 . 30fps</span>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Export</div>
            <Field label="Render service url (optional)">
              <input className="adm-input" value={renderUrl} placeholder="https://your-render-service" onChange={(e) => setRenderUrl(e.target.value)} />
            </Field>
            <Field label="Resolution">
              <select className="adm-select" value={resScale} onChange={(e) => setResScale(Number(e.target.value))}>
                <option value={0.5}>540p (fastest, about 4x)</option>
                <option value={0.6667}>720p (recommended, about 2x)</option>
                <option value={1}>1080p (full, slowest)</option>
              </select>
            </Field>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="adm-btn adm-btn--primary" onClick={exportMp4}>Export MP4</button>
              <button className="adm-btn adm-btn--ghost" onClick={copyJson}>Copy JSON</button>
            </div>
            {status ? (
              <div className={`adm-banner ${status.err ? "adm-banner--err" : "adm-banner--ok"}`} style={{ marginTop: 12, marginBottom: 0 }}>
                {status.msg}
              </div>
            ) : null}
            <p style={{ marginTop: 12, fontSize: 11, color: "#d5d5e2", lineHeight: 1.6 }}>
              Preview runs here in admin. Rendering the MP4 cannot run on Vercel, so Export
              calls a separate render service. Or use Copy JSON to render locally. For export,
              screenshots must be hosted urls (uploads are preview only).
            </p>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Content pack</div>
            <button className="adm-btn adm-btn--primary" disabled={batchRunning} onClick={runBatch}>
              {batchRunning ? "Rendering..." : "Generate content pack"}
            </button>
            <p style={{ fontSize: 11, color: "#d5d5e2", margin: "8px 0 0" }}>
              Renders every angle this creator has data for, each with its own hook, script, pacing,
              and photo order. Caption and hashtags are generated for each, ready to copy when you post.
            </p>

            {batch.length > 0 ? (
              <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {batch.map((b) => {
                  const packData = { ...data, videoType: b.type } as VideoData;
                  const caption = captionFor(packData, b.type as Angle);
                  const tags = hashtagsFor(packData, b.type as Angle).join(" ");
                  const copyText = `${caption}\n\n${tags}`;
                  return (
                    <li key={b.type} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{b.label}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {b.status === "ready" && b.url ? (
                            <a className="adm-btn adm-btn--ghost" style={{ padding: "5px 12px" }} href={b.url} download={`${handleSlug}-${b.type}.mp4`}>
                              Download
                            </a>
                          ) : null}
                          <span className={`badge ${badgeClass(b.status)}`}>{statusLabel(b.status)}</span>
                        </span>
                      </div>
                      {b.status !== "skipped" ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#cfcfdd", lineHeight: 1.5 }}>{caption}</div>
                          <div style={{ fontSize: 12, color: "#8fb0ff", marginTop: 6 }}>{tags}</div>
                          <button
                            className="adm-btn adm-btn--ghost"
                            style={{ padding: "4px 12px", marginTop: 8 }}
                            onClick={() => navigator.clipboard?.writeText(copyText)}
                          >
                            Copy caption and tags
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {batchDone && anyReady ? (
              <button className="adm-btn adm-btn--ghost" style={{ marginTop: 12 }} onClick={downloadAll}>
                Download all
              </button>
            ) : null}

            <p style={{ marginTop: 12, fontSize: 11, color: "#d5d5e2", lineHeight: 1.6 }}>
              Renders each reel type the creator has data for and skips the rest. Uses the render
              service url above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShopRow({
  title,
  price,
  image,
  onTitle,
  onPrice,
  onImage,
  onRemove,
}: {
  title: string;
  price: string;
  image?: string;
  onTitle: (v: string) => void;
  onPrice: (v: string) => void;
  onImage: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 70px auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
      <input className="adm-input" value={title} placeholder="Name" onChange={(e) => onTitle(e.target.value)} />
      <input className="adm-input" value={price} placeholder="$10" onChange={(e) => onPrice(e.target.value)} />
      <button className="adm-btn adm-btn--ghost" onClick={onRemove}>x</button>
      <div style={{ gridColumn: "1 / -1" }}>
        <AssetInput value={image} onChange={onImage} placeholder="Image url (optional)" />
      </div>
    </div>
  );
}

type ListKey = "memberships" | "marketplace" | "merch";
function updateList(setData: React.Dispatch<React.SetStateAction<VideoData>>, key: ListKey, idx: number, patch: Record<string, unknown>) {
  setData((d) => {
    const list = [...((d[key] as unknown[]) ?? [])];
    list[idx] = { ...(list[idx] as object), ...patch };
    return { ...d, [key]: list } as VideoData;
  });
}
function addToList(setData: React.Dispatch<React.SetStateAction<VideoData>>, key: ListKey, item: unknown) {
  setData((d) => ({ ...d, [key]: [...((d[key] as unknown[]) ?? []), item] } as VideoData));
}
function removeFromList(setData: React.Dispatch<React.SetStateAction<VideoData>>, key: ListKey, idx: number) {
  setData((d) => ({ ...d, [key]: ((d[key] as unknown[]) ?? []).filter((_, i) => i !== idx) } as VideoData));
}
