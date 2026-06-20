import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { enrichInstagram, enrichTikTok } from '@/lib/socialEnrich'

export const runtime = 'nodejs'
export const maxDuration = 60

// One-shot backfill for existing Instagram / TikTok social posts that have no
// thumbnail yet, so they render as real image cards instead of bare link cards.
// Idempotent: only touches posts where thumbnail_url is null, so it's safe to
// re-run. Guarded by CRON_SECRET.
//
//   curl -X POST https://www.spotlightly.app/api/social-posts/backfill \
//        -H "x-cron-secret: YOUR_CRON_SECRET"
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await createServiceClient()

  const { data: posts, error } = await (admin as any)
    .from('social_posts')
    .select('id, url, platform, caption, thumbnail_url')
    .is('thumbnail_url', null)
    .in('platform', ['instagram', 'tiktok'])
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let updated = 0
  const failed: string[] = []

  for (const p of posts || []) {
    try {
      const enriched = p.platform === 'instagram'
        ? await enrichInstagram(p.url)
        : await enrichTikTok(p.url)

      const patch: any = {}
      if (enriched.thumbnail_url) patch.thumbnail_url = enriched.thumbnail_url
      if (!p.caption && enriched.caption) patch.caption = enriched.caption

      if (Object.keys(patch).length === 0) { failed.push(p.id); continue }

      const { error: upErr } = await (admin as any)
        .from('social_posts')
        .update(patch)
        .eq('id', p.id)

      if (upErr) { failed.push(p.id); continue }
      updated++
    } catch {
      failed.push(p.id)
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: posts?.length || 0,
    updated,
    failed: failed.length,
  })
}
