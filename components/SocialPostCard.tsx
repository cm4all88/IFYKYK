'use client'

import { useCallback, useState } from 'react'
import IgPostEmbed, { igShortcode } from '@/components/IgPostEmbed'

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  x: 'X', twitter: 'X', facebook: 'Facebook',
}
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C', tiktok: '#69C9D0', youtube: '#FF0000',
  x: '#fff', twitter: '#fff', facebook: '#1877F2',
}

function ttId(u: string) { const m = (u || '').match(/\/video\/(\d{6,25})/); return m ? m[1] : null }
function ytId(u: string) { const m = (u || '').match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{6,})/); return m ? m[1] : null }
function xId(u: string) { const m = (u || '').match(/status(?:es)?\/(\d+)/); return m ? m[1] : null }

// Live embeds, each sized for how that platform actually renders.
//  - Instagram: real post/reel embed via the correct /reel/ or /p/ path,
//    capped to IG's native width and centered (avoids the full-width stretch).
//  - TikTok: live player, capped to native width, centered (no clip).
//  - YouTube: responsive 16:9.  - X: live tweet.
// If a URL can't be parsed we fall back to a thumbnail (if enriched) then a
// clean link card — never a broken frame.
function embedFor(platform: string, url: string): { src: string; aspect?: string; width?: number; height?: number; bg: string } | null {
  switch (platform) {
    // Instagram is handled separately by IgPostEmbed, which measures the real post
    // height from IG's own MEASURE message and only falls back when the post
    // genuinely will not render.
    case 'instagram':
      return null;
    case 'tiktok': { const id = ttId(url); return id ? { src: `https://www.tiktok.com/embed/v2/${id}`, width: 325, height: 740, bg: '#000' } : null }
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

  // A real Instagram post url (not a profile link) gets the live embed. If IG cannot
  // serve it, IgPostEmbed tells us and we drop to the thumbnail or link card.
  const [igFailed, setIgFailed] = useState(false)
  const onIgFail = useCallback(() => setIgFailed(true), [])
  const showIg = post.platform === 'instagram' && !igFailed && !!igShortcode(post.url)

  // Instagram that will not embed and has no thumbnail renders nothing. Better an
  // absent card than a link that pushes the visitor off the page.
  if (post.platform === 'instagram' && igFailed && !post.thumbnail_url && !isOwner) return null

  // Only show a date we actually trust: parseable, after 2010, not in the future.
  const ts = post.original_posted_at ? Date.parse(post.original_posted_at) : NaN
  const formattedDate = (!Number.isNaN(ts) && ts > 1262304000000 && ts < Date.now() + 86400000)
    ? new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
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

      {showIg ? (
        <IgPostEmbed url={post.url} onFail={onIgFail} />
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
        ) : embed.width ? (
          <div style={{ maxWidth: embed.width, margin: '0 auto', background: embed.bg }}>
            <iframe
              src={embed.src}
              title={`${label} post`}
              loading="lazy"
              scrolling="no"
              allow="encrypted-media; clipboard-write; picture-in-picture; fullscreen"
              allowFullScreen
              style={{ display: 'block', width: '100%', height: embed.height, border: 0, background: embed.bg }}
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
      ) : post.thumbnail_url ? (
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
