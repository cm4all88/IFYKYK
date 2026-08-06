// ──────────────────────────────────────────────────────────────────
// lib/discovery.ts
// Whether public discovery surfaces are open yet.
// ──────────────────────────────────────────────────────────────────

/**
 * A browse page with four creators on it is worse than no browse page. It makes
 * an empty venue look like the whole venue, and it is the first impression for
 * anyone who lands on it from search. /explore stays closed until there are
 * enough published creators for a grid to read as a real roster.
 *
 * This is the one place that number lives. Nothing needs redeploying when the
 * roster grows past it: the page opens on its own.
 */
export const EXPLORE_MIN_CREATORS = 12;

/**
 * Creators a visitor could actually browse.
 *
 * `published` is not the right signal on its own. Concierge and outreach pages
 * are published so a prospect can see and claim their own page, but they are not
 * live creators and a browse grid full of them reads as an empty venue with the
 * lights on. A page only counts once someone has claimed it.
 */
export async function publishedCreatorCount(supabase: any): Promise<number> {
  const { count } = await supabase
    .from("creator_profiles")
    .select("id", { count: "exact", head: true })
    .eq("kind", "spotlight")
    .eq("published", true)
    .not("handle", "is", null)
    .not("claimed_at", "is", null);
  return count ?? 0;
}

export async function exploreIsOpen(supabase: any): Promise<boolean> {
  return (await publishedCreatorCount(supabase)) >= EXPLORE_MIN_CREATORS;
}
