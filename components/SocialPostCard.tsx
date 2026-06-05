'use client'

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  x: 'X', twitter: 'X', facebook: 'Facebook',
}
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C', tiktok: '#69C9D0', youtube: '#FF0000',
  x: '#fff', twitter: '#fff', facebook: '#1877F2',
}

function igCode(u: string) { const m = (u || '').match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i); return m ? m[1] : null }
function ttId(u: string) { const m = (u || '').match(/\/video\/(\d{6,25})/); return m ? m[1] : null }
function ytId(u: string) { const m = (u || '').match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{6,})/); return m ? m[1] : null }
function xId(u: string) { const m = (u || '').match(/status(?:es)?\/(\d+)/); return m ? m[1] : null }

// Direct iframe embeds — no third-party scripts, no oEmbed token, SPA-safe.
function embedFor(platform: string, url: string): { src: string; height: number; bg: string } | null {
  switch (platform) {
    case 'instagram': { const c = igCode(url); return c ? { src: `https://www.instagram.com/p/${c}/embed/`, height: 560, bg: '#fff' } : null }
    case 'tiktok': { const id = ttId(url); return id ? { src: `https://www.tiktok.com/embed/v2/${id}`, height: 740, bg: '#000' } : null }
    case 'youtube': { const id = ytId(url); return id ? { src: `https://www.youtube.com/embed/${id}`, height: 320, bg: '#000' } : null }
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

      {embed ? (
        <iframe
          src={embed.src}
          title={`${label} post`}
          loading="lazy"
          scrolling="no"
          allow="encrypted-media; clipboard-write; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ display: 'block', width: '100%', height: embed.height, border: 0, background: embed.bg }}
        />
      ) : (
        <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 16, padding: 16, textDecoration: 'none', alignItems: 'center' }}>
          {post.thumbnail_url && (
            <img src={post.thumbnail_url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
          )}
          <div>
            {post.caption && <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '0 0 6px', lineHeight: 1.5 }}>{post.caption}</p>}
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, color: 'var(--muted)' }}>View on {label} →</span>
          </div>
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
