// The creator's post image urls, in the exact order the Video Studio uses them.
// Now includes gallery images (media_urls), so a creator with multi photo posts gives
// the reel plenty to work with instead of one photo on repeat. Shared by the data
// loader and the media analyzer so per-image analysis stays aligned by index.
export async function loadFeedUrls(supabase: any, creatorProfileId: string): Promise<string[]> {
  const base = () =>
    supabase
      .from("posts")
      .eq("creator_profile_id", creatorProfileId)
      .eq("status", "live")
      .not("media_url", "is", null)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12);

  // Try to read the gallery column; fall back if migration 058 has not been run.
  let posts: any[] | null = null;
  const withGallery = await base().select("media_url, media_urls, media_type, is_pinned, status, created_at");
  if (withGallery.error) {
    const legacy = await base().select("media_url, media_type, is_pinned, status, created_at");
    posts = legacy.data ?? [];
  } else {
    posts = withGallery.data ?? [];
  }

  const urls: string[] = [];
  for (const p of posts ?? []) {
    const gallery =
      Array.isArray(p.media_urls) && p.media_urls.length
        ? p.media_urls
        : p.media_url
        ? [{ url: p.media_url, type: p.media_type ?? "image" }]
        : [];
    for (const m of gallery) {
      const type = (m?.type ?? "image") as string;
      if (m?.url && type !== "video" && !urls.includes(m.url)) urls.push(m.url as string);
    }
  }
  return urls.slice(0, 12);
}
