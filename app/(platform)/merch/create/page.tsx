"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const FONTS = [
  { id: "Bebas Neue",       label: "Bebas Neue",        url: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" },
  { id: "Pacifico",         label: "Pacifico",           url: "https://fonts.googleapis.com/css2?family=Pacifico&display=swap" },
  { id: "Anton",            label: "Anton",              url: "https://fonts.googleapis.com/css2?family=Anton&display=swap" },
  { id: "Permanent Marker", label: "Permanent Marker",   url: "https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap" },
  { id: "Righteous",        label: "Righteous",          url: "https://fonts.googleapis.com/css2?family=Righteous&display=swap" },
  { id: "Press Start 2P",   label: "Press Start 2P",     url: "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" },
  { id: "Dancing Script",   label: "Dancing Script",     url: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" },
  { id: "Bangers",          label: "Bangers",            url: "https://fonts.googleapis.com/css2?family=Bangers&display=swap" },
];

const PRODUCTS = [
  { id: "tshirt",  label: "T-Shirt",  emoji: "👕" },
  { id: "hoodie",  label: "Hoodie",   emoji: "🧥" },
  { id: "mug",     label: "Mug",      emoji: "☕" },
  { id: "tote",    label: "Tote",     emoji: "👜" },
  { id: "hat",     label: "Hat",      emoji: "🧢" },
  { id: "poster",  label: "Poster",   emoji: "🖼️" },
];

const PRODUCT_COLORS = [
  "#ffffff","#000000","#1a1a2e","#2a2a2a","#c8b89a","#e63946",
  "#457b9d","#2d6a4f","#f4a261","#7b2d8b","#f0b429","#f5f5f0",
];

const SWATCHES = [
  "#F0B429","#E63946","#ffffff","#000000","#34D399","#C084FC",
  "#3B82F6","#F97316","#EC4899","#A3E635","#FF6B6B","#4ECDC4",
];

export default function MerchCreatePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("YOUR TEXT");
  const [font, setFont] = useState("Bebas Neue");
  const [fontSize, setFontSize] = useState(120);
  const [letterColors, setLetterColors] = useState<string[]>([]);
  const [globalColor, setGlobalColor] = useState("#F0B429");
  const [usePerLetter, setUsePerLetter] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<number | null>(null);
  const [productType, setProductType] = useState("tshirt");
  const [productBg, setProductBg] = useState("#ffffff");
  const [imageData, setImageData] = useState<string | null>(null);
  const [productName, setProductName] = useState("Custom Merch");
  const [price, setPrice] = useState("29.99");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load Google Fonts
  useEffect(() => {
    FONTS.forEach(f => {
      if (!document.querySelector(`link[href="${f.url}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet"; link.href = f.url;
        document.head.appendChild(link);
      }
    });
  }, []);

  // Sync letter colors
  useEffect(() => {
    setLetterColors(prev => {
      const chars = text.split("");
      const next = chars.map((_, i) => prev[i] ?? globalColor);
      return next;
    });
  }, [text.length]);

  // Render design to canvas
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1200, H = 1200;
    canvas.width = W; canvas.height = H;

    // Transparent background (design only, no product color)
    ctx.clearRect(0, 0, W, H);

    if (mode === "image" && imageData) {
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min((W * 0.8) / img.width, (H * 0.8) / img.height);
          const iw = img.width * scale;
          const ih = img.height * scale;
          ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
          resolve();
        };
        img.src = imageData;
      });
    } else if (mode === "text" && text.trim()) {
      await document.fonts.ready;
      const fontStr = `bold ${fontSize}px '${font}', sans-serif`;
      ctx.font = fontStr;
      ctx.textBaseline = "middle";

      if (usePerLetter) {
        // Measure total width for centering
        const widths = text.split("").map(c => ctx.measureText(c).width);
        const total = widths.reduce((a, b) => a + b, 0);
        let x = (W - total) / 2;
        text.split("").forEach((char, i) => {
          ctx.fillStyle = letterColors[i] ?? globalColor;
          ctx.fillText(char, x, H / 2);
          x += widths[i];
        });
      } else {
        ctx.textAlign = "center";
        ctx.fillStyle = globalColor;
        ctx.fillText(text, W / 2, H / 2);
      }
    }
  }, [mode, text, font, fontSize, globalColor, letterColors, usePerLetter, imageData]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImageData(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function randomizeColors() {
    const palette = ["#F0B429","#E63946","#ffffff","#34D399","#C084FC","#3B82F6","#F97316","#EC4899","#A3E635","#FF6B6B"];
    setLetterColors(text.split("").map(() => palette[Math.floor(Math.random() * palette.length)]));
    setUsePerLetter(true);
  }

  function setLetterColor(i: number, color: string) {
    setLetterColors(prev => { const n = [...prev]; n[i] = color; return n; });
  }

  async function save() {
    setErr(null);
    if (!canvasRef.current) return;
    setSaving(true);

    // Export canvas to blob
    const blob = await new Promise<Blob | null>(res => canvasRef.current!.toBlob(res, "image/png"));
    if (!blob) { setErr("Could not export design"); setSaving(false); return; }

    // Upload design to BunnyCDN
    const fd = new FormData();
    fd.append("file", blob, "design.png");
    const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
    const uploadData = await uploadRes.json();

    if (!uploadData.url) {
      setErr(uploadData.error ?? "Upload failed — check BunnyCDN is configured");
      setSaving(false);
      return;
    }

    // Create product
    const createRes = await fetch("/api/merch/create-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designUrl: uploadData.url,
        productType,
        name: productName,
        price,
        productColor: productBg,
      }),
    });

    const createData = await createRes.json();
    if (!createData.ok) {
      setErr(createData.error ?? "Could not create product");
      setSaving(false);
      return;
    }

    router.push("/merch?created=1");
  }

  // Preview: canvas preview scaled down
  const previewText = mode === "text" ? text : null;
  const previewImage = mode === "image" ? imageData : null;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", color:"var(--text)", fontFamily:"var(--font-sans)" }}>
      <style>{`:root{--accent:#F0B429;--surface:#111115;--border:rgba(255,255,255,.07);--muted:#71717A;}`}</style>

      {/* Header */}
      <header style={{ borderBottom:"1px solid var(--border)", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10, background:"var(--bg)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Link href="/" style={{ fontFamily:"var(--font-serif)", fontSize:20, color:"var(--text)", textDecoration:"none" }}>
            Spot<span style={{ color:"var(--accent)" }}>light</span>ly
          </Link>
          <span style={{ color:"var(--muted)", fontSize:13 }}>/ Loudcap Designer</span>
        </div>
        <Link href="/merch" style={{ fontFamily:"monospace", fontSize:10, letterSpacing:".15em", textTransform:"uppercase", color:"var(--muted)", textDecoration:"none" }}>← Back to Merch</Link>
      </header>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} style={{ display:"none" }} />

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px 80px", display:"grid", gridTemplateColumns:"1fr 340px", gap:16, alignItems:"start" }}>

        {/* LEFT — Controls */}
        <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
          <div style={{ padding:"20px 0 8px" }}>
            <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".2em", textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>Loudcap Merch Designer</p>
            <h1 style={{ fontFamily:"var(--font-serif)", fontSize:32, fontWeight:300, color:"var(--text)" }}>Design your <em style={{ color:"var(--accent)" }}>product.</em></h1>
          </div>

          {/* Mode */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:16 }}>
            <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)", marginBottom:10 }}>Design type</p>
            <div style={{ display:"flex", gap:3 }}>
              {(["text","image"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:"10px", borderRadius:8, border:"1px solid", cursor:"pointer", fontSize:13, fontWeight:700,
                  background: mode===m ? "rgba(240,180,41,0.1)" : "transparent",
                  color: mode===m ? "var(--accent)" : "var(--muted)",
                  borderColor: mode===m ? "rgba(240,180,41,0.3)" : "var(--border)" }}>
                  {m === "text" ? "✏️ Text" : "🖼️ Image"}
                </button>
              ))}
            </div>
          </div>

          {/* Text controls */}
          {mode === "text" && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:20, display:"flex", flexDirection:"column", gap:18 }}>
              <div>
                <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)", marginBottom:8 }}>Your text</p>
                <input type="text" value={text} onChange={e => setText(e.target.value.toUpperCase())} maxLength={24}
                  style={{ width:"100%", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:6, padding:"12px 16px", color:"var(--text)", fontSize:18, fontWeight:700, outline:"none", fontFamily:"var(--font-mono)", letterSpacing:".05em" }} />
              </div>

              <div>
                <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)", marginBottom:10 }}>Font</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {FONTS.map(f => (
                    <button key={f.id} onClick={() => setFont(f.id)} style={{ padding:"10px 12px", borderRadius:8, border:"1px solid", cursor:"pointer", textAlign:"left",
                      background: font===f.id ? "rgba(240,180,41,0.1)" : "rgba(255,255,255,0.03)",
                      borderColor: font===f.id ? "rgba(240,180,41,0.3)" : "var(--border)",
                      fontFamily: `'${f.id}', cursive`, fontSize:15, color: font===f.id ? "var(--accent)" : "#F2F2F0" }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)", marginBottom:8 }}>Size — {fontSize}px</p>
                <input type="range" min={40} max={240} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width:"100%", accentColor:"var(--accent)" }} />
              </div>

              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)" }}>Colors</p>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => setUsePerLetter(!usePerLetter)} style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".1em", textTransform:"uppercase", padding:"4px 10px", borderRadius:99, border:"1px solid", cursor:"pointer",
                      background: usePerLetter ? "rgba(240,180,41,0.1)" : "transparent",
                      color: usePerLetter ? "var(--accent)" : "var(--muted)",
                      borderColor: usePerLetter ? "rgba(240,180,41,0.3)" : "var(--border)" }}>
                      Per letter
                    </button>
                    <button onClick={randomizeColors} style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".1em", textTransform:"uppercase", padding:"4px 10px", borderRadius:99, border:"1px solid var(--border)", background:"transparent", color:"var(--muted)", cursor:"pointer" }}>
                      🎲 Random
                    </button>
                  </div>
                </div>

                {!usePerLetter ? (
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <input type="color" value={globalColor} onChange={e => { setGlobalColor(e.target.value); setLetterColors(text.split("").map(() => e.target.value)); }}
                      style={{ width:48, height:48, border:"2px solid rgba(255,255,255,0.1)", borderRadius:8, cursor:"pointer", background:"none" }} />
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {SWATCHES.map(c => (
                        <button key={c} onClick={() => { setGlobalColor(c); setLetterColors(text.split("").map(() => c)); }} style={{ width:28, height:28, borderRadius:"50%", background:c, border: globalColor===c ? "3px solid #fff" : "2px solid rgba(255,255,255,0.1)", cursor:"pointer" }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize:12, color:"var(--muted)", marginBottom:10 }}>Tap a letter to change its color</p>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
                      {text.split("").map((char, i) => (
                        <button key={i} onClick={() => setSelectedLetter(selectedLetter===i ? null : i)} style={{ width:38, height:38, borderRadius:6, border:"2px solid",
                          borderColor: selectedLetter===i ? "#fff" : "rgba(255,255,255,0.1)",
                          background:"rgba(255,255,255,0.04)", cursor:"pointer",
                          fontFamily:`'${font}',cursive`, fontSize:17, color: letterColors[i] ?? globalColor,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {char === " " ? "·" : char}
                        </button>
                      ))}
                    </div>
                    {selectedLetter !== null && (
                      <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:12 }}>
                        <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".15em", textTransform:"uppercase", color:"var(--muted)", marginBottom:8 }}>Color for "{text[selectedLetter]}"</p>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <input type="color" value={letterColors[selectedLetter] ?? globalColor} onChange={e => setLetterColor(selectedLetter, e.target.value)}
                            style={{ width:44, height:44, border:"2px solid rgba(255,255,255,0.1)", borderRadius:6, cursor:"pointer", background:"none" }} />
                          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                            {SWATCHES.map(c => (
                              <button key={c} onClick={() => setLetterColor(selectedLetter, c)} style={{ width:26, height:26, borderRadius:"50%", background:c, border: letterColors[selectedLetter]===c ? "3px solid #fff" : "2px solid rgba(255,255,255,0.1)", cursor:"pointer" }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Image controls */}
          {mode === "image" && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:20 }}>
              <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)", marginBottom:12 }}>Upload your design</p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display:"none" }} onChange={handleImageUpload} />
              <button onClick={() => fileRef.current?.click()} style={{ width:"100%", padding:"24px", borderRadius:8, border:"2px dashed rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.02)", color:"var(--muted)", cursor:"pointer", fontSize:14 }}>
                {imageData ? "✓ Image loaded — click to change" : "Click to upload PNG, JPG, or SVG"}
              </button>
              <p style={{ fontSize:12, color:"var(--muted)", marginTop:10, lineHeight:1.6 }}>Best results with PNG on a transparent background. Square images work best on any product.</p>
            </div>
          )}
        </div>

        {/* RIGHT — Preview + Save */}
        <div style={{ display:"flex", flexDirection:"column", gap:3, position:"sticky", top:80 }}>

          {/* Product picker */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:16 }}>
            <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)", marginBottom:10 }}>Product</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4, marginBottom:14 }}>
              {PRODUCTS.map(p => (
                <button key={p.id} onClick={() => setProductType(p.id)} style={{ padding:"8px 4px", borderRadius:8, border:"1px solid", cursor:"pointer", fontSize:11, textAlign:"center",
                  background: productType===p.id ? "rgba(240,180,41,0.1)" : "rgba(255,255,255,0.03)",
                  borderColor: productType===p.id ? "rgba(240,180,41,0.3)" : "var(--border)",
                  color: productType===p.id ? "var(--accent)" : "var(--muted)" }}>
                  <div style={{ fontSize:18, marginBottom:2 }}>{p.emoji}</div>
                  {p.label}
                </button>
              ))}
            </div>
            <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)", marginBottom:8 }}>Product color</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {PRODUCT_COLORS.map(c => (
                <button key={c} onClick={() => setProductBg(c)} style={{ width:24, height:24, borderRadius:5, background:c, border: productBg===c ? "3px solid var(--accent)" : "2px solid rgba(255,255,255,0.1)", cursor:"pointer" }} />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:16 }}>
            <p style={{ fontFamily:"monospace", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)", marginBottom:12 }}>Preview</p>
            <div style={{ background:"var(--bg-elevated)", borderRadius:8, padding:24, display:"flex", alignItems:"center", justifyContent:"center", minHeight:220 }}>
              {/* Simple mockup preview */}
              <div style={{ position:"relative", width:160, height:160 }}>
                {/* Product silhouette */}
                <div style={{ position:"absolute", inset:0, background:productBg, borderRadius:productType==="mug"?4:productType==="poster"?2:0,
                  clipPath:productType==="tshirt"||productType==="hoodie" ? "polygon(25% 0%, 75% 0%, 85% 12%, 100% 8%, 100% 100%, 0% 100%, 0% 8%, 15% 12%)" :
                    productType==="tote" ? "polygon(20% 0%, 80% 0%, 95% 100%, 5% 100%)" : "none",
                  boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }} />
                {/* Design overlay */}
                <div style={{ position:"absolute", inset:"25%", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                  {previewImage ? (
                    <img src={previewImage} alt="" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }} />
                  ) : previewText ? (
                    <div style={{ textAlign:"center", lineHeight:1, overflow:"hidden" }}>
                      {usePerLetter ? previewText.split("").map((c, i) => (
                        <span key={i} style={{ fontFamily:`'${font}',cursive`, fontSize:18, color:letterColors[i]??globalColor }}>{c==" "?" ":c}</span>
                      )) : (
                        <span style={{ fontFamily:`'${font}',cursive`, fontSize:18, color:globalColor }}>{previewText}</span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <p style={{ fontSize:11, color:"var(--muted)", marginTop:8, textAlign:"center" }}>
              {PRODUCTS.find(p => p.id === productType)?.emoji} {PRODUCTS.find(p => p.id === productType)?.label} preview
            </p>
          </div>

          {/* Save */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:16, display:"flex", flexDirection:"column", gap:10 }}>
            <div>
              <label style={{ display:"block", fontFamily:"monospace", fontSize:9, letterSpacing:".15em", textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>Product name</label>
              <input type="text" value={productName} onChange={e => setProductName(e.target.value)}
                style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#F2F2F0", fontSize:13, outline:"none" }} />
            </div>
            <div>
              <label style={{ display:"block", fontFamily:"monospace", fontSize:9, letterSpacing:".15em", textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>Retail price</label>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:"var(--muted)" }}>$</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="9.99" step="0.01"
                  style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#F2F2F0", fontSize:13, outline:"none" }} />
              </div>
              <p style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>
                You earn ~${(parseFloat(price||"0") * 0.9 - 12.95).toFixed(2)} per sale after Loudcap fulfillment
              </p>
            </div>
            {err && <p style={{ fontSize:12, color:"#F87171" }}>{err}</p>}
            <button onClick={save} disabled={saving} style={{ width:"100%", background:"var(--accent)", color:"#09090C", fontFamily:"var(--font-mono)", fontWeight:500, fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", padding:"14px 0", borderRadius:4, border:"none", cursor:"pointer", opacity:saving?0.45:1 }}>
              {saving ? "Saving to Loudcap…" : "Save to merch page →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
