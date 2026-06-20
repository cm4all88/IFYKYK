'use client'

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  x: 'X', twitter: 'X', facebook: 'Facebook',
}
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C', tiktok: '#69C9D0', youtube: '#FF0000',
  x: '#fff', twitter: '#fff', facebook: '#1877F2',
}

function ytId(u: string) { const m = (u || '').match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{6,})/); return m ? m[1] : null }
function xId(u: string) { const m = (u || '').match(/status(?:es)?\/(\d+)/); return m ? m[1] : null }

// Live iframes ONLY for the platforms that embed reliably.
//  - YouTube: rock-solid, rendered in a responsive 16:9 box.
//  - X/Twitter: reliable, natural height.
// Instagram and TikTok intentionally return null so they fall through to the
// static card below. Their live iframes are unreliable (IG serves login walls /
// "content unavailable"; TikTok's fixed-height player clips inside a fluid
// grid). enrichInstagram / enrichTikTok populate a real re-hosted thumbnail at
// save-time; when that's absent we show a clean link card, never a broken frame.
function embedFor(platform: string, url: string): { src: string; aspect?: string; height?: number; bg: string } | null {
  switch (platform) {
    case 'youtube': { const id = ytId(url); return id ? { src: `https://www.youtube.com/embed/${id}`, aspect: '16 / 9', bg: '#000' } : null }
    case 'x':
    case 'twitter': { const id = xId(url); return id ? { src: `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark`, height: 560, bg: 'transparent' } : null }
    default: return null
  }
}

interface SocialPostCardProps {
  post: {
    id: string; url: string; platform: string; oembed_html: string | null
    caption: string | null; thumbnail_url: string | null
    original_posted_at: string | null; pinned: boolean
  }
  isOwner?: boolean
  onDelete?: (id: string) => void
  onTogglePin?: (id: string, pinned: boolean) => void
}

export default function SocialPostCard({ post, isOwner, onDelete, onTogglePin }: SocialPostCardProps) {
  const label = PLATFORM_LABELS[post.platform] || post.platform
  const color = PLATFORM_COLORS[post.platform] || 'var(--accent, #F0B429)'
  const embed = embedFor(post.platform, post.url)

  const formattedDate = post.original_posted_at
    ? new Date(post.original_posted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  return (
    <div style={{ background: 'var(--surface, #111115)', border: '1px solid var(--border, rgba(255,255,255,0.07))', borderRadius: 10, overflow: 'hidden', marginBottom: 12, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color, fontWeight: 600 }}>
          {post.pinned ? '📌 ' : ''}{label}
        </span>
        {formattedDate && (
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
            {formattedDate}
          </span>
        )}
      </div>

      {post.thumbnail_url ? (
        <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
          <div style={{ position: 'relative', width: '100%', background: '#0d0d12' }}>
            <img
              src={post.thumbnail_url}
              alt={post.caption || `${label} post`}
              loading="lazy"
              style={{ display: 'block', width: '100%', maxHeight: 480, objectFit: 'cover' }}
            />
            <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontFamily: 'var(--font-mono, monospace)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4 }}>
              ↗ {label}
            </span>
          </div>
          {post.caption && (
            <p style={{ color: 'var(--text-soft, rgba(232,232,240,0.78))', fontSize: 13, lineHeight: 1.55, margin: 0, padding: '12px 16px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {post.caption}
            </p>
          )}
        </a>
      ) : embed ? (
        embed.aspect ? (
          <div style={{ position: 'relative', width: '100%', aspectRatio: embed.aspect, background: embed.bg }}>
            <iframe
              src={embed.src}
              title={`${label} post`}
              loading="lazy"
              allow="encrypted-media; clipboard-write; picture-in-picture; fullscreen"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
        ) : (
          <iframe
            src={embed.src}
            title={`${label} post`}
            loading="lazy"
            scrolling="no"
            allow="encrypted-media; clipboard-write; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ display: 'block', width: '100%', height: embed.height, border: 0, background: embed.bg }}
          />
        )
      ) : (
        <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '26px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontWeight: 700, fontSize: 15, color }}>View on {label}</span>
            <span style={{ color, fontSize: 16 }}>↗</span>
          </div>
          {post.caption && (
            <p style={{ color: 'var(--text-soft, rgba(232,232,240,0.78))', fontSize: 13, lineHeight: 1.55, margin: '12px 2px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {post.caption}
            </p>
          )}
        </a>
      )}

      {isOwner && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => onTogglePin?.(post.id, !post.pinned)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: post.pinned ? 'var(--accent)' : 'var(--muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.1em', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase' }}>
            {post.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button onClick={() => onDelete?.(post.id)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, color: 'rgba(239,68,68,0.7)', fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.1em', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase' }}>
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
