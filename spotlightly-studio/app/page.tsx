'use client';

import React, {useMemo, useState} from 'react';
import dynamic from 'next/dynamic';
import type {VideoData, Membership, ShopItem, MerchItem} from './../components/video/types';
import {buildScenes} from './../components/video/scenes';
import {sampleData} from './../components/video/sampleData';

// Player is client-only (loads Remotion + fonts in the browser, never on the server).
const StudioPlayer = dynamic(() => import('./../components/StudioPlayer'), {
  ssr: false,
  loading: () => (
    <div style={{aspectRatio: '1080 / 1920', borderRadius: 18, background: '#FBFAF7', display: 'grid', placeItems: 'center', color: '#9A9AA2', fontFamily: 'system-ui'}}>
      Loading preview...
    </div>
  ),
});

const C = {
  bg: '#F2EDE3',
  panel: '#FFFFFF',
  ink: '#17181B',
  sub: '#6E6E76',
  gold: '#F0B429',
  goldDeep: '#C68A12',
  line: 'rgba(23,24,27,0.10)',
  soft: 'rgba(23,24,27,0.04)',
};
const sans = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif';
const serif = 'Cormorant Garamond, Georgia, serif';

const labelStyle: React.CSSProperties = {fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.sub, marginBottom: 6, display: 'block'};
const inputStyle: React.CSSProperties = {width: '100%', boxSizing: 'border-box', fontFamily: sans, fontSize: 14, color: C.ink, padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 10, background: '#fff', outline: 'none'};
const btn: React.CSSProperties = {fontFamily: sans, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, cursor: 'pointer'};
const btnGold: React.CSSProperties = {...btn, background: `linear-gradient(90deg, ${C.gold}, ${C.goldDeep})`, color: '#fff', border: 'none'};

function Field({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div style={{marginBottom: 14}}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <div style={{background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, marginBottom: 16}}>
      <div style={{fontFamily: serif, fontSize: 24, color: C.ink, marginBottom: 14}}>{title}</div>
      {children}
    </div>
  );
}

function Text({value, onChange, placeholder}: {value?: string; onChange: (v: string) => void; placeholder?: string}) {
  return <input style={inputStyle} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

// Asset input: paste a URL, or pick a file (preview only, becomes an object URL).
function AssetInput({value, onChange, placeholder}: {value?: string; onChange: (v: string) => void; placeholder?: string}) {
  return (
    <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
      <input style={inputStyle} value={value ?? ''} placeholder={placeholder ?? 'Paste an image URL'} onChange={(e) => onChange(e.target.value)} />
      <label style={{...btn, whiteSpace: 'nowrap'}}>
        Upload
        <input
          type="file"
          accept="image/*"
          style={{display: 'none'}}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onChange(URL.createObjectURL(f));
          }}
        />
      </label>
    </div>
  );
}

