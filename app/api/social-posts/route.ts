import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET /api/social-posts?creator_id=xxx
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const creatorId = req.nextUrl.searchParams.get('creator_id')

  if (!creatorId) {
    return NextResponse.json({ error: 'creator_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('creator_id', creatorId)
    .order('pinned', { ascending: false })
    .order('original_posted_at', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

// POST /api/social-posts
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { url, platform, oembed_html, caption, thumbnail_url, original_posted_at } = body

  // Get creator profile for this user
  const { data: profile } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      creator_id: profile.id,
      url,
      platform,
      oembed_html,
      caption,
      thumbnail_url,
      original_posted_at: original_posted_at || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

// DELETE /api/social-posts?id=xxx
export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postId = req.nextUrl.searchParams.get('id')
  if (!postId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Get creator profile
  const { data: profile } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('social_posts')
    .delete()
    .eq('id', postId)
    .eq('creator_id', profile.id) // RLS double-check

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PATCH /api/social-posts — toggle pin
export async function PATCH(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, pinned } = await req.json()

  const { data: profile } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('social_posts')
    .update({ pinned })
    .eq('id', id)
    .eq('creator_id', profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
