// The creator's post image urls, in the exact order the Video Studio uses them.
// Includes gallery images (media_urls) so a creator with multi photo posts gives the
// reel plenty to work with. Shared by the loader and the analyzer so per-image analysis
// stays aligned by index.
export async function loadFeedUrls(supabase: any, creatorProfileId: string): Promise<string[]> {
  // NOTE: .select() must come first in a Supabase query, before any filters.
  const run = (cols: string) =>
    supabase
      .from("posts")
      .select(cols)
      .eq("creator_profile_id", creatorProfileId)
      .eq("status", "live")
      .not("media_url", "is", null)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12);

  // Try the gallery column; fall back if migration 058 has not been run yet.
  let posts: any[] = [];
  const withGallery = await run("media_url, media_urls, media_type, is_pinned, status, created_at");
  if (withGallery.error) {
    const legacy = await run("media_url, media_type, is_pinned, status, created_at");
    posts = legacy.data ?? [];
  } else {
    posts = withGallery.data ?? [];
  }

  const urls: string[] = [];
  for (const p of posts) {
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
