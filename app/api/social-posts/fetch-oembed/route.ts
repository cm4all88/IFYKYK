import { NextRequest, NextResponse } from 'next/server'

function detectPlatform(url: string): string | null {
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'x'
  if (url.includes('facebook.com')) return 'facebook'
  return null
}

async function fetchOembed(url: string, platform: string) {
  let endpoint = ''

  switch (platform) {
    case 'instagram':
      const appId = process.env.FACEBOOK_APP_ID
      const appSecret = process.env.FACEBOOK_APP_SECRET
      if (!appId || !appSecret) throw new Error('Instagram oEmbed requires FACEBOOK_APP_ID and FACEBOOK_APP_SECRET')
      endpoint = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${appId}|${appSecret}`
      break
    case 'tiktok':
      endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
      break
    case 'youtube':
      endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      break
    case 'x':
      endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`
      break
    case 'facebook':
      const fbAppId = process.env.FACEBOOK_APP_ID
      const fbAppSecret = process.env.FACEBOOK_APP_SECRET
      if (!fbAppId || !fbAppSecret) throw new Error('Facebook oEmbed requires FACEBOOK_APP_ID and FACEBOOK_APP_SECRET')
      endpoint = `https://graph.facebook.com/v18.0/oembed_post?url=${encodeURIComponent(url)}&access_token=${fbAppId}|${fbAppSecret}`
      break
    default:
      throw new Error('Unsupported platform')
  }

  const res = await fetch(endpoint)
  if (!res.ok) throw new Error(`oEmbed fetch failed: ${res.status}`)
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const platform = detectPlatform(url)
    if (!platform) {
      return NextResponse.json({ error: 'Unsupported platform. Paste a link from Instagram, TikTok, YouTube, X, or Facebook.' }, { status: 400 })
    }

    let oembed = null
    let caption = null
    let thumbnail_url = null

    try {
      oembed = await fetchOembed(url, platform)
      caption = oembed.title || oembed.author_name || null
      thumbnail_url = oembed.thumbnail_url || null
    } catch (e) {
      // oEmbed failed — return a link card fallback, not an error
      // Creator can still add the post, it'll render as a plain link card
      console.warn('oEmbed fetch failed, falling back to link card:', e)
    }

    return NextResponse.json({
      platform,
      oembed_html: oembed?.html || null,
      caption,
      thumbnail_url,
    })
  } catch (err) {
    console.error('fetch-oembed error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
