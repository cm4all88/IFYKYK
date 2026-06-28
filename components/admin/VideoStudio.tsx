"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type {
  VideoData,
  VideoType,
  Membership,
  ShopItem,
  MerchItem,
} from "@/components/video/types";
import { buildScenes } from "@/components/video/scenes";
import { sampleData } from "@/components/video/sampleData";
import CreatorPicker from "./CreatorPicker";

type ReelStatus = "queued" | "rendering" | "ready" | "failed" | "skipped";
type ReelItem = { type: VideoType; label: string; status: ReelStatus; url?: string };
const REEL_TYPES: { type: VideoType; label: string }[] = [
  { type: "launch", label: "Launch reel" },
  { type: "campaign", label: "Campaign reel" },
  { type: "membership", label: "Membership reel" },
  { type: "marketplace", label: "Marketplace reel" },
  { type: "merch", label: "Merch reel" },
];
const reelEligible = (t: VideoType, d: VideoData): boolean => {
  switch (t) {
    case "launch": return true;
    case "campaign": return !!d.campaign;
    case "membership": return !!d.memberships?.length;
    case "marketplace": return !!d.marketplace?.length;
    case "merch": return !!d.merch?.length;
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

function buildScript(type: VideoType, d: VideoData): string {
  const name = d.creator.name || "this creator";
  const fname = firstNameOf(name);
  const handle = d.creator.handle || "";
  const bio = (d.creator.tagline || "").trim();
  const tiers = d.memberships ?? [];
  const camp = d.campaign;
  const market = d.marketplace ?? [];
  const merch = d.merch ?? [];
  const low = lowestPrice(tiers);
  const firstPerks = tiers[0]?.perks?.slice(0, 2).join(" and ");
  const onSpot = `Find ${name} on Spotlightly${handle ? `, ${handle}` : ""}.`;

  if (type === "campaign") {
    if (!camp) return `Support ${name} on Spotlightly. ${onSpot}`;
    return [
      `${fname} is building something, and you can be part of it.`,
      `The ${camp.title} campaign is ${camp.pct} percent funded, ${camp.raised} raised of ${camp.goal}${camp.backers ? `, with ${camp.backers} people already backing it` : ""}.`,
      `Every contribution moves it closer.`,
      `Back the campaign on Spotlightly and help make it happen.`,
      onSpot,
    ].join(" ");
  }

  if (type === "membership") {
    return [
      `Get closer to ${name}.`,
      tiers.length
        ? `Membership starts${low != null ? ` at $${low} a month` : ""}${firstPerks ? `, with ${firstPerks.toLowerCase()}` : ""}.`
        : `Become a member and unlock the content made for the people who care most.`,
      `It is the real, unfiltered version, just for the inner circle.`,
      `Join on Spotlightly and pull up a seat.`,
      onSpot,
    ].join(" ");
  }

  if (type === "marketplace") {
    if (!market.length) return `Shop ${name} on Spotlightly. ${onSpot}`;
    const items = market.slice(0, 3).map((m) => m.title).join(", ");
    return [
      `${fname} just dropped something new.`,
      `From ${items}, every piece comes straight from the source.`,
      `Grab yours before it is gone.`,
      `Shop the marketplace on Spotlightly.`,
      onSpot,
    ].join(" ");
  }

  if (type === "merch") {
    if (!merch.length) return `Get ${name} merch on Spotlightly. ${onSpot}`;
    const items = merch.slice(0, 3).map((m) => m.name).join(", ");
    return [
      `Wear it, carry it, make it yours.`,
      `${fname} merch is here. ${items}, and more.`,
      `Real gear for the people who show up.`,
      `Shop the drop on Spotlightly.`,
      onSpot,
    ].join(" ");
  }

  // launch (default): the full overview
  return [
    `Meet ${name}.`,
    bio,
    `Everything now lives in one place on Spotlightly.`,
    tiers.length
      ? `Become a member${low != null ? ` from $${low} a month` : ""}${firstPerks ? ` and unlock ${firstPerks.toLowerCase()}` : ""}.`
      : "",
    camp ? `The ${camp.title} campaign is already ${camp.pct} percent funded.` : "",
    `Follow along, support the work, and get closer than ever.`,
    onSpot,
  ]
    .filter(Boolean)
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
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        className="adm-input"
        value={value ?? ""}
        placeholder={placeholder ?? "Paste an image url (BunnyCDN)"}
        onChange={(e) => onChange(e.target.value)}
      />
      <label className="adm-btn adm-btn--ghost" style={{ whiteSpace: "nowrap", cursor: "pointer" }}>
        Upload
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onChange(URL.createObjectURL(f));
          }}
        />
      </label>
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
      setScript(buildScript(videoType, vd));
      setStatus({ msg: "Loaded from Spotlightly. Edit anything below to override." });
    } catch (e) {
      setStatus({ msg: (e as Error).message, err: true });
    } finally {
      setLoadingCreator(false);
    }
  };

  const setType = (t: VideoType) => {
    setData((d) => ({ ...d, videoType: t }));
    setScript(buildScript(t, data));
  };

  const [batch, setBatch] = useState<ReelItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const handleSlug = (data.creator.handle || "creator").replace(/[^a-z0-9]/gi, "") || "creator";

  const [script, setScript] = useState<string>(() =>
    buildScript((sampleData.videoType ?? "launch") as VideoType, sampleData)
  );
  const [copied, setCopied] = useState(false);
  const [bakeVo, setBakeVo] = useState(true);
  const copyScript = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
            data: { ...base, videoType: r.type },
            narrationScript: bakeVo ? buildScript(r.type, base) : undefined,
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
  const seconds = useMemo(
    () => (scenes.reduce((a, s) => a + s.durationInFrames, 0) / 30).toFixed(1),
    [scenes]
  );

  const set = (patch: Partial<VideoData>) => setData((d) => ({ ...d, ...patch }));
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
        body: JSON.stringify({ data: clean, narrationScript: bakeVo ? script : undefined }),
      });
      if (!res.ok) throw new Error("Render failed (" + res.status + ")");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (data.creator.handle || "spotlightly").replace(/[^a-z0-9]/gi, "") + ".mp4";
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ msg: "Done. Your MP4 downloaded." });
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
                  <option value="launch">Launch reel</option>
                  <option value="campaign">Campaign reel</option>
                  <option value="membership">Membership reel</option>
                  <option value="marketplace">Marketplace reel</option>
                  <option value="merch">Merch reel</option>
                </select>
              </Field>
            </div>
            <p style={{ fontSize: 11, color: "#d5d5e2", margin: 0 }}>
              {loadingCreator
                ? "Loading..."
                : "Data auto loads from existing Spotlightly tables. The fields below are optional overrides, never required."}
            </p>
          </div>

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0, padding: 0, border: "none" }}>
                Voiceover script
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="adm-btn adm-btn--ghost" style={{ padding: "6px 14px" }} onClick={() => setScript(buildScript(videoType, data))}>
                  Regenerate
                </button>
                <button className="adm-btn adm-btn--primary" style={{ padding: "6px 14px" }} onClick={copyScript}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <textarea
              className="adm-textarea"
              style={{ minHeight: 130, lineHeight: 1.6 }}
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, marginTop: 12, color: "#e8e8f0" }}>
              <input type="checkbox" checked={bakeVo} onChange={(e) => setBakeVo(e.target.checked)} />
              Bake this voiceover into the MP4 on export (narrated with ElevenLabs)
            </label>
            <p style={{ marginTop: 8, fontSize: 11, color: "#d5d5e2", lineHeight: 1.6 }}>
              Suggested narration for the {videoType} reel, built from this creator. Edit freely. With bake on,
              Export speaks it with ElevenLabs and merges it into the video, ducking the music underneath. The
              video stretches to fit the voice. Or turn bake off and Copy it for CapCut or any other tool.
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
            <Field label="Music url">
              <input className="adm-input" value={data.music ?? ""} placeholder="https://.../track.mp3" onChange={(e) => set({ music: e.target.value || undefined })} />
            </Field>
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
          <Player data={data} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "#d5d5e2" }}>
            <span>{scenes.length} scenes</span>
            <span>{seconds}s . 1080x1920 . 30fps</span>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Export</div>
            <Field label="Render service url (optional)">
              <input className="adm-input" value={renderUrl} placeholder="https://your-render-service" onChange={(e) => setRenderUrl(e.target.value)} />
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
            <div className="card-title">Batch reels</div>
            <button className="adm-btn adm-btn--primary" disabled={batchRunning} onClick={runBatch}>
              {batchRunning ? "Rendering..." : "Render all five reel types"}
            </button>

            {batch.length > 0 ? (
              <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {batch.map((b) => (
                  <li key={b.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 13 }}>{b.label}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {b.status === "ready" && b.url ? (
                        <a className="adm-btn adm-btn--ghost" style={{ padding: "5px 12px" }} href={b.url} download={`${handleSlug}-${b.type}.mp4`}>
                          Download
                        </a>
                      ) : null}
                      <span className={`badge ${badgeClass(b.status)}`}>{statusLabel(b.status)}</span>
                    </span>
                  </li>
                ))}
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
