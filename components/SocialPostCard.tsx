'use client'

import { useState } from 'react'

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  facebook: 'Facebook',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  tiktok: '#69C9D0',
  youtube: '#FF0000',
  x: '#fff',
  facebook: '#1877F2',
}

interface SocialPostCardProps {
  post: {
    id: string
    url: string
    platform: string
    oembed_html: string | null
    caption: string | null
    thumbnail_url: string | null
    original_posted_at: string | null
    pinned: boolean
  }
  isOwner?: boolean
  onDelete?: (id: string) => void
  onTogglePin?: (id: string, pinned: boolean) => void
}

export default function SocialPostCard({ post, isOwner, onDelete, onTogglePin }: SocialPostCardProps) {
  const [expanded, setExpanded] = useState(false)
  const label = PLATFORM_LABELS[post.platform] || post.platform
  const color = PLATFORM_COLORS[post.platform] || '#F0B429'

  const formattedDate = post.original_posted_at
    ? new Date(post.original_posted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  return (
    <div style={{
      background: '#111115',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '2px',
      position: 'relative',
    }}>
      {/* Platform badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color,
          fontWeight: 500,
        }}>
          {post.pinned ? '📌 ' : ''}{label}
        </span>
        {formattedDate && (
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#71717A', marginLeft: 'auto' }}>
            Originally posted {formattedDate}
          </span>
        )}
      </div>

      {/* oEmbed content or fallback */}
      {post.oembed_html ? (
        <div style={{ padding: '16px' }}>
          <div
            dangerouslySetInnerHTML={{ __html: post.oembed_html }}
            style={{ maxWidth: '100%' }}
          />
        </div>
      ) : (
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            gap: '16px',
            padding: '16px',
            textDecoration: 'none',
            alignItems: 'center',
          }}
        >
          {post.thumbnail_url && (
            <img
              src={post.thumbnail_url}
              alt=""
              style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
            />
          )}
          <div>
            {post.caption && (
              <p style={{ color: 'rgba(242,242,240,0.8)', fontSize: '14px', margin: '0 0 6px', lineHeight: 1.5 }}>
                {post.caption}
              </p>
            )}
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#71717A' }}>
              View on {label} →
            </span>
          </div>
        </a>
      )}

      {/* Owner controls */}
      {isOwner && (
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '8px 16px 12px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          <button
            onClick={() => onTogglePin?.(post.id, !post.pinned)}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: post.pinned ? '#F0B429' : '#71717A',
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.1em',
              padding: '4px 10px',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {post.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            onClick={() => onDelete?.(post.id)}
            style={{
              background: 'none',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '4px',
              color: 'rgba(239,68,68,0.6)',
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.1em',
              padding: '4px 10px',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
