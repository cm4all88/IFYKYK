/**
 * Social post enrichment — server-side only.
 *
 * Instagram's live iframe is fragile (login walls, private/deleted posts, rate
 * limits) and renders on a white card we don't control. Instead, at save-time we
 * pull the post's image + caption from Instagram's own embed HTML, re-host the
 * image on our Bunny CDN (IG's CDN URLs are signed and expire), and store both.
 * The card then renders from our own assets with zero dependency on IG serving
 * anything live.
 *
 * Every failure path returns nulls — the caller falls back to the live iframe,
 * so this can never make things worse than they are today.
 */
import { BUNNY, bunnyUploadUrl, bunnyCdnUrl } from "@/lib/bunny";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function igShortcode(url: string): string | null {
  const m = (url || "").match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

function decodeUrlEscapes(s: string): string {
  return s
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/\\"/g, '"');
}

function htmlUnescape(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImage(html: string): string | null {
  let m = html.match(/"display_url":"([^"]+)"/);
  if (m) return decodeUrlEscapes(m[1]);
  m = html.match(/class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/i);
  if (m) return decodeUrlEscapes(m[1]);
  m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (m) return decodeUrlEscapes(m[1]);
  return null;
}

function extractCaption(html: string): string | null {
  // 1) Structured caption in the embedded JSON
  let m = html.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/);
  if (m) {
    try { return JSON.parse('"' + m[1] + '"'); } catch { return decodeUrlEscapes(m[1]); }
  }
  // 2) Visible caption block on the /captioned/ embed
  m = html.match(/class="Caption"[\s\S]*?<\/div>/i);
  if (m) {
    const text = htmlUnescape(m[0]);
    if (text) return text;
  }
  // 3) og:title as a last resort
  m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (m) return htmlUnescape(m[1]);
  return null;
}

async function rehostToBunny(imgUrl: string, key: string): Promise<string | null> {
  if (!BUNNY.API_KEY || !BUNNY.STORAGE_ZONE) return null;
  try {
    const res = await fetch(imgUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500) return null; // empty / 1px / error body
    const ct = res.headers.get("content-type") || "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const path = `social/${key}.${ext}`;
    const up = await fetch(bunnyUploadUrl(path), {
      method: "PUT",
      headers: { AccessKey: BUNNY.API_KEY, "Content-Type": ct },
      body: buf,
    });
    if (!up.ok) return null;
    return bunnyCdnUrl(path);
  } catch {
    return null;
  }
}

/**
 * Fetch + re-host an Instagram post's image and caption.
 * Returns { thumbnail_url, caption } — either may be null on failure.
 */
export async function enrichInstagram(
  url: string
): Promise<{ thumbnail_url: string | null; caption: string | null }> {
  const empty = { thumbnail_url: null, caption: null };
  const code = igShortcode(url);
  if (!code) return empty;
  try {
    const res = await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return empty;
    const html = await res.text();
    const img = extractImage(html);
    const caption = extractCaption(html);
    let thumb: string | null = null;
    if (img) {
      const rand = Math.random().toString(36).slice(2, 8);
      thumb = await rehostToBunny(img, `${code}-${Date.now().toString(36)}${rand}`);
    }
    return {
      thumbnail_url: thumb,
      caption: caption ? caption.slice(0, 600) : null,
    };
  } catch {
    return empty;
  }
}
