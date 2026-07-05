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
type StudioStep = "plan" | "media" | "offer" | "script" | "style" | "export";
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
    case "campaign": return !!(d.campaign && d.campaign.title && d.campaign.title.trim());
    case "membership":
    case "whyJoin": return !!d.memberships?.length;
    case "marketplace": return !!d.marketplace?.length;
    case "merch": return !!d.merch?.length;
    case "supportMe": return !!(d.campaign && d.campaign.title && d.campaign.title.trim()) || !!d.memberships?.length;
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
      if (!camp) return `${fname} is chasing something big.`;
      if (camp.pct >= 5) return `${fname}'s campaign is already ${camp.pct} percent funded.`;
      return `${camp.title}. Help ${fname} get there.`;
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

// Downscale + JPEG-compress an image in the browser so big screenshots fit under
// Vercel's 4.5 MB request-body limit. HEIC can't be drawn to canvas, so it's left
// as-is (and size-guarded).
async function compressImage(file: File, maxDim = 2000, quality = 0.86): Promise<Blob> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("decode failed"));
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("encode failed");
  return blob;
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
      let blob: Blob = f;
      let name = f.name;
      const isHeic = /hei[cf]$/i.test(f.name) || /image\/hei[cf]/i.test(f.type);
      if (f.type.startsWith("image/") && !isHeic) {
        try {
          blob = await compressImage(f);
          name = f.name.replace(/\.\w+$/, "") + ".jpg";
        } catch {
          blob = f; // fall back to original if canvas fails
        }
      }
      if (blob.size > 4.3 * 1024 * 1024) {
        setErr(`Still ${(blob.size / 1048576).toFixed(1)} MB after compressing. Crop it smaller or paste a hosted link.`);
        return;
      }
      const fd = new FormData();
      fd.append("file", new File([blob], name, { type: blob.type || f.type }));
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
  const [platform, setPlatform] = useState<"tiktok" | "reels" | "shorts">("tiktok");
  const [lengthTarget, setLengthTarget] = useState<"short" | "standard" | "long">("standard");
  const [activeTemplate, setActiveTemplate] = useState<string>("launch");

  const VS_TEMPLATES: { id: string; label: string; type: VideoType; open: string | null }[] = [
    { id: "launch", label: "Creator Launch", type: "launch", open: null },
    { id: "membership", label: "Subscription Promo", type: "membership", open: "memberships" },
    { id: "merch", label: "Merch Drop", type: "merch", open: "merch" },
    { id: "campaign", label: "Campaign Push", type: "campaign", open: "campaign" },
    { id: "marketplace", label: "Marketplace Promo", type: "marketplace", open: "marketplace" },
    { id: "behindScenes", label: "Behind the Scenes", type: "behindScenes", open: null },
    { id: "supportMe", label: "Tip Jar", type: "supportMe", open: null },
  ];
  const [openAdvanced, setOpenAdvanced] = useState<string | null>(null);
  const [simpleMode, setSimpleMode] = useState(true);
  const [activeStep, setActiveStep] = useState<StudioStep>("plan");

  const applyTemplate = (t: { id: string; type: VideoType; open: string | null }) => {
    setActiveTemplate(t.id);
    setType(t.type);
    setOpenAdvanced(t.open);
  };
  const generateSmart = () => {
    setSegments(buildScriptSegments(videoType, data));
    setAiHooks(null);
    setStatus({ msg: "Built a fresh script and scenes for this goal. Edit anything, then export." });
  };
  const saveDraft = () => {
    try {
      localStorage.setItem(
        `vs-draft-${creatorId || "blank"}`,
        JSON.stringify({ data, videoType, platform, lengthTarget })
      );
      setStatus({ msg: "Draft saved on this device." });
    } catch {
      setStatus({ msg: "Could not save the draft.", err: true });
    }
  };
  const [aiHooks, setAiHooks] = useState<string[] | null>(null);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [aiCaption, setAiCaption] = useState<{ description: string; hashtags: string[] } | null>(null);
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
    // Vercel serverless functions reject request bodies over 4.5 MB, so a big clip
    // can't go through /api/upload at all. Only small clips upload in-app; anything
    // larger has to be hosted directly and pasted as a link.
    const MAX_INLINE = 4.3 * 1024 * 1024;
    if (f.size > MAX_INLINE) {
      setStatus({
        msg: `That clip is ${(f.size / 1048576).toFixed(0)} MB. Clips over about 4 MB can't upload through the app. Host it (Bunny, or any public mp4) and paste the link in the clip field instead.`,
        err: true,
      });
      return;
    }
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

  const writeCaptionAI = async () => {
    setCaptionLoading(true);
    try {
      const rows = (data.mediaAnalysis ?? []).filter(Boolean) as any[];
      const categories = Array.from(new Set(rows.map((m) => m.primary_category).filter(Boolean)));
      const summaries = rows.map((m) => m.visual_summary).filter(Boolean);
      const isNew = (data.feedScreenshots?.length ?? 0) < 3 && !data.campaign?.raised;
      const res = await fetch("/api/admin/video-studio/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.creator.name,
          handle: data.creator.handle,
          bio: data.creator.tagline,
          angle: videoType,
          platform,
          categories,
          summaries,
          campaign: data.campaign ? { title: data.campaign.title } : null,
          isNew,
        }),
      });
      const json = await res.json();
      setCaptionLoading(false);
      if (!json.configured) {
        setStatus({ msg: "Add an Anthropic API key in Admin, Credentials to write viral captions.", err: true });
        return;
      }
      if (!json.description && !(json.hashtags || []).length) {
        setStatus({ msg: "Could not write a caption, showing the built in one.", err: true });
        return;
      }
      setAiCaption({ description: json.description || "", hashtags: json.hashtags || [] });
      setStatus({ msg: "Wrote a viral caption and hashtags for this creator." });
    } catch {
      setCaptionLoading(false);
      setStatus({ msg: "Caption writing failed.", err: true });
    }
  };

  const writeScriptAI = async () => {
    setScriptLoading(true);
    try {
      const rows = (data.mediaAnalysis ?? []).filter(Boolean) as any[];
      const categories = Array.from(new Set(rows.map((m) => m.primary_category).filter(Boolean)));
      const summaries = rows.map((m) => m.visual_summary).filter(Boolean);
      const tiers = (data.memberships ?? []).map((t: any) => ({ name: t.name, price: t.price ?? t.price_monthly ?? "" }));
      const scenes = segments.map((s) => ({ id: s.scene, label: s.label, current: s.text }));
      const res = await fetch("/api/admin/video-studio/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.creator.name,
          bio: data.creator.tagline,
          angle: videoType,
          categories,
          summaries,
          campaign: data.campaign ? { title: data.campaign.title, goal: data.campaign.goal } : null,
          tiers,
          scenes,
        }),
      });
      const json = await res.json();
      setScriptLoading(false);
      if (!json.configured) {
        setStatus({ msg: "Add an Anthropic API key in Admin, Credentials to write scripts with AI.", err: true });
        return;
      }
      const lines: Record<string, string> = json.lines || {};
      if (!Object.keys(lines).length) {
        setStatus({ msg: "Could not write a custom script, keeping the current lines.", err: true });
        return;
      }
      setSegments(segments.map((s) => (lines[s.scene] ? { ...s, text: lines[s.scene] } : s)));
      setStatus({ msg: "Wrote a fresh script from this creator. Edit any line." });
    } catch {
      setScriptLoading(false);
      setStatus({ msg: "Script writing failed.", err: true });
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

  const currentTemplate = VS_TEMPLATES.find((t) => t.id === activeTemplate) ?? VS_TEMPLATES[0];
  const selectedCreator = creators.find((c) => c.id === creatorId);
  const mediaCount =
    (data.profileScreenshot ? 1 : 0) +
    (data.creator.cover ? 1 : 0) +
    (data.feedScreenshots?.filter(Boolean).length ?? 0) +
    (data.clips?.filter((c) => c?.url).length ?? 0);
  const clipCount = data.clips?.filter((c) => c?.url).length ?? 0;
  const hasCreator = Boolean(data.creator.name?.trim() && data.creator.handle?.trim());
  const hasHook = Boolean(segments.find((s) => s.scene === "hook")?.text?.trim());
  const hasCta = Boolean(segments.find((s) => s.scene === "cta")?.text?.trim());
  const activeOfferReady =
    videoType === "membership" || videoType === "whyJoin"
      ? memberships.length > 0
      : videoType === "campaign"
      ? Boolean(data.campaign?.title)
      : videoType === "marketplace"
      ? marketplace.length > 0
      : videoType === "merch"
      ? merch.length > 0
      : Boolean(memberships.length || data.campaign?.title || marketplace.length || merch.length);
  const platformLabel = platform === "tiktok" ? "TikTok" : platform === "reels" ? "Reels" : "Shorts";
  const targetLabel = lengthTarget === "short" ? "15 sec" : lengthTarget === "long" ? "45 sec" : "30 sec";
  const exportScaleLabel = resScale === 1 ? "1080p" : resScale === 0.5 ? "540p" : "720p";
  const statusText = status?.msg ?? "Ready for edits.";

  const stepItems: { id: StudioStep; label: string; eyebrow: string; ready: boolean }[] = [
    { id: "plan", label: "Plan", eyebrow: currentTemplate.label, ready: hasCreator },
    { id: "media", label: "Media", eyebrow: mediaCount ? `${mediaCount} assets` : "needs assets", ready: mediaCount > 0 },
    { id: "offer", label: "Offer", eyebrow: activeOfferReady ? "ready" : "optional", ready: activeOfferReady },
    { id: "script", label: "Script", eyebrow: `${segments.length} scenes`, ready: hasHook && hasCta },
    { id: "style", label: "Style", eyebrow: data.music ? "music set" : "default", ready: true },
    { id: "export", label: "Export", eyebrow: exportScaleLabel, ready: Boolean(renderUrl) },
  ];

  const checks = [
    { ok: hasCreator, label: "Creator loaded" },
    { ok: hasHook, label: "Strong opening hook" },
    { ok: hasCta, label: "Clear final ask" },
    { ok: mediaCount > 0, label: "Visual assets attached" },
    { ok: !bakeVo || captionsOn, label: "Captions on for silent viewing" },
  ];

  const updateFeedScreenshot = (idx: number, value: string) => {
    const next = [...(data.feedScreenshots ?? [])];
    if (value) next[idx] = value;
    else next.splice(idx, 1);
    set({ feedScreenshots: next.filter(Boolean) });
  };

  const resetSegment = (idx: number) => {
    const fresh = buildScriptSegments(videoType, data);
    const match = fresh.find((s) => s.scene === segments[idx]?.scene);
    if (match) setSegmentText(idx, match.text);
  };

  const shortenSegment = (idx: number) => {
    const text = segments[idx]?.text ?? "";
    const firstSentence = text.split(/(?<=[.!?])\s+/)[0]?.trim();
    const words = text.split(/\s+/).filter(Boolean);
    const shorter = firstSentence && firstSentence.length < text.length ? firstSentence : words.slice(0, 12).join(" ");
    if (shorter) setSegmentText(idx, shorter);
  };

  const renderOfferEditor = () => {
    if (videoType === "campaign") {
      return (
        <div className="vs-stack">
          <div className="vs-panel-head">
            <div>
              <div className="vs-eyebrow">Campaign push</div>
              <h2>Make the reel about the thing they are funding.</h2>
              <p>Use this when the video needs people to contribute, share, or understand the reason behind the campaign.</p>
            </div>
            <button className="adm-btn adm-btn--ghost" onClick={() => set({ campaign: undefined })}>Remove campaign</button>
          </div>
          <div className="vs-grid-two">
            <Field label="Campaign title">
              <input className="adm-input" value={data.campaign?.title ?? ""} placeholder="Keep me afloat" onChange={(e) => setCampaign({ title: e.target.value })} />
            </Field>
            <Field label="Backers">
              <input className="adm-input" type="number" value={data.campaign?.backers ?? 0} onChange={(e) => setCampaign({ backers: Number(e.target.value) })} />
            </Field>
            <Field label="Raised">
              <input className="adm-input" value={data.campaign?.raised ?? ""} placeholder="$1,500" onChange={(e) => setCampaign({ raised: e.target.value })} />
            </Field>
            <Field label="Goal">
              <input className="adm-input" value={data.campaign?.goal ?? ""} placeholder="$2,000" onChange={(e) => setCampaign({ goal: e.target.value })} />
            </Field>
          </div>
          <Field label={`Progress ${data.campaign?.pct ?? 0}%`}>
            <input type="range" min={0} max={100} value={data.campaign?.pct ?? 0} onChange={(e) => setCampaign({ pct: Number(e.target.value) })} style={{ width: "100%", accentColor: "#f5c842" }} />
          </Field>
        </div>
      );
    }

    if (videoType === "marketplace") {
      return (
        <div className="vs-stack">
          <div className="vs-panel-head">
            <div>
              <div className="vs-eyebrow">Marketplace promo</div>
              <h2>Feature what fans can buy directly from the creator.</h2>
              <p>Keep this focused. One to three items usually makes a better reel than a full catalog.</p>
            </div>
            <button className="adm-btn adm-btn--ghost" onClick={() => addToList(setData, "marketplace", { title: "New item", price: "$10" } as ShopItem)}>Add item</button>
          </div>
          {marketplace.length ? marketplace.map((it, i) => (
            <ShopRow key={i} title={it.title} price={it.price} image={it.image}
              onTitle={(v) => updateList(setData, "marketplace", i, { title: v })}
              onPrice={(v) => updateList(setData, "marketplace", i, { price: v })}
              onImage={(v) => updateList(setData, "marketplace", i, { image: v })}
              onRemove={() => removeFromList(setData, "marketplace", i)} />
          )) : <div className="vs-empty">No marketplace items yet. Add one item to make this reel specific.</div>}
        </div>
      );
    }

    if (videoType === "merch") {
      return (
        <div className="vs-stack">
          <div className="vs-panel-head">
            <div>
              <div className="vs-eyebrow">Merch drop</div>
              <h2>Sell the drop without making it feel like a boring product ad.</h2>
              <p>Use the best few pieces and let the creator page carry the rest.</p>
            </div>
            <button className="adm-btn adm-btn--ghost" onClick={() => addToList(setData, "merch", { name: "New item", price: "$20" } as MerchItem)}>Add merch</button>
          </div>
          {merch.length ? merch.map((it, i) => (
            <ShopRow key={i} title={it.name} price={it.price} image={it.image}
              onTitle={(v) => updateList(setData, "merch", i, { name: v })}
              onPrice={(v) => updateList(setData, "merch", i, { price: v })}
              onImage={(v) => updateList(setData, "merch", i, { image: v })}
              onRemove={() => removeFromList(setData, "merch", i)} />
          )) : <div className="vs-empty">No merch yet. Add a shirt, hat, mug, or featured item.</div>}
        </div>
      );
    }

    return (
      <div className="vs-stack">
        <div className="vs-panel-head">
          <div>
            <div className="vs-eyebrow">Subscription offer</div>
            <h2>Make the reel sell access, not just attention.</h2>
            <p>These tiers are what the final ask points to. Keep the perks plain and easy to understand.</p>
          </div>
          <button className="adm-btn adm-btn--ghost" onClick={() => addToList(setData, "memberships", { name: "New tier", price: "$5", cadence: "mo", perks: [] } as Membership)}>Add tier</button>
        </div>
        {memberships.length ? memberships.map((m, i) => (
          <div key={i} className="vs-row-card">
            <div className="vs-grid-three">
              <Field label="Tier name">
                <input className="adm-input" value={m.name} placeholder="Supporter" onChange={(e) => updateList(setData, "memberships", i, { name: e.target.value })} />
              </Field>
              <Field label="Price">
                <input className="adm-input" value={m.price} placeholder="$5" onChange={(e) => updateList(setData, "memberships", i, { price: e.target.value })} />
              </Field>
              <Field label="Cadence">
                <input className="adm-input" value={m.cadence ?? "mo"} placeholder="mo" onChange={(e) => updateList(setData, "memberships", i, { cadence: e.target.value })} />
              </Field>
            </div>
            <Field label="Perks">
              <input className="adm-input" value={(m.perks ?? []).join(", ")} placeholder="Behind the scenes, private updates, monthly drops" onChange={(e) => updateList(setData, "memberships", i, { perks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </Field>
            <button className="adm-btn adm-btn--ghost" onClick={() => removeFromList(setData, "memberships", i)}>Remove tier</button>
          </div>
        )) : <div className="vs-empty">No membership tiers yet. Add one tier so the video has something clear to sell.</div>}
      </div>
    );
  };

  return (
    <div className="vs-shell">
      <style>{`
        .vs-shell { max-width: 1520px; margin: 0 auto; }
        .vs-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
        .vs-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .vs-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .vs-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .vs-pill { border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #d5d5e2; border-radius: 999px; padding: 5px 10px; font-size: 11px; }
        .vs-workspace { display: grid; grid-template-columns: 220px minmax(0, 1fr) 370px; gap: 18px; align-items: start; }
        .vs-rail { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 8px; }
        .vs-step { width: 100%; text-align: left; border: 1px solid rgba(255,255,255,0.08); background: #101016; color: #e8e8f0; border-radius: 14px; padding: 13px 14px; cursor: pointer; transition: 0.15s ease; }
        .vs-step:hover { border-color: rgba(245,200,66,0.4); }
        .vs-step.is-active { border-color: #f5c842; background: linear-gradient(135deg, rgba(245,200,66,0.16), rgba(255,255,255,0.04)); }
        .vs-step-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-weight: 600; }
        .vs-step small { display: block; margin-top: 3px; color: #9a9aae; font-size: 11px; }
        .vs-dot { width: 8px; height: 8px; border-radius: 999px; background: #f5c842; box-shadow: 0 0 18px rgba(245,200,66,0.4); }
        .vs-dot.ready { background: #6ee7b7; box-shadow: 0 0 18px rgba(110,231,183,0.32); }
        .vs-main { min-width: 0; }
        .vs-panel { border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; background: radial-gradient(circle at top left, rgba(245,200,66,0.08), transparent 34%), #111118; padding: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.24); }
        .vs-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
        .vs-panel h2 { font-family: 'Cormorant Garamond', serif; font-size: 30px; line-height: 1.05; font-weight: 300; color: #fff; margin: 3px 0 7px; }
        .vs-panel p { color: #d5d5e2; font-size: 13px; line-height: 1.6; margin: 0; }
        .vs-eyebrow { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #f5c842; }
        .vs-grid-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .vs-grid-three { display: grid; grid-template-columns: 1fr 110px 90px; gap: 10px; }
        .vs-template-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
        .vs-template-card { border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.035); color: #e8e8f0; border-radius: 14px; padding: 14px; cursor: pointer; text-align: left; min-height: 86px; }
        .vs-template-card strong { display: block; color: #fff; margin-bottom: 4px; }
        .vs-template-card span { color: #9a9aae; font-size: 12px; line-height: 1.45; }
        .vs-template-card.is-active { border-color: #f5c842; background: rgba(245,200,66,0.09); }
        .vs-stack { display: flex; flex-direction: column; gap: 14px; }
        .vs-row-card, .vs-scene-card, .vs-media-card { border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.16); border-radius: 14px; padding: 14px; }
        .vs-scene-card textarea { min-height: 74px; }
        .vs-scene-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 8px; }
        .vs-scene-title { font-size: 13px; font-weight: 700; color: #fff; }
        .vs-tiny-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .vs-tiny { border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #d5d5e2; border-radius: 999px; padding: 5px 9px; font-size: 11px; cursor: pointer; }
        .vs-hook-list { display: grid; gap: 8px; }
        .vs-hook-btn { text-align: left; border-radius: 12px; padding: 11px 13px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.035); color: #e8e8f0; cursor: pointer; }
        .vs-hook-btn.is-active { border-color: #f5c842; background: rgba(245,200,66,0.08); }
        .vs-empty { border: 1px dashed rgba(255,255,255,0.16); border-radius: 14px; padding: 18px; color: #9a9aae; font-size: 13px; text-align: center; }
        .vs-preview { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 14px; }
        .vs-preview-card { border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; background: #111118; padding: 14px; }
        .vs-phone-wrap { max-width: 310px; margin: 0 auto; }
        .vs-check { display: flex; align-items: center; gap: 9px; color: #d5d5e2; font-size: 12.5px; margin-top: 7px; }
        .vs-check span:first-child { width: 16px; color: #f5c842; }
        .vs-check.ok span:first-child { color: #6ee7b7; }
        .vs-side-title { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #9a9aae; margin-bottom: 8px; }
        .vs-footer-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
        .vs-advanced { margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; }
        details.vs-dev > summary { cursor: pointer; color: #8fb0ff; font-size: 12px; margin-bottom: 10px; }
        @media (max-width: 1250px) { .vs-workspace { grid-template-columns: 190px minmax(0, 1fr); } .vs-preview { grid-column: 1 / -1; position: static; } .vs-phone-wrap { max-width: 360px; } }
        @media (max-width: 850px) { .vs-top, .vs-panel-head { flex-direction: column; } .vs-workspace { grid-template-columns: 1fr; } .vs-rail { position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } .vs-grid-two, .vs-template-grid, .vs-grid-three { grid-template-columns: 1fr; } }
      `}</style>

      <div className="vs-top">
        <div>
          <div className="kicker">Marketing</div>
          <div className="vs-title-row">
            <h1 className="adm-page-title" style={{ margin: 0 }}>Reel <em>Maker</em></h1>
            <span className="badge badge--yellow">{platformLabel}</span>
          </div>
          <p className="adm-page-lede" style={{ margin: "8px 0 0" }}>
            Pick the creator, choose the purpose, tighten the scenes, then export a vertical reel.
          </p>
          <div className="vs-meta">
            <span className="vs-pill">{selectedCreator ? `${selectedCreator.display_name} ${selectedCreator.handle}` : data.creator.handle || "No creator selected"}</span>
            <span className="vs-pill">{currentTemplate.label}</span>
            <span className="vs-pill">{segments.length} scenes</span>
            <span className="vs-pill">{seconds}s</span>
          </div>
        </div>
        <div className="vs-actions">
          <button className="adm-btn adm-btn--ghost" onClick={saveDraft}>Save draft</button>
          <button className="adm-btn adm-btn--ghost" onClick={generateSmart}>Rebuild script</button>
          <button className="adm-btn adm-btn--primary" onClick={exportMp4}>Export video</button>
        </div>
      </div>

      <div className="vs-workspace">
        <nav className="vs-rail" aria-label="Video builder steps">
          {stepItems.map((step) => (
            <button key={step.id} type="button" className={`vs-step ${activeStep === step.id ? "is-active" : ""}`} onClick={() => setActiveStep(step.id)}>
              <div className="vs-step-top">
                <span>{step.label}</span>
                <i className={`vs-dot ${step.ready ? "ready" : ""}`} />
              </div>
              <small>{step.eyebrow}</small>
            </button>
          ))}
        </nav>

        <main className="vs-main">
          {activeStep === "plan" ? (
            <section className="vs-panel">
              <div className="vs-panel-head">
                <div>
                  <div className="vs-eyebrow">Plan the reel</div>
                  <h2>One screen for the decision that matters.</h2>
                  <p>Choose the creator and the job this video has to do. The rest of the builder follows that choice.</p>
                </div>
                <button className="adm-btn adm-btn--primary" onClick={() => { generateSmart(); setActiveStep("script"); }}>Build scenes</button>
              </div>

              <div className="vs-grid-two">
                <Field label="Creator">
                  <CreatorPicker creators={creators} value={creatorId} onChange={loadCreator} loading={loadingCreator} />
                </Field>
                <Field label="Audience goal">
                  <select className="adm-select" value={data.goal ?? "subs"} onChange={(e) => setGoal(e.target.value as "subs" | "platform")}>
                    <option value="subs">Turn fans into subscribers</option>
                    <option value="platform">Recruit creators to Spotlightly</option>
                  </select>
                </Field>
              </div>

              <div className="vs-template-grid">
                {VS_TEMPLATES.map((t) => (
                  <button key={t.id} type="button" className={`vs-template-card ${activeTemplate === t.id ? "is-active" : ""}`} onClick={() => applyTemplate(t)}>
                    <strong>{t.label}</strong>
                    <span>{
                      t.id === "launch" ? "A full creator page intro with a broad final ask." :
                      t.id === "membership" ? "Push paid access, private posts, and member perks." :
                      t.id === "merch" ? "Show the drop and send fans to shop." :
                      t.id === "campaign" ? "Explain the cause and drive contributions." :
                      t.id === "marketplace" ? "Feature products or services the creator sells." :
                      t.id === "behindScenes" ? "Make the creator feel real and worth following." :
                      "A soft ask for support without a hard product pitch."
                    }</span>
                  </button>
                ))}
              </div>

              <div className="vs-grid-two" style={{ marginTop: 18 }}>
                <Field label="Platform">
                  <select className="adm-select" value={platform} onChange={(e) => setPlatform(e.target.value as "tiktok" | "reels" | "shorts")}>
                    <option value="tiktok">TikTok</option>
                    <option value="reels">Instagram Reels</option>
                    <option value="shorts">YouTube Shorts</option>
                  </select>
                </Field>
                <Field label="Target length">
                  <select className="adm-select" value={lengthTarget} onChange={(e) => setLengthTarget(e.target.value as "short" | "standard" | "long")}>
                    <option value="short">Short, about 15 seconds</option>
                    <option value="standard">Standard, about 30 seconds</option>
                    <option value="long">Long, about 45 seconds</option>
                  </select>
                </Field>
                <Field label="Creator voice">
                  <select className="adm-select" value={data.personality ?? "inspirational"} onChange={(e) => setPersonality(e.target.value as Personality)}>
                    {PERSONALITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Offer text">
                  <input className="adm-input" value={data.offer ?? ""} placeholder="First week free" onChange={(e) => set({ offer: e.target.value || undefined })} />
                </Field>
              </div>
            </section>
          ) : null}

          {activeStep === "media" ? (
            <section className="vs-panel">
              <div className="vs-panel-head">
                <div>
                  <div className="vs-eyebrow">Media tray</div>
                  <h2>Use cards, not a wall of pasted links.</h2>
                  <p>Add the few assets that make the reel feel real. Raw hosted links still work, but they are tucked into each card.</p>
                </div>
                <div className="vs-tiny-actions">
                  <button className="adm-btn adm-btn--ghost" disabled={analyzing} onClick={analyzeMedia}>{analyzing ? "Analyzing" : "Analyze media"}</button>
                  {data.mediaAnalysis?.some(Boolean) ? <button className="adm-btn adm-btn--ghost" onClick={() => setShowAnalysis((s) => !s)}>{showAnalysis ? "Hide tags" : "Show tags"}</button> : null}
                </div>
              </div>

              <div className="vs-grid-two">
                <div className="vs-media-card">
                  <Field label="Profile screenshot">
                    <AssetInput value={data.profileScreenshot} onChange={(v) => set({ profileScreenshot: v || undefined })} />
                  </Field>
                </div>
                <div className="vs-media-card">
                  <Field label="Cover image">
                    <AssetInput value={data.creator.cover} onChange={(v) => setCreator({ cover: v || undefined })} />
                  </Field>
                </div>
              </div>

              <div className="vs-stack" style={{ marginTop: 14 }}>
                <div className="vs-side-title">Story photos</div>
                {[0, 1, 2, 3].map((i) => (
                  <div className="vs-media-card" key={i}>
                    <Field label={`Photo slot ${i + 1}`}>
                      <AssetInput value={data.feedScreenshots?.[i]} onChange={(v) => updateFeedScreenshot(i, v)} />
                    </Field>
                    {showAnalysis && data.mediaAnalysis?.[i] ? (
                      <div style={{ fontSize: 11, color: "#9a9aae", marginTop: 8 }}>
                        <strong style={{ color: "#f5c842" }}>{data.mediaAnalysis[i]?.primary_category ?? "Tagged"}</strong> · {data.mediaAnalysis[i]?.emotional_tone ?? "tone"} · {(data.mediaAnalysis[i]?.story_beats ?? []).join(", ")}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="vs-stack" style={{ marginTop: 18 }}>
                <div className="vs-side-title">Video cutaways</div>
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
                    <div key={i} className="vs-media-card">
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input className="adm-input" value={c?.url ?? ""} placeholder="Hosted mp4 URL" onChange={(e) => updateClip(i, { url: e.target.value })} />
                        <label className="adm-btn adm-btn--ghost" style={{ whiteSpace: "nowrap", cursor: "pointer" }}>
                          {clipUploading === i ? "Uploading" : "Upload"}
                          <input type="file" accept="video/mp4,video/*" style={{ display: "none" }} disabled={clipUploading !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadClip(i, f); }} />
                        </label>
                        {c?.url ? <button className="adm-btn adm-btn--ghost" onClick={() => removeClip(i)}>Remove</button> : null}
                      </div>
                      {c?.url ? (
                        <div className="vs-grid-two" style={{ marginTop: 10 }}>
                          <Field label="Overlay text">
                            <input className="adm-input" list="clip-labels" value={c.label ?? ""} placeholder="How she made this" onChange={(e) => updateClip(i, { label: e.target.value })} />
                          </Field>
                          <div className="vs-grid-two">
                            <Field label="Start sec">
                              <input className="adm-input" type="number" min={0} step={0.5} value={c.trimStart ?? 0} onChange={(e) => updateClip(i, { trimStart: Math.max(0, Number(e.target.value) || 0) })} />
                            </Field>
                            <Field label="Length sec">
                              <input className="adm-input" type="number" min={1} max={10} step={0.5} value={c.maxSeconds ?? ""} placeholder="auto" onChange={(e) => updateClip(i, { maxSeconds: e.target.value === "" ? undefined : Math.min(10, Math.max(1, Number(e.target.value) || 0)) })} />
                            </Field>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeStep === "offer" ? (
            <section className="vs-panel">
              <div className="vs-panel-head">
                <div>
                  <div className="vs-eyebrow">Offer mode</div>
                  <h2>Only edit the thing this reel is selling.</h2>
                  <p>The selected purpose decides what shows here. Switch purpose if the reel needs a different business angle.</p>
                </div>
                <select className="adm-select" style={{ maxWidth: 250 }} value={activeTemplate} onChange={(e) => { const t = VS_TEMPLATES.find((x) => x.id === e.target.value); if (t) applyTemplate(t); }}>
                  {VS_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              {renderOfferEditor()}
            </section>
          ) : null}

          {activeStep === "script" ? (
            <section className="vs-panel">
              <div className="vs-panel-head">
                <div>
                  <div className="vs-eyebrow">Script board</div>
                  <h2>Scene cards you can actually work with.</h2>
                  <p>Each card is one beat in the reel. Keep the lines short enough to hear and read fast.</p>
                </div>
                <div className="vs-tiny-actions">
                  <button className="adm-btn adm-btn--ghost" onClick={voIdx !== null ? stopVoiceover : previewVoiceover} disabled={voLoading}>{voLoading ? "Loading" : voIdx !== null ? "Stop" : "Hear voice"}</button>
                  <button className="adm-btn adm-btn--ghost" onClick={() => setSegments(buildScriptSegments(videoType, data))}>Rewrite all</button>
                  <button className="adm-btn adm-btn--primary" disabled={scriptLoading} onClick={writeScriptAI}>{scriptLoading ? "Writing" : "Write with AI"}</button>
                  <button className="adm-btn adm-btn--primary" onClick={copyScript}>{copied ? "Copied" : "Copy"}</button>
                </div>
              </div>

              <div className="vs-row-card" style={{ marginBottom: 14 }}>
                <div className="vs-panel-head" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="vs-side-title">Opening hook</div>
                    <p>Tap a hook to use it, or ask the system to write hooks from the creator media.</p>
                  </div>
                  <button className="adm-btn adm-btn--ghost" disabled={hooksLoading} onClick={writeHooks}>{hooksLoading ? "Thinking" : aiHooks ? "Suggest again" : "Suggest hooks"}</button>
                </div>
                <div className="vs-hook-list">
                  {(aiHooks && aiHooks.length ? aiHooks.map((t) => ({ text: t, score: scoreHook(t) })).sort((a, b) => b.score - a.score).slice(0, 6) : hooksFor(data, 4)).map((h, i) => {
                    const inUse = segments.find((s) => s.scene === "hook")?.text === h.text;
                    return <button key={i} type="button" className={`vs-hook-btn ${inUse ? "is-active" : ""}`} onClick={() => setHook(h.text)}>{h.text}</button>;
                  })}
                </div>
              </div>

              <div className="vs-stack">
                {segments.map((seg, i) => (
                  <div className="vs-scene-card" key={`${seg.scene}-${i}`}>
                    <div className="vs-scene-head">
                      <div className="vs-scene-title">{i + 1}. {seg.label}{voIdx === i ? <span style={{ color: "#f5c842", marginLeft: 8 }}>playing</span> : null}</div>
                      <div className="vs-tiny-actions">
                        <button className="vs-tiny" onClick={() => shortenSegment(i)}>Shorter</button>
                        <button className="vs-tiny" onClick={() => resetSegment(i)}>Reset</button>
                        <button className="vs-tiny" onClick={() => navigator.clipboard?.writeText(seg.text)}>Copy</button>
                      </div>
                    </div>
                    <textarea className="adm-textarea" value={seg.text} onChange={(e) => setSegmentText(i, e.target.value)} style={{ borderColor: voIdx === i ? "#f5c842" : undefined }} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeStep === "style" ? (
            <section className="vs-panel">
              <div className="vs-panel-head">
                <div>
                  <div className="vs-eyebrow">Look and sound</div>
                  <h2>Control the feel without digging through the whole page.</h2>
                  <p>Opening, closing, background strength, music, captions, and voice are all here.</p>
                </div>
              </div>

              <div className="vs-grid-two">
                <Field label="Intro headline">
                  <input className="adm-input" value={data.intro.headline} onChange={(e) => setIntro({ headline: e.target.value })} />
                </Field>
                <Field label="CTA headline">
                  <input className="adm-input" value={data.cta.headline} onChange={(e) => setCta({ headline: e.target.value })} />
                </Field>
                <Field label="CTA subline">
                  <input className="adm-input" value={data.cta.sub ?? ""} onChange={(e) => setCta({ sub: e.target.value })} />
                </Field>
                <Field label="CTA URL">
                  <input className="adm-input" value={data.cta.url ?? ""} onChange={(e) => setCta({ url: e.target.value })} />
                </Field>
              </div>

              <div className="vs-row-card" style={{ marginTop: 14 }}>
                <Field label={`Background strength ${Math.round((data.bgIntensity ?? 0.4) * 100)}%`}>
                  <input type="range" min={0} max={1} step={0.05} value={data.bgIntensity ?? 0.4} onChange={(e) => set({ bgIntensity: Number(e.target.value) })} style={{ width: "100%", accentColor: "#f5c842" }} />
                </Field>
              </div>

              <div className="vs-row-card" style={{ marginTop: 14 }}>
                <div className="vs-grid-two">
                  <Field label="Music genre">
                    <select className="adm-select" value={musicGenre} onChange={(e) => setMusicGenre(e.target.value as MusicGenre | "all")}>
                      <option value="all">All genres</option>
                      {MUSIC_GENRES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Track">
                    <select className="adm-select" value={MUSIC_LIBRARY.some((t) => t.url === data.music) ? data.music : ""} onChange={(e) => { const t = MUSIC_LIBRARY.find((x) => x.url === e.target.value); set({ music: e.target.value || undefined, ...(t?.volume != null ? { musicVolume: t.volume } : {}) }); }}>
                      <option value="">{tracksByGenre(musicGenre).length ? "Choose a track" : "No tracks yet"}</option>
                      {tracksByGenre(musicGenre).map((t) => <option key={t.id} value={t.url}>{t.title}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Or paste music URL">
                  <input className="adm-input" value={data.music ?? ""} placeholder="https://spotlightly.b-cdn.net/music/track.mp3" onChange={(e) => set({ music: e.target.value || undefined })} />
                </Field>
                <Field label={`Music volume ${Math.round((data.musicVolume ?? 0.6) * 100)}%`}>
                  <input type="range" min={0} max={1} step={0.05} value={data.musicVolume ?? 0.6} onChange={(e) => set({ musicVolume: Number(e.target.value) })} style={{ width: "100%", accentColor: "#f5c842" }} />
                </Field>
                {data.music ? <audio key={data.music} controls src={data.music} style={{ width: "100%", marginTop: 8 }} /> : null}
                {data.music ? <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "#e7e7f0", cursor: "pointer" }}><input type="checkbox" checked={syncMusic} onChange={(e) => setSyncMusic(e.target.checked)} /> Sync cuts to the beat in the final render</label> : null}
              </div>

              <div className="vs-row-card" style={{ marginTop: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#e8e8f0" }}><input type="checkbox" checked={bakeVo} onChange={(e) => setBakeVo(e.target.checked)} /> Add spoken voiceover</label>
                <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, marginTop: 8, color: bakeVo ? "#e8e8f0" : "#6b6b80" }}><input type="checkbox" checked={captionsOn} disabled={!bakeVo} onChange={(e) => setCaptionsOn(e.target.checked)} /> Show captions</label>
                <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, marginTop: 8, color: bakeVo ? "#e8e8f0" : "#6b6b80" }}><input type="checkbox" checked={fluidVo} disabled={!bakeVo} onChange={(e) => setFluidVo(e.target.checked)} /> Read as one smooth take</label>
              </div>
            </section>
          ) : null}

          {activeStep === "export" ? (
            <section className="vs-panel">
              <div className="vs-panel-head">
                <div>
                  <div className="vs-eyebrow">Export room</div>
                  <h2>Render the reel or build a full content pack.</h2>
                  <p>Preview stays live on the right. Export calls the render service and downloads the MP4.</p>
                </div>
                <button className="adm-btn adm-btn--primary" onClick={exportMp4}>Export video</button>
              </div>

              <div className="vs-grid-two">
                <Field label="Render service URL">
                  <input className="adm-input" value={renderUrl} placeholder="https://your-render-service" onChange={(e) => setRenderUrl(e.target.value)} />
                </Field>
                <Field label="Resolution">
                  <select className="adm-select" value={resScale} onChange={(e) => setResScale(Number(e.target.value))}>
                    <option value={0.5}>540p fastest</option>
                    <option value={0.6667}>720p recommended</option>
                    <option value={1}>1080p full quality</option>
                  </select>
                </Field>
              </div>

              <div className="vs-row-card" style={{ marginTop: 14 }}>
                <div className="vs-side-title">Ready check</div>
                {checks.map((c, i) => <div key={i} className={`vs-check ${c.ok ? "ok" : ""}`}><span>{c.ok ? "✓" : "!"}</span><span>{c.label}</span></div>)}
              </div>

              <div className="vs-row-card" style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div className="vs-side-title" style={{ margin: 0 }}>Caption for the post</div>
                  <button className="adm-btn adm-btn--primary" style={{ padding: "6px 12px", whiteSpace: "nowrap" }} disabled={captionLoading} onClick={writeCaptionAI}>
                    {captionLoading ? "Writing" : aiCaption ? "Rewrite with AI" : "Write viral caption with AI"}
                  </button>
                </div>
                {(() => {
                  const caption = aiCaption?.description || captionFor(data, videoType as Angle);
                  const tags = (aiCaption?.hashtags?.length ? aiCaption.hashtags : hashtagsFor(data, videoType as Angle)).join(" ");
                  const full = `${caption}\n\n${tags}`;
                  return (
                    <>
                      <textarea
                        readOnly
                        value={caption}
                        className="adm-input"
                        style={{ minHeight: 96, resize: "vertical", width: "100%", lineHeight: 1.5, marginTop: 10 }}
                      />
                      <div style={{ fontSize: 12.5, color: "#8fb0ff", marginTop: 8, wordBreak: "break-word", lineHeight: 1.6 }}>{tags}</div>
                      <button
                        className="adm-btn adm-btn--ghost"
                        style={{ marginTop: 10 }}
                        onClick={() => {
                          navigator.clipboard?.writeText(full);
                          setStatus({ msg: "Caption and hashtags copied. Paste them into TikTok or Reels." });
                        }}
                      >
                        Copy caption and hashtags
                      </button>
                    </>
                  );
                })()}
              </div>

              <div className="vs-footer-actions">
                <button className="adm-btn adm-btn--primary" onClick={exportMp4}>Export video</button>
                <button className="adm-btn adm-btn--ghost" onClick={saveDraft}>Save draft</button>
                <button className="adm-btn adm-btn--ghost" onClick={copyJson}>Copy JSON</button>
                <button className="adm-btn adm-btn--ghost" disabled={batchRunning} onClick={runBatch}>{batchRunning ? "Rendering pack" : "Render content pack"}</button>
              </div>

              {status ? <div className={`adm-banner ${status.err ? "adm-banner--err" : "adm-banner--ok"}`} style={{ marginTop: 14, marginBottom: 0 }}>{status.msg}</div> : null}

              {batch.length > 0 ? (
                <div className="vs-stack" style={{ marginTop: 16 }}>
                  {batch.map((b) => {
                    const packData = { ...data, videoType: b.type } as VideoData;
                    const caption = captionFor(packData, b.type as Angle);
                    const tags = hashtagsFor(packData, b.type as Angle).join(" ");
                    const copyText = `${caption}\n\n${tags}`;
                    return (
                      <div key={b.type} className="vs-row-card">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <strong>{b.label}</strong>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {b.status === "ready" && b.url ? <a className="adm-btn adm-btn--ghost" href={b.url} download={`${handleSlug}-${b.type}.mp4`}>Download</a> : null}
                            <span className={`badge ${badgeClass(b.status)}`}>{statusLabel(b.status)}</span>
                          </span>
                        </div>
                        {b.status !== "skipped" ? <><div style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#cfcfdd", marginTop: 8 }}>{caption}</div><div style={{ fontSize: 12, color: "#8fb0ff", marginTop: 6 }}>{tags}</div><button className="adm-btn adm-btn--ghost" style={{ marginTop: 8 }} onClick={() => navigator.clipboard?.writeText(copyText)}>Copy caption</button></> : null}
                      </div>
                    );
                  })}
                  {batchDone && anyReady ? <button className="adm-btn adm-btn--ghost" onClick={downloadAll}>Download all</button> : null}
                </div>
              ) : null}

              <details className="vs-dev">
                <summary>Developer tools</summary>
                <button className="adm-btn adm-btn--ghost" onClick={() => { setShowJson((s) => !s); setJsonText(JSON.stringify(data, null, 2)); }}>{showJson ? "Hide" : "Show"} raw JSON</button>
                {showJson ? <div style={{ marginTop: 10 }}><textarea className="adm-textarea" style={{ minHeight: 220, fontFamily: "monospace", fontSize: 12 }} value={jsonText} onChange={(e) => setJsonText(e.target.value)} /><button className="adm-btn adm-btn--ghost" style={{ marginTop: 8 }} onClick={() => { try { setData(JSON.parse(jsonText)); setStatus({ msg: "Applied JSON." }); } catch { setStatus({ msg: "That JSON did not parse.", err: true }); } }}>Apply JSON</button></div> : null}
              </details>
            </section>
          ) : null}
        </main>

        <aside className="vs-preview">
          <div className="vs-preview-card">
            <div className="vs-side-title">Live phone preview</div>
            <div className="vs-phone-wrap"><Player data={previewData} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "#d5d5e2" }}>
              <span>{scenes.length} scenes</span>
              <span>{seconds}s · 9:16 · {exportScaleLabel}</span>
            </div>
          </div>

          <div className="vs-preview-card">
            <div className="vs-side-title">Reel brief</div>
            <div className="vs-pill" style={{ display: "inline-block", marginBottom: 8 }}>{currentTemplate.label}</div>
            <p style={{ color: "#d5d5e2", fontSize: 13, lineHeight: 1.55, margin: 0 }}>
              {data.goal === "platform" ? "Creator recruitment angle for Spotlightly." : "Fan conversion angle for this creator."} Target: {platformLabel}, {targetLabel}.
            </p>
          </div>

          <div className="vs-preview-card">
            <div className="vs-side-title">Checks</div>
            {checks.map((c, i) => <div key={i} className={`vs-check ${c.ok ? "ok" : ""}`}><span>{c.ok ? "✓" : "!"}</span><span>{c.label}</span></div>)}
            <div className={`adm-banner ${status?.err ? "adm-banner--err" : "adm-banner--ok"}`} style={{ marginTop: 12, marginBottom: 0 }}>{statusText}</div>
          </div>

          <div className="vs-preview-card">
            <div className="vs-side-title">Fast actions</div>
            <div className="vs-footer-actions" style={{ marginTop: 0 }}>
              <button className="adm-btn adm-btn--primary" onClick={exportMp4}>Export</button>
              <button className="adm-btn adm-btn--ghost" onClick={() => setActiveStep("script")}>Edit script</button>
              <button className="adm-btn adm-btn--ghost" onClick={() => setActiveStep("media")}>Media</button>
            </div>
          </div>
        </aside>
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
