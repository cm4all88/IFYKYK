// Both TikTok video IDs and Instagram shortcodes embed the post's creation time.
// We decode it so social posts can be ordered chronologically even when the
// stored original_posted_at is empty (oEmbed rarely provides it without a token).
// BigInt() calls (not `123n` literals) keep this compatible with the build target.

const IG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// TikTok: the high 32 bits of the numeric video id are the unix seconds.
export function tiktokDateMs(url: string): number | null {
  const m = (url || "").match(/\/video\/(\d{6,25})/);
  if (!m) return null;
  try {
    const secs = Number(BigInt(m[1]) >> BigInt(32));
    if (secs > 1_400_000_000 && secs < 4_000_000_000) return secs * 1000;
  } catch { /* ignore */ }
  return null;
}

// Instagram: the shortcode decodes (base64) to a media id whose high bits are
// the timestamp (ms) offset from Instagram's epoch.
export function instagramDateMs(url: string): number | null {
  const m = (url || "").match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  try {
    let id = BigInt(0);
    const sixtyFour = BigInt(64);
    for (const ch of m[1].slice(0, 11)) {
      const idx = IG_ALPHABET.indexOf(ch);
      if (idx < 0) return null;
      id = id * sixtyFour + BigInt(idx);
    }
    const ms = Number((id >> BigInt(22)) + BigInt("1314220021721"));
    if (ms > 1_400_000_000_000 && ms < 4_000_000_000_000) return ms;
  } catch { /* ignore */ }
  return null;
}

// Best available timestamp for ordering: stored date first, else derived.
export function socialPostTimestamp(post: {
  url?: string | null; platform?: string | null; original_posted_at?: string | null;
}): number {
  if (post.original_posted_at) {
    const t = Date.parse(post.original_posted_at);
    if (!Number.isNaN(t)) return t;
  }
  const url = post.url || "";
  if (post.platform === "tiktok") return tiktokDateMs(url) ?? 0;
  if (post.platform === "instagram") return instagramDateMs(url) ?? 0;
  return tiktokDateMs(url) ?? instagramDateMs(url) ?? 0;
}
