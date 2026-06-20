// Both TikTok video IDs and Instagram shortcodes embed the post's creation time.
// We decode it so social posts can be ordered chronologically even when the
// stored original_posted_at is empty (oEmbed rarely provides it without a token).
// BigInt() calls (not `123n` literals) keep this compatible with the build target.

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

// Instagram: the shortcode-to-timestamp math is unreliable across IG's id
// formats and was producing far-future dates (e.g. Sep 2040). We no longer
// derive a date from the shortcode at all. IG posts order by a stored date
// when present, otherwise by add order. Returning null keeps every caller
// from writing or showing a garbage date.
export function instagramDateMs(_url: string): number | null {
  return null;
}

// Best available timestamp for ordering: stored date first, else derived.
export function socialPostTimestamp(post: {
  url?: string | null; platform?: string | null; original_posted_at?: string | null;
}): number {
  if (post.original_posted_at) {
    const t = Date.parse(post.original_posted_at);
    // Ignore implausible/future timestamps left by older buggy decoding.
    if (!Number.isNaN(t) && t <= Date.now() + 86_400_000) return t;
  }
  const url = post.url || "";
  if (post.platform === "tiktok") return tiktokDateMs(url) ?? 0;
  if (post.platform === "instagram") return instagramDateMs(url) ?? 0;
  return tiktokDateMs(url) ?? instagramDateMs(url) ?? 0;
}
