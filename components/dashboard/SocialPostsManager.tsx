'use client'

import { useState, useEffect } from 'react'
import SocialPostCard from '@/components/SocialPostCard'

interface SocialPost {
  id: string
  url: string
  platform: string
  oembed_html: string | null
  caption: string | null
  thumbnail_url: string | null
  original_posted_at: string | null
  pinned: boolean
}

export default function SocialPostsManager() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Partial<SocialPost> | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<string | null>(null)

  useEffect(() => {
    loadPosts()
  }, [])

  async function loadPosts() {
    const res = await fetch('/api/social-posts')
    const data = await res.json()
    if (data.posts) setPosts(data.posts)
  }

  async function handleFetchPreview() {
    if (!url.trim()) return
    setFetching(true)
    setError(null)
    setPreview(null)

    try {
      const res = await fetch('/api/social-posts/fetch-oembed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch post')
      setPreview({ ...data, url: url.trim() })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFetching(false)
    }
  }

  async function handleAdd() {
    if (!preview) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add post')
      setPosts(prev => [data.post, ...prev])
      setUrl('')
      setPreview(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleBulkAdd() {
    const urls = Array.from(new Set(
      bulkText.split(/[\n,]+/).map(u => u.trim()).filter(Boolean)
    ))
    if (urls.length === 0) return
    setBulkRunning(true)
    setError(null)
    let added = 0
    const failed: string[] = []

    for (let i = 0; i < urls.length; i++) {
      const u = urls[i]
      setBulkStatus(`Adding ${i + 1} of ${urls.length}…`)
      try {
        const oe = await fetch('/api/social-posts/fetch-oembed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: u }),
        })
        const oeData = await oe.json()
        if (!oe.ok) throw new Error(oeData.error || 'fetch failed')

        const add = await fetch('/api/social-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...oeData, url: u }),
        })
        const addData = await add.json()
        if (!add.ok) throw new Error(addData.error || 'add failed')
        setPosts(prev => [addData.post, ...prev])
        added++
      } catch {
        failed.push(u)
      }
    }

    setBulkRunning(false)
    setBulkStatus(null)
    setBulkText(failed.join('\n'))
    if (failed.length === 0) {
      setError(null)
      setBulkMode(false)
    } else {
      setError(`Added ${added}. ${failed.length} couldn't be added (left in the box) — these are usually private posts or unsupported links.`)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/social-posts?id=${id}`, { method: 'DELETE' })
    if (res.ok) setPosts(prev => prev.filter(p => p.id !== id))
  }

  async function handleTogglePin(id: string, pinned: boolean) {
    const res = await fetch('/api/social-posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pinned }),
    })
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === id ? { ...p, pinned } : p))
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: '28px',
          fontWeight: 300,
          color: '#fff',
          marginBottom: '8px',
        }}>
          Social Posts
        </h2>
        <p style={{ color: '#71717A', fontSize: '14px', margin: 0 }}>
          Paste a link from Instagram, TikTok, YouTube, X, or Facebook. It'll appear in your Spotlight feed alongside your native posts.
        </p>
      </div>

      {/* Single / bulk toggle */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
        {(['single', 'bulk'] as const).map(m => {
          const active = (m === 'bulk') === bulkMode
          return (
            <button key={m} onClick={() => { setBulkMode(m === 'bulk'); setError(null) }} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
              color: active ? '#F0B429' : 'rgba(242,242,240,0.45)',
              borderBottom: active ? '1px solid #F0B429' : '1px solid transparent', paddingBottom: 3,
            }}>
              {m === 'single' ? 'One at a time' : 'Add many'}
            </button>
          )
        })}
      </div>

      {/* URL input */}
      {!bulkMode && (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetchPreview()}
          placeholder="Paste a post URL..."
          style={{
            flex: 1,
            background: '#0a0a0f',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            padding: '12px 16px',
            color: '#F2F2F0',
            fontSize: '14px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleFetchPreview}
          disabled={!url.trim() || fetching}
          style={{
            background: '#F0B429',
            color: '#09090C',
            border: 'none',
            borderRadius: '6px',
            padding: '12px 20px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: url.trim() && !fetching ? 'pointer' : 'not-allowed',
            opacity: url.trim() && !fetching ? 1 : 0.5,
            fontWeight: 500,
          }}
        >
          {fetching ? 'Fetching...' : 'Preview'}
        </button>
      </div>
      )}

      {/* Bulk input */}
      {bulkMode && (
      <div style={{ marginBottom: '16px' }}>
        <textarea
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder={"Paste one link per line…\nhttps://tiktok.com/@you/video/123\nhttps://youtube.com/watch?v=abc\nhttps://x.com/you/status/456"}
          rows={6}
          disabled={bulkRunning}
          style={{
            width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', padding: '12px 16px', color: '#F2F2F0', fontSize: '13px',
            outline: 'none', fontFamily: 'DM Mono, monospace', lineHeight: 1.7, resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px' }}>
          <button
            onClick={handleBulkAdd}
            disabled={!bulkText.trim() || bulkRunning}
            style={{
              background: '#F0B429', color: '#09090C', border: 'none', borderRadius: '6px',
              padding: '12px 20px', fontFamily: 'DM Mono, monospace', fontSize: '11px',
              letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
              cursor: bulkText.trim() && !bulkRunning ? 'pointer' : 'not-allowed',
              opacity: bulkText.trim() && !bulkRunning ? 1 : 0.5,
            }}
          >
            {bulkRunning ? 'Adding…' : 'Add all'}
          </button>
          {bulkStatus && <span style={{ fontSize: '12px', color: 'rgba(242,242,240,0.6)', fontFamily: 'DM Mono, monospace' }}>{bulkStatus}</span>}
        </div>
      </div>
      )}

      {error && (
        <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '16px', fontFamily: 'DM Mono, monospace' }}>
          {error}
        </p>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#71717A', marginBottom: '8px' }}>
            Preview
          </p>
          <SocialPostCard post={preview as SocialPost} />
          <button
            onClick={handleAdd}
            disabled={loading}
            style={{
              marginTop: '12px',
              background: '#F0B429',
              color: '#09090C',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              fontWeight: 500,
            }}
          >
            {loading ? 'Adding...' : 'Add to my Spotlight'}
          </button>
        </div>
      )}

      {/* Existing posts */}
      {posts.length > 0 && (
        <div>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#71717A', marginBottom: '12px' }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''} in your feed
          </p>
          {posts.map(post => (
            <SocialPostCard
              key={post.id}
              post={post}
              isOwner
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}

      {posts.length === 0 && !preview && (
        <div style={{
          border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '48px',
          textAlign: 'center',
          color: '#71717A',
          fontSize: '14px',
        }}>
          No social posts yet. Paste your first link above.
        </div>
      )}
    </div>
  )
}
