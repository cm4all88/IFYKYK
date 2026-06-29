// The creator's post image urls, in the exact order the Video Studio uses them.
// Shared by the data loader and the media analyzer so per-image analysis stays
// aligned to feedScreenshots by index.
export async function loadFeedUrls(supabase: any, creatorProfileId: string): Promise<string[]> {
  const { data: posts } = await supabase
    .from("posts")
    .select("media_url, media_type, is_pinned, status, created_at")
    .eq("creator_profile_id", creatorProfileId)
    .eq("status", "live")
    .not("media_url", "is", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);
  return (posts ?? [])
    .filter((p: any) => p.media_url && (p.media_type ?? "image") !== "video")
    .map((p: any) => p.media_url as string)
    .slice(0, 6);
}
