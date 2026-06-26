"use client";
import { useState } from "react";
import { type StudioPayload } from "@/components/StudioSetup";
import PageBuilderQA from "@/components/PageBuilderQA";
import AdminCampaignBuilder from "@/components/AdminCampaignBuilder";
import ImageUpload from "@/components/ImageUpload";

type Creator = {
  id: string; handle: string; display_name: string; bio: string | null;
  avatar_url: string | null; cover_url: string | null; subscription_price: number | null; published: boolean;
  social_links: Record<string, string> | null;
  wishlist_url: string | null;
  claim_code: string | null;
  claimed_at: string | null;
  free_tier_name: string | null;
  free_tier_blurb: string | null;
  free_tier_perks: string[] | null;
};
type Post = { id: string; caption: string | null; media_url: string | null; media_type: string | null; created_at: string };
type Pick = { id: string; label: string; url: string | null; image_url: string | null; note: string | null };
type SocialPost = { id: string; url: string; platform: string };
type Tier = { id: string; name: string; description: string | null; price_monthly: number; price_yearly: number | null; perks: string[] | null };

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Upload failed");
  return data.url as string;
}

export default function BuildClient({ creator, initialPosts, initialPicks, initialSocialPosts, initialTiers }: { creator: Creator; initialPosts: Post[]; initialPicks: Pick[]; initialSocialPosts: SocialPost[]; initialTiers: Tier[] }) {
  const [displayName, setDisplayName] = useState(creator.display_name || "");
  const [bio, setBio] = useState(creator.bio || "");
  const [freeTierName, setFreeTierName] = useState(creator.free_tier_name || "");
  const [freeTierBlurb, setFreeTierBlurb] = useState(creator.free_tier_blurb || "");
  const [freeTierPerks, setFreeTierPerks] = useState((creator.free_tier_perks || []).join("\n"));
  const [price, setPrice] = useState(creator.subscription_price != null ? String(creator.subscription_price) : "");
  const [avatar, setAvatar] = useState(creator.avatar_url || "");
  const [cover, setCover] = useState(creator.cover_url || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [caption, setCaption] = useState("");
  const [postMedia, setPostMedia] = useState("");
  const [postMediaType, setPostMediaType] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [addingPost, setAddingPost] = useState(false);
  const [postMsg, setPostMsg] = useState("");
  const [busyUpload, setBusyUpload] = useState("");

  const [picks, setPicks] = useState<Pick[]>(initialPicks);
  const [pickUrl, setPickUrl] = useState("");
  const [pickLabel, setPickLabel] = useState("");
  const [pickImage, setPickImage] = useState("");
  const [pickNote, setPickNote] = useState("");
  const [addingPick, setAddingPick] = useState(false);
  const [pickMsg, setPickMsg] = useState("");

  const [links, setLinks] = useState<Record<string, string>>(() => {
    const raw = ((creator.social_links as any) || {}) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!v) continue;
      out[k.startsWith("social_") ? k : `social_${k}`] = String(v);
    }
    return out;
  });
  const [savingLinks, setSavingLinks] = useState(false);
  const [linksMsg, setLinksMsg] = useState("");

  const [socialPosts, setSocialPosts] = useState<SocialPost[]>(initialSocialPosts);
  const [socialUrl, setSocialUrl] = useState("");
  const [addingSocial, setAddingSocial] = useState(false);
  const [socialMsg, setSocialMsg] = useState("");

  const [wishlistUrl, setWishlistUrl] = useState(creator.wishlist_url || "");

  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [tierName, setTierName] = useState("");
  const [tierDesc, setTierDesc] = useState("");
  const [tierMonthly, setTierMonthly] = useState("");
  const [tierYearly, setTierYearly] = useState("");
  const [tierPerks, setTierPerks] = useState("");
  const [editTierId, setEditTierId] = useState<string | null>(null);
  const [addingTier, setAddingTier] = useState(false);
  const [tierMsg, setTierMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);

  async function adminStudioCommit(payload: StudioPayload): Promise<string | null> {
    const res = await fetch("/api/admin/studio/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorProfileId: creator.id, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) return data?.error || "Couldn't build the page. Try again.";
    return null;
  }

  async function onUpload(file: File | undefined, target: "avatar" | "cover" | "post" | "pick") {
    if (!file) return;
    setBusyUpload(target);
    try {
      const url = await uploadFile(file);
      if (target === "avatar") setAvatar(url);
      else if (target === "cover") setCover(url);
      else if (target === "pick") setPickImage(url);
      else { setPostMedia(url); setPostMediaType(file.type.startsWith("video") ? "video" : "image"); }
    } catch (e: any) { alert(e.message || "Upload failed"); }
    setBusyUpload("");
  }

  async function saveProfile() {
    setSavingProfile(true); setProfileMsg("");
    try {
      const res = await fetch("/api/admin/creators/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: creator.id, display_name: displayName, bio, avatar_url: avatar, cover_url: cover, subscription_price: price, wishlist_url: wishlistUrl, free_tier_name: freeTierName, free_tier_blurb: freeTierBlurb, free_tier_perks: freeTierPerks.split("\n").map((s) => s.trim()).filter(Boolean) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setProfileMsg("Saved.");
    } catch (e: any) { setProfileMsg(e.message || "Save failed"); }
    setSavingProfile(false);
  }

  async function addPost() {
    setAddingPost(true); setPostMsg("");
    try {
      const res = await fetch("/api/admin/creators/post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_profile_id: creator.id, caption, media_url: postMedia, media_type: postMediaType, locked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Add failed");
      setPosts([{ id: data.id, caption: caption || null, media_url: postMedia || null, media_type: postMediaType, created_at: new Date().toISOString() }, ...posts]);
      setCaption(""); setPostMedia(""); setPostMediaType(null); setLocked(false);
      setPostMsg("Post added.");
    } catch (e: any) { setPostMsg(e.message || "Add failed"); }
    setAddingPost(false);
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/admin/creators/post?id=${id}`, { method: "DELETE" });
    if (res.ok) setPosts(posts.filter((p) => p.id !== id));
  }

  async function addPick() {
    setAddingPick(true); setPickMsg("");
    try {
      const res = await fetch("/api/admin/creators/pick", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_profile_id: creator.id, url: pickUrl, label: pickLabel, image_url: pickImage, note: pickNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Add failed");
      setPicks([...picks, data.pick]);
      setPickUrl(""); setPickLabel(""); setPickImage(""); setPickNote("");
      setPickMsg("Added.");
    } catch (e: any) { setPickMsg(e.message || "Add failed"); }
    setAddingPick(false);
  }

  async function deletePick(id: string) {
    if (!confirm("Remove this pick?")) return;
    const res = await fetch(`/api/admin/creators/pick?id=${id}`, { method: "DELETE" });
    if (res.ok) setPicks(picks.filter((p) => p.id !== id));
  }

  async function saveLinks() {
    setSavingLinks(true); setLinksMsg("");
    try {
      const res = await fetch("/api/admin/creators/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: creator.id, social_links: links }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error || "Save failed"); }
      setLinksMsg("Saved.");
    } catch (e: any) { setLinksMsg(e.message || "Save failed"); }
    setSavingLinks(false);
  }

  async function addSocial() {
    setAddingSocial(true); setSocialMsg("");
    try {
      const res = await fetch("/api/admin/creators/social-post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_profile_id: creator.id, url: socialUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Add failed");
      setSocialPosts([data.post, ...socialPosts]);
      setSocialUrl("");
      setSocialMsg("Added.");
    } catch (e: any) { setSocialMsg(e.message || "Add failed"); }
    setAddingSocial(false);
  }

  async function deleteSocial(id: string) {
    if (!confirm("Remove this post?")) return;
    const res = await fetch(`/api/admin/creators/social-post?id=${id}`, { method: "DELETE" });
    if (res.ok) setSocialPosts(socialPosts.filter((sp) => sp.id !== id));
  }

  function resetTierForm() {
    setEditTierId(null);
    setTierName(""); setTierDesc(""); setTierMonthly(""); setTierYearly(""); setTierPerks("");
  }

  function startEditTier(t: Tier) {
    setEditTierId(t.id);
    setTierName(t.name ?? "");
    setTierDesc(t.description ?? "");
    setTierMonthly(t.price_monthly != null ? String(t.price_monthly) : "");
    setTierYearly(t.price_yearly != null ? String(t.price_yearly) : "");
    setTierPerks((t.perks ?? []).join("\n"));
    setTierMsg("");
  }

  async function addTier() {
    setAddingTier(true); setTierMsg("");
    try {
      const editing = !!editTierId;
      const perks = tierPerks.split("\n").map((p) => p.trim()).filter(Boolean);
      const res = await fetch("/api/admin/creators/tier", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing
          ? { id: editTierId, name: tierName, description: tierDesc, price_monthly: tierMonthly, price_yearly: tierYearly, perks }
          : { creator_profile_id: creator.id, name: tierName, description: tierDesc, price_monthly: tierMonthly, price_yearly: tierYearly, perks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      if (editing) {
        setTiers(tiers.map((t) => (t.id === editTierId ? data.tier : t)));
        setTierMsg("Saved.");
      } else {
        setTiers([...tiers, data.tier]);
        setTierMsg("Added.");
      }
      resetTierForm();
    } catch (e: any) { setTierMsg(e.message || "Save failed"); }
    setAddingTier(false);
  }

  async function deleteTier(id: string) {
    if (!confirm("Remove this tier?")) return;
    const res = await fetch(`/api/admin/creators/tier?id=${id}`, { method: "DELETE" });
    if (res.ok) setTiers(tiers.filter((t) => t.id !== id));
  }

  const claimLink = creator.claim_code ? `https://www.spotlightly.app/claim/${creator.claim_code}` : "";
  const previewLink = `https://www.spotlightly.app/${creator.handle}`;
  async function copyClaim() {
    try { await navigator.clipboard.writeText(claimLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }
  async function copyPreview() {
    try { await navigator.clipboard.writeText(previewLink); setCopiedPreview(true); setTimeout(() => setCopiedPreview(false), 1500); } catch {}
  }

  const label: React.CSSProperties = { fontSize: 12, color: "var(--muted, #888)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div className="adm-page" style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <h1 className="adm-page-title" style={{ margin: 0 }}>Build @{creator.handle}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`/admin/creators/${creator.id}`} className="adm-btn adm-btn--ghost">Account details</a>
          <a href={`/${creator.handle}`} target="_blank" className="adm-btn adm-btn--ghost">Preview</a>
          <a href="/admin/creators" className="adm-btn adm-btn--ghost">Back</a>
        </div>
      </div>
      <p className="adm-page-lede" style={{ marginBottom: 24 }}>
        Edit the page on their behalf. {creator.published ? "This page is live." : "This page is in preview (not in Explore)."}
      </p>

      {studioOpen && (
        <PageBuilderQA
          displayName={creator.display_name}
          handle={creator.handle}
          onCommit={adminStudioCommit}
          onClose={() => setStudioOpen(false)}
          onDone={() => { setStudioOpen(false); window.location.reload(); }}
        />
      )}

      {campaignOpen && (
        <AdminCampaignBuilder
          creatorProfileId={creator.id}
          displayName={creator.display_name}
          handle={creator.handle}
          onClose={() => setCampaignOpen(false)}
          onDone={() => { setCampaignOpen(false); window.location.reload(); }}
        />
      )}

      <div style={{ marginBottom: 24, background: "linear-gradient(180deg, rgba(240,180,41,0.10), rgba(240,180,41,0.03))", border: "1px solid var(--accent-border, rgba(240,180,41,0.25))", borderRadius: 12, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--accent, #f0b429)", marginBottom: 6 }}>Build everything</div>
          <div style={{ fontSize: 17, color: "#fff", marginBottom: 2 }}>Build this creator&apos;s whole page</div>
          <div style={{ fontSize: 13, color: "var(--muted, #888)", maxWidth: 470 }}>A few quick questions, then a recommendation, a preview, and your approval. Sets up their bio, free tier, and paid tiers, and a campaign only when it actually makes sense.</div>
        </div>
        <button className="adm-btn adm-btn--primary" style={{ flexShrink: 0 }} onClick={() => setStudioOpen(true)}>✨ Interview and build</button>
      </div>

      <div style={{ marginBottom: 24, border: "1px solid var(--border, rgba(255,255,255,0.1))", borderRadius: 12, padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted, #888)", marginBottom: 6 }}>Just a campaign</div>
          <div style={{ fontSize: 16, color: "#fff", marginBottom: 2 }}>Add a campaign</div>
          <div style={{ fontSize: 13, color: "var(--muted, #888)", maxWidth: 470 }}>For creators who already have a page. Answer a few questions and let the assistant draft it, or enter what they already have.</div>
        </div>
        <button className="adm-btn adm-btn--ghost" style={{ flexShrink: 0 }} onClick={() => setCampaignOpen(true)}>+ Add a campaign</button>
      </div>

      {!creator.claimed_at && creator.claim_code ? (
        <div className="adm-banner adm-banner--ok" style={{ marginBottom: 24, lineHeight: 1.7 }}>
          <strong style={{ display: "block", marginBottom: 10 }}>Two links to send them</strong>

          <div style={{ fontSize: 12, color: "var(--muted, #888)", marginBottom: 4 }}>1. Their page, to preview</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <code style={{ wordBreak: "break-all", flex: 1, minWidth: 220 }}>{previewLink}</code>
            <button className="adm-btn adm-btn--ghost" style={{ padding: "5px 14px" }} onClick={copyPreview}>{copiedPreview ? "Copied" : "Copy"}</button>
          </div>

          <div style={{ fontSize: 12, color: "var(--muted, #888)", marginBottom: 4 }}>2. Claim link, sets their own login</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ wordBreak: "break-all", flex: 1, minWidth: 220 }}>{claimLink}</code>
            <button className="adm-btn adm-btn--primary" style={{ padding: "5px 14px" }} onClick={copyClaim}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted, #888)", marginTop: 8 }}>
            Send the preview first so they see their page, then the claim link. The claim link is single use and works until claimed.
          </div>
        </div>
      ) : creator.claimed_at ? (
        <div style={{ marginBottom: 24, fontSize: 13, color: "var(--accent-open, #6ee7b7)" }}>
          ✓ Claimed by the creator. They own this account now.
        </div>
      ) : null}

      {/* PROFILE */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Profile</h2>
        <label style={label}>Display name</label>
        <input className="adm-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ marginBottom: 14, width: "100%" }} />
        <label style={label}>Bio</label>
        <textarea className="adm-input" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} style={{ marginBottom: 14, width: "100%", resize: "vertical" }} />
        <label style={label}>Monthly subscription price (USD)</label>
        <input className="adm-input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} style={{ marginBottom: 6, width: 200 }} />
        <p style={{ fontSize: 12, color: "var(--muted, #888)", marginBottom: 16, lineHeight: 1.5 }}>
          The simple subscribe price on their page. Named upgrade tiers (with perks) live in the Subscription tiers section below.
        </p>

        <label style={label}>Amazon wishlist link (optional)</label>
        <input className="adm-input" value={wishlistUrl} onChange={(e) => setWishlistUrl(e.target.value)} placeholder="https://www.amazon.com/hz/wishlist/ls/..." style={{ marginBottom: 14, width: "100%" }} />

        <label style={label}>Free tier name</label>
        <input className="adm-input" value={freeTierName} onChange={(e) => setFreeTierName(e.target.value)} placeholder="General Admission" style={{ marginBottom: 14, width: "100%" }} />
        <label style={label}>Free tier description</label>
        <textarea className="adm-input" value={freeTierBlurb} onChange={(e) => setFreeTierBlurb(e.target.value)} rows={2} placeholder="Follow along for free and never miss a post." style={{ marginBottom: 14, width: "100%", resize: "vertical" }} />
        <label style={label}>What they get for free (one per line)</label>
        <textarea className="adm-input" value={freeTierPerks} onChange={(e) => setFreeTierPerks(e.target.value)} rows={4} placeholder={"Every free post\nLive stream notifications\nComment on posts"} style={{ marginBottom: 14, width: "100%", resize: "vertical" }} />

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <label style={label}>Avatar</label>
            <ImageUpload value={avatar} onChange={setAvatar} shape="circle" label="Upload avatar" hint="Square, 400px or larger" minWidth={400} minHeight={400} previewWidth={72} previewHeight={72} />
          </div>
          <div>
            <label style={label}>Cover</label>
            <ImageUpload value={cover} onChange={setCover} shape="rect" label="Upload cover" hint="1600px wide or larger keeps it crisp" minWidth={1600} minHeight={400} previewWidth={160} previewHeight={72} />
          </div>
        </div>

        <button className="adm-btn adm-btn--primary" onClick={saveProfile} disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
        {profileMsg && <span style={{ marginLeft: 12, fontSize: 13 }}>{profileMsg}</span>}
      </div>

      {/* TIERS */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Subscription tiers</h2>
        <p style={{ fontSize: 12, color: "var(--muted, #888)", marginBottom: 14, lineHeight: 1.6 }}>
          Optional upgrade tiers, the same editor the creator gets. The simple subscribe price is up in Profile, these are named tiers fans can pick instead. Each has a description, price, optional yearly, and perks.
        </p>
        <input className="adm-input" value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="Tier name (e.g. VIP)" style={{ width: "100%", marginBottom: 10 }} />
        <input className="adm-input" value={tierDesc} onChange={(e) => setTierDesc(e.target.value)} placeholder={'Description (optional), e.g. "For fans who want exclusive access"'} style={{ width: "100%", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <input className="adm-input" type="number" min="0" step="0.01" value={tierMonthly} onChange={(e) => setTierMonthly(e.target.value)} placeholder="Monthly $" style={{ width: 130 }} />
          <input className="adm-input" type="number" min="0" step="0.01" value={tierYearly} onChange={(e) => setTierYearly(e.target.value)} placeholder="Yearly $ (optional)" style={{ width: 180 }} />
        </div>
        <label style={{ fontSize: 11, color: "var(--muted, #888)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Perks (one per line)</label>
        <textarea className="adm-input" value={tierPerks} onChange={(e) => setTierPerks(e.target.value)} rows={4} placeholder={"All posts and videos\nExclusive Discord channel\nMonthly live Q&A"} style={{ width: "100%", marginBottom: 12, resize: "vertical" }} />
        <button className="adm-btn adm-btn--primary" onClick={addTier} disabled={addingTier || !tierName || !tierMonthly}>
          {addingTier ? "Saving…" : editTierId ? "Save changes" : "Add tier"}
        </button>
        {editTierId && (
          <button className="adm-btn adm-btn--ghost" onClick={resetTierForm} style={{ marginLeft: 8 }}>Cancel</button>
        )}
        {tierMsg && <span style={{ marginLeft: 12, fontSize: 13 }}>{tierMsg}</span>}
        {tiers.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {tiers.map((t) => (
              <div key={t.id} style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                <div style={{ flex: 1, fontSize: 14 }}>
                  {t.name} · ${t.price_monthly}/mo{t.price_yearly ? ` · $${t.price_yearly}/yr` : ""}
                  {t.description ? <div style={{ fontSize: 12, color: "var(--muted, #888)", marginTop: 2 }}>{t.description}</div> : null}
                  {t.perks && t.perks.length ? <div style={{ fontSize: 11, color: "var(--muted, #888)", marginTop: 2 }}>{t.perks.join(" · ")}</div> : null}
                </div>
                <button className="adm-btn adm-btn--ghost" style={{ padding: "4px 10px" }} onClick={() => startEditTier(t)}>Edit</button>
                <button className="adm-btn adm-btn--ghost" style={{ padding: "4px 10px" }} onClick={() => deleteTier(t.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOCIAL LINKS */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Social links</h2>
        {([
          ["social_instagram", "Instagram"],
          ["social_tiktok", "TikTok"],
          ["social_youtube", "YouTube"],
          ["social_twitter", "X (Twitter)"],
          ["social_twitch", "Twitch"],
          ["social_snapchat", "Snapchat"],
          ["social_discord", "Discord"],
          ["social_website", "Website"],
        ] as [string, string][]).map(([k, lbl]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={label}>{lbl}</label>
            <input className="adm-input" value={links[k] || ""} onChange={(e) => setLinks({ ...links, [k]: e.target.value })} placeholder={`${lbl} URL`} style={{ width: "100%" }} />
          </div>
        ))}
        <button className="adm-btn adm-btn--primary" onClick={saveLinks} disabled={savingLinks} style={{ marginTop: 6 }}>
          {savingLinks ? "Saving…" : "Save links"}
        </button>
        {linksMsg && <span style={{ marginLeft: 12, fontSize: 13 }}>{linksMsg}</span>}
      </div>

      {/* SOCIAL POSTS */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Social posts (TikTok, Instagram, etc.)</h2>
        <p style={{ fontSize: 12, color: "var(--muted, #888)", marginBottom: 14, lineHeight: 1.6 }}>
          Paste a TikTok, Instagram, YouTube, X, or Facebook post link. It embeds live on their page.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input className="adm-input" value={socialUrl} onChange={(e) => setSocialUrl(e.target.value)} placeholder="Paste a post link" style={{ flex: 1, minWidth: 240 }} />
          <button className="adm-btn adm-btn--primary" onClick={addSocial} disabled={addingSocial || !socialUrl}>
            {addingSocial ? "Adding…" : "Add"}
          </button>
        </div>
        {socialMsg && <span style={{ fontSize: 13 }}>{socialMsg}</span>}
        {socialPosts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {socialPosts.map((sp) => (
              <div key={sp.id} style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted, #888)", width: 70, flexShrink: 0 }}>{sp.platform}</span>
                <a href={sp.url} target="_blank" rel="noopener" style={{ flex: 1, fontSize: 12, color: "var(--muted, #888)", wordBreak: "break-all" }}>{sp.url}</a>
                <button className="adm-btn adm-btn--ghost" style={{ padding: "4px 10px" }} onClick={() => deleteSocial(sp.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD POST */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Add a post</h2>
        <textarea className="adm-input" value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Caption" style={{ marginBottom: 12, width: "100%", resize: "vertical" }} />
        {postMedia ? <img src={postMedia} alt="" style={{ maxWidth: 220, borderRadius: 8, display: "block", marginBottom: 10 }} /> : null}
        <div style={{ marginBottom: 12 }}>
          <input type="file" accept="image/*,video/*" onChange={(e) => onUpload(e.target.files?.[0], "post")} />
          {busyUpload === "post" && <span style={{ fontSize: 12, marginLeft: 8 }}>Uploading…</span>}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 14 }}>
          <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
          Subscribers only (locked)
        </label>
        <button className="adm-btn adm-btn--primary" onClick={addPost} disabled={addingPost || (!caption && !postMedia)}>
          {addingPost ? "Adding…" : "Add post"}
        </button>
        {postMsg && <span style={{ marginLeft: 12, fontSize: 13 }}>{postMsg}</span>}
      </div>

      {/* EXISTING POSTS */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Posts ({posts.length})</h2>
        {posts.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--muted, #888)" }}>No posts yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.map((p) => (
              <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 12 }}>
                {p.media_url ? <img src={p.media_url} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : null}
                <div style={{ flex: 1, fontSize: 14 }}>{p.caption || <em style={{ color: "var(--muted,#888)" }}>No caption</em>}</div>
                <button className="adm-btn adm-btn--ghost" style={{ padding: "4px 10px" }} onClick={() => deletePost(p.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ENDORSEMENTS */}
      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Amazon endorsements</h2>
        <p style={{ fontSize: 12, color: "var(--muted, #888)", marginBottom: 16, lineHeight: 1.6 }}>
          Paste an Amazon product link. It is auto tagged with the Spotlightly Associates tag, so purchases earn the commission. Shows on their page with the required disclosure.
        </p>
        <input className="adm-input" value={pickUrl} onChange={(e) => setPickUrl(e.target.value)} placeholder="Amazon product link" style={{ width: "100%", marginBottom: 10 }} />
        <input className="adm-input" value={pickLabel} onChange={(e) => setPickLabel(e.target.value)} placeholder="Label (e.g. My ring light)" style={{ width: "100%", marginBottom: 10 }} />
        <input className="adm-input" value={pickNote} onChange={(e) => setPickNote(e.target.value)} placeholder="Short note (optional)" style={{ width: "100%", marginBottom: 10 }} />
        {pickImage ? <img src={pickImage} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, display: "block", marginBottom: 8 }} /> : null}
        <div style={{ marginBottom: 12 }}>
          <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0], "pick")} />
          {busyUpload === "pick" && <span style={{ fontSize: 12, marginLeft: 8 }}>Uploading…</span>}
        </div>
        <button className="adm-btn adm-btn--primary" onClick={addPick} disabled={addingPick || !pickUrl || !pickLabel}>
          {addingPick ? "Adding…" : "Add endorsement"}
        </button>
        {pickMsg && <span style={{ marginLeft: 12, fontSize: 13 }}>{pickMsg}</span>}

        {picks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {picks.map((p) => (
              <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                {p.image_url ? <img src={p.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : null}
                <div style={{ flex: 1, fontSize: 14 }}>
                  {p.label}
                  {p.url ? <a href={p.url} target="_blank" rel="noopener" style={{ display: "block", fontSize: 11, color: "var(--muted, #888)", wordBreak: "break-all" }}>{p.url}</a> : null}
                </div>
                <button className="adm-btn adm-btn--ghost" style={{ padding: "4px 10px" }} onClick={() => deletePick(p.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