export default function StudioPage() {
  const [data, setData] = useState<VideoData>(() => structuredClone(sampleData));
  const [renderUrl, setRenderUrl] = useState<string>(process.env.NEXT_PUBLIC_RENDER_URL ?? '');
  const [status, setStatus] = useState<string>('');
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState('');

  const scenes = useMemo(() => buildScenes(data), [data]);
  const seconds = useMemo(() => (scenes.reduce((a, s) => a + s.durationInFrames, 0) / 30).toFixed(1), [scenes]);

  const set = (patch: Partial<VideoData>) => setData((d) => ({...d, ...patch}));
  const setCreator = (patch: Partial<VideoData['creator']>) => setData((d) => ({...d, creator: {...d.creator, ...patch}}));
  const setIntro = (patch: Partial<VideoData['intro']>) => setData((d) => ({...d, intro: {...d.intro, ...patch}}));
  const setCta = (patch: Partial<VideoData['cta']>) => setData((d) => ({...d, cta: {...d.cta, ...patch}}));
  const setCampaign = (patch: Partial<NonNullable<VideoData['campaign']>>) =>
    setData((d) => ({...d, campaign: {...(d.campaign ?? {title: '', raised: '', goal: '', pct: 0}), ...patch}}));

  const memberships = data.memberships ?? [];
  const marketplace = data.marketplace ?? [];
  const merch = data.merch ?? [];

  const exportMp4 = async () => {
    if (!renderUrl) {
      setStatus('Set a render service URL first (see render-service in the project).');
      return;
    }
    try {
      // Uploaded files become blob: URLs that only exist in this browser, so they
      // cannot be rendered on the server. Strip them (scenes fall back gracefully)
      // and let the user know to use hosted urls instead.
      let stripped = false;
      const clean = JSON.parse(JSON.stringify(data), (_k, v) => {
        if (typeof v === 'string' && v.startsWith('blob:')) {
          stripped = true;
          return undefined;
        }
        return v;
      }) as VideoData;
      setStatus(stripped ? 'Rendering... (uploaded images are preview only and were skipped; use hosted urls for export)' : 'Rendering... this can take a minute.');
      const res = await fetch(renderUrl.replace(/\/$/, '') + '/render', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({data: clean}),
      });
      if (!res.ok) throw new Error('Render failed (' + res.status + ')');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (data.creator.handle || 'spotlightly').replace(/[^a-z0-9]/gi, '') + '.mp4';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Done. Your MP4 downloaded.');
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setStatus('Copied the JSON. Paste it into the local renderer data folder to render there.');
  };

  return (
    <div style={{minHeight: '100vh', background: C.bg, fontFamily: sans, color: C.ink}}>
      <header style={{maxWidth: 1280, margin: '0 auto', padding: '28px 24px 8px', display: 'flex', alignItems: 'baseline', gap: 16}}>
        <div style={{fontFamily: serif, fontSize: 38, fontWeight: 400, letterSpacing: '-0.02em'}}>
          Spot<span style={{color: C.gold}}>light</span>ly
        </div>
        <div style={{fontFamily: sans, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.sub}}>Video Studio</div>
      </header>

      <div style={{maxWidth: 1280, margin: '0 auto', padding: '12px 24px 80px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 28, alignItems: 'start'}}>
        {/* LEFT: controls */}
        <div>
          <div style={{display: 'flex', gap: 10, marginBottom: 16}}>
            <button style={btn} onClick={() => setData(structuredClone(sampleData))}>Load Bella sample</button>
            <button
              style={btn}
              onClick={() =>
                setData({
                  creator: {name: 'Creator Name', handle: '@handle'},
                  intro: {headline: 'One place for your biggest supporters.'},
                  cta: {headline: 'Turn followers into supporters.', url: 'spotlightly.app'},
                })
              }
            >
              Start blank
            </button>
          </div>

          <Section title="Creator">
            <Field label="Name"><Text value={data.creator.name} onChange={(v) => setCreator({name: v})} /></Field>
            <Field label="Handle"><Text value={data.creator.handle} onChange={(v) => setCreator({handle: v})} placeholder="@handle" /></Field>
            <Field label="Tagline (optional)"><Text value={data.creator.tagline} onChange={(v) => setCreator({tagline: v})} /></Field>
            <Field label="Avatar (used if no profile screenshot)"><AssetInput value={data.creator.avatar} onChange={(v) => setCreator({avatar: v})} /></Field>
            <label style={{display: 'flex', alignItems: 'center', gap: 8, fontFamily: sans, fontSize: 14, color: C.ink}}>
              <input type="checkbox" checked={!!data.creator.founding} onChange={(e) => setCreator({founding: e.target.checked})} />
              Founding creator badge
            </label>
          </Section>

          <Section title="Opening and closing">
            <Field label="Intro headline"><Text value={data.intro.headline} onChange={(v) => setIntro({headline: v})} /></Field>
            <Field label="CTA headline"><Text value={data.cta.headline} onChange={(v) => setCta({headline: v})} /></Field>
            <Field label="CTA subline (optional)"><Text value={data.cta.sub} onChange={(v) => setCta({sub: v})} /></Field>
            <Field label="CTA url (optional)"><Text value={data.cta.url} onChange={(v) => setCta({url: v})} /></Field>
          </Section>

          <Section title="Screenshots">
            <Field label="Profile screenshot (the page it pans)"><AssetInput value={data.profileScreenshot} onChange={(v) => set({profileScreenshot: v})} /></Field>
            <Field label="Exclusive posts screenshot (optional, enables that scene)">
              <AssetInput
                value={data.feedScreenshots?.[0]}
                onChange={(v) => set({feedScreenshots: v ? [v] : undefined})}
              />
            </Field>
          </Section>

          <Section title="Memberships">
            {memberships.map((m, i) => (
              <div key={i} style={{display: 'grid', gridTemplateColumns: '1fr 90px 70px auto', gap: 8, marginBottom: 8, alignItems: 'center'}}>
                <input style={inputStyle} value={m.name} placeholder="Tier name" onChange={(e) => updateList(setData, 'memberships', i, {name: e.target.value})} />
                <input style={inputStyle} value={m.price} placeholder="$5" onChange={(e) => updateList(setData, 'memberships', i, {price: e.target.value})} />
                <input style={inputStyle} value={m.cadence ?? 'mo'} placeholder="mo" onChange={(e) => updateList(setData, 'memberships', i, {cadence: e.target.value})} />
                <button style={{...btn, padding: '8px 10px'}} onClick={() => removeFromList(setData, 'memberships', i)}>x</button>
                <input style={{...inputStyle, gridColumn: '1 / -1'}} value={(m.perks ?? []).join(', ')} placeholder="Perks, comma separated" onChange={(e) => updateList(setData, 'memberships', i, {perks: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)})} />
              </div>
            ))}
            <button style={btn} onClick={() => addToList(setData, 'memberships', {name: 'New tier', price: '$5', cadence: 'mo', perks: []} as Membership)}>Add tier</button>
          </Section>

          <Section title="Campaign">
            <Field label="Title"><Text value={data.campaign?.title} onChange={(v) => setCampaign({title: v})} /></Field>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 90px 90px', gap: 8}}>
              <div><label style={labelStyle}>Raised</label><Text value={data.campaign?.raised} onChange={(v) => setCampaign({raised: v})} placeholder="$1,500" /></div>
              <div><label style={labelStyle}>Goal</label><Text value={data.campaign?.goal} onChange={(v) => setCampaign({goal: v})} placeholder="$2,000" /></div>
              <div><label style={labelStyle}>Percent</label><input style={inputStyle} type="number" value={data.campaign?.pct ?? 0} onChange={(e) => setCampaign({pct: Number(e.target.value)})} /></div>
              <div><label style={labelStyle}>Backers</label><input style={inputStyle} type="number" value={data.campaign?.backers ?? 0} onChange={(e) => setCampaign({backers: Number(e.target.value)})} /></div>
            </div>
            <button style={{...btn, marginTop: 10}} onClick={() => set({campaign: undefined})}>Remove campaign scene</button>
          </Section>

          <Section title="Marketplace">
            {marketplace.map((it, i) => (
              <ShopRow key={i} title={it.title} price={it.price} image={it.image}
                onTitle={(v) => updateList(setData, 'marketplace', i, {title: v})}
                onPrice={(v) => updateList(setData, 'marketplace', i, {price: v})}
                onImage={(v) => updateList(setData, 'marketplace', i, {image: v})}
                onRemove={() => removeFromList(setData, 'marketplace', i)} />
            ))}
            <button style={btn} onClick={() => addToList(setData, 'marketplace', {title: 'New item', price: '$10'} as ShopItem)}>Add item</button>
          </Section>

          <Section title="Merch">
            {merch.map((it, i) => (
              <ShopRow key={i} title={it.name} price={it.price} image={it.image}
                onTitle={(v) => updateList(setData, 'merch', i, {name: v})}
                onPrice={(v) => updateList(setData, 'merch', i, {price: v})}
                onImage={(v) => updateList(setData, 'merch', i, {image: v})}
                onRemove={() => removeFromList(setData, 'merch', i)} />
            ))}
            <button style={btn} onClick={() => addToList(setData, 'merch', {name: 'New item', price: '$20'} as MerchItem)}>Add item</button>
          </Section>

          <Section title="Music (optional)">
            <Field label="Music url"><Text value={data.music} onChange={(v) => set({music: v || undefined})} placeholder="https://.../track.mp3" /></Field>
          </Section>

          <div style={{marginTop: 4}}>
            <button style={btn} onClick={() => {setShowJson((s) => !s); setJsonText(JSON.stringify(data, null, 2));}}>
              {showJson ? 'Hide' : 'Show'} raw JSON
            </button>
            {showJson ? (
              <div style={{marginTop: 10}}>
                <textarea style={{...inputStyle, height: 220, fontFamily: 'ui-monospace, monospace', fontSize: 12}} value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
                <button
                  style={{...btn, marginTop: 8}}
                  onClick={() => {
                    try {
                      setData(JSON.parse(jsonText));
                      setStatus('Applied JSON.');
                    } catch {
                      setStatus('That JSON did not parse.');
                    }
                  }}
                >
                  Apply JSON
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* RIGHT: preview + export (sticky) */}
        <div style={{position: 'sticky', top: 20}}>
          <StudioPlayer data={data} />
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontFamily: sans, fontSize: 13, color: C.sub}}>
            <span>{scenes.length} scenes</span>
            <span>{seconds}s . 1080 x 1920 . 30fps</span>
          </div>

          <div style={{background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginTop: 16}}>
            <div style={{fontFamily: serif, fontSize: 22, marginBottom: 10}}>Export</div>
            <Field label="Render service url">
              <Text value={renderUrl} onChange={setRenderUrl} placeholder="https://your-render-service" />
            </Field>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              <button style={btnGold} onClick={exportMp4}>Export MP4</button>
              <button style={btn} onClick={copyJson}>Copy JSON</button>
            </div>
            {status ? <div style={{marginTop: 10, fontFamily: sans, fontSize: 13, color: C.sub}}>{status}</div> : null}
            <div style={{marginTop: 12, fontFamily: sans, fontSize: 12, color: C.sub, lineHeight: 1.6}}>
              Preview works from any computer with no setup. To produce the MP4, deploy the included
              render service (see its README) and paste its url above. For export, screenshots must be
              real hosted urls (uploaded files are preview only).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShopRow({title, price, image, onTitle, onPrice, onImage, onRemove}: {title: string; price: string; image?: string; onTitle: (v: string) => void; onPrice: (v: string) => void; onImage: (v: string) => void; onRemove: () => void}) {
  return (
    <div style={{display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: 8, marginBottom: 8, alignItems: 'center'}}>
      <input style={inputStyle} value={title} placeholder="Name" onChange={(e) => onTitle(e.target.value)} />
      <input style={inputStyle} value={price} placeholder="$10" onChange={(e) => onPrice(e.target.value)} />
      <button style={{...btn, padding: '8px 10px'}} onClick={onRemove}>x</button>
      <div style={{gridColumn: '1 / -1'}}><AssetInput value={image} onChange={onImage} placeholder="Image url (optional)" /></div>
    </div>
  );
}

// Generic list helpers ------------------------------------------------------
type ListKey = 'memberships' | 'marketplace' | 'merch';
function updateList(setData: React.Dispatch<React.SetStateAction<VideoData>>, key: ListKey, idx: number, patch: Record<string, unknown>) {
  setData((d) => {
    const list = [...((d[key] as unknown[]) ?? [])];
    list[idx] = {...(list[idx] as object), ...patch};
    return {...d, [key]: list} as VideoData;
  });
}
function addToList(setData: React.Dispatch<React.SetStateAction<VideoData>>, key: ListKey, item: unknown) {
  setData((d) => ({...d, [key]: [...((d[key] as unknown[]) ?? []), item]} as VideoData));
}
function removeFromList(setData: React.Dispatch<React.SetStateAction<VideoData>>, key: ListKey, idx: number) {
  setData((d) => ({...d, [key]: ((d[key] as unknown[]) ?? []).filter((_, i) => i !== idx)} as VideoData));
}
