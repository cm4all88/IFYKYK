'use client'

import { useEffect } from 'react'

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  x: 'X', twitter: 'X', facebook: 'Facebook',
}
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C', tiktok: '#69C9D0', youtube: '#FF0000',
  x: '#fff', twitter: '#fff', facebook: '#1877F2',
}

function cleanUrl(u: string) { return (u || '').split('?')[0] }
function ytId(u: string) {
  const m = u.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{6,})/)
  return m ? m[1] : null
}
function ttId(u: string) { const m = u.match(/\/video\/(\d+)/); return m ? m[1] : null }

// Build the embed markup ourselves so it works without oEmbed tokens.
function buildEmbed(platform: string, url: string, oembed: string | null): string | null {
  const u = cleanUrl(url)
  switch (platform) {
    case 'instagram':
      return `<blockquote class="instagram-media" data-instgrm-permalink="${u}" data-instgrm-version="14" style="background:#FFF;border:0;margin:0 auto;max-width:540px;width:100%;border-radius:8px;"></blockquote>`
    case 'youtube': {
      const id = ytId(url)
      return id
        ? `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius:8px;border:0;"></iframe>`
        : oembed
    }
    case 'tiktok': {
      const id = ttId(url)
      if (id) return `<blockquote class="tiktok-embed" cite="${u}" data-video-id="${id}" style="max-width:605px;min-width:325px;margin:0 auto;"><a href="${u}"></a></blockquote>`
      return oembed
    }
    case 'x':
    case 'twitter':
      return oembed || `<blockquote class="twitter-tweet" data-theme="dark"><a href="${u}"></a></blockquote>`
    default:
      return oembed
  }
}

function ensureScript(src: string, id: string, onReady?: () => void) {
  const existing = document.getElementById(id) as HTMLScriptElement | null
  if (existing) { onReady?.(); return }
  const s = document.createElement('script')
  s.id = id; s.src = src; s.async = true
  s.onload = () => onReady?.()
  document.body.appendChild(s)
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
  const embed = buildEmbed(post.platform, post.url, post.oembed_html)

  // Hydrate the embed with the platform's script once it's in the DOM.
  useEffect(() => {
    if (!embed) return
    const p = post.platform
    if (p === 'instagram') {
      ensureScript('https://www.instagram.com/embed.js', 'ig-embed-js', () => {
        ;(window as any).instgrm?.Embeds?.process?.()
      })
      ;(window as any).instgrm?.Embeds?.process?.()
    } else if (p === 'tiktok') {
      ensureScript('https://www.tiktok.com/embed.js', 'tt-embed-js')
    } else if (p === 'x' || p === 'twitter') {
      ensureScript('https://platform.twitter.com/widgets.js', 'tw-embed-js', () => {
        ;(window as any).twttr?.widgets?.load?.()
      })
      ;(window as any).twttr?.widgets?.load?.()
    }
  }, [embed, post.platform, post.id])

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
            Originally posted {formattedDate}
          </span>
        )}
      </div>

      {embed ? (
        <div style={{ padding: 16 }}>
          <div dangerouslySetInnerHTML={{ __html: embed }} style={{ maxWidth: '100%' }} />
        </div>
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
