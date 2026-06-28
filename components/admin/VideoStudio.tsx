"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type {
  VideoData,
  Membership,
  ShopItem,
  MerchItem,
} from "@/components/video/types";
import { buildScenes } from "@/components/video/scenes";
import { sampleData } from "@/components/video/sampleData";

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
          : "Rendering... this can take a minute.",
      });
      const res = await fetch(renderUrl.replace(/\/$/, "") + "/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: clean }),
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
