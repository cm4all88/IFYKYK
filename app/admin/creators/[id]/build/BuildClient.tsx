"use client";
import { useState } from "react";

type Creator = {
  id: string; handle: string; display_name: string; bio: string | null;
  avatar_url: string | null; cover_url: string | null; subscription_price: number | null; published: boolean;
};
type Post = { id: string; caption: string | null; media_url: string | null; media_type: string | null; created_at: string };

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Upload failed");
  return data.url as string;
}

export default function BuildClient({ creator, initialPosts }: { creator: Creator; initialPosts: Post[] }) {
  const [displayName, setDisplayName] = useState(creator.display_name || "");
  const [bio, setBio] = useState(creator.bio || "");
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

  async function onUpload(file: File | undefined, target: "avatar" | "cover" | "post") {
    if (!file) return;
    setBusyUpload(target);
    try {
      const url = await uploadFile(file);
      if (target === "avatar") setAvatar(url);
      else if (target === "cover") setCover(url);
      else { setPostMedia(url); setPostMediaType(file.type.startsWith("video") ? "video" : "image"); }
    } catch (e: any) { alert(e.message || "Upload failed"); }
    setBusyUpload("");
  }

  async function saveProfile() {
    setSavingProfile(true); setProfileMsg("");
    try {
      const res = await fetch("/api/admin/creators/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: creator.id, display_name: displayName, bio, avatar_url: avatar, cover_url: cover, subscription_price: price }),
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

  const label: React.CSSProperties = { fontSize: 12, color: "var(--muted, #888)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div className="adm-page" style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <h1 className="adm-page-title" style={{ margin: 0 }}>Build @{creator.handle}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`/${creator.handle}`} target="_blank" className="adm-btn adm-btn--ghost">Preview</a>
          <a href="/admin/creators" className="adm-btn adm-btn--ghost">Back</a>
        </div>
      </div>
      <p className="adm-page-lede" style={{ marginBottom: 24 }}>
        Edit the page on their behalf. {creator.published ? "This page is live." : "This page is in preview (not in Explore)."}
      </p>

      {/* PROFILE */}
      <div className="card" style={{ marginBottom: 20, padding: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Profile</h2>
        <label style={label}>Display name</label>
        <input className="adm-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ marginBottom: 14, width: "100%" }} />
        <label style={label}>Bio</label>
        <textarea className="adm-input" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} style={{ marginBottom: 14, width: "100%", resize: "vertical" }} />
        <label style={label}>Monthly subscription price (USD)</label>
        <input className="adm-input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} style={{ marginBottom: 14, width: 200 }} />

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <label style={label}>Avatar</label>
            {avatar ? <img src={avatar} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", display: "block", marginBottom: 8 }} /> : null}
            <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0], "avatar")} />
            {busyUpload === "avatar" && <span style={{ fontSize: 12, marginLeft: 8 }}>Uploading…</span>}
          </div>
          <div>
            <label style={label}>Cover</label>
            {cover ? <img src={cover} alt="" style={{ width: 160, height: 72, borderRadius: 8, objectFit: "cover", display: "block", marginBottom: 8 }} /> : null}
            <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0], "cover")} />
            {busyUpload === "cover" && <span style={{ fontSize: 12, marginLeft: 8 }}>Uploading…</span>}
          </div>
        </div>

        <button className="adm-btn adm-btn--primary" onClick={saveProfile} disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
        {profileMsg && <span style={{ marginLeft: 12, fontSize: 13 }}>{profileMsg}</span>}
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
    </div>
  );
}
