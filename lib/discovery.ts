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

/** Published, handled, spotlight-kind creators. The ones a visitor could actually browse. */
export async function publishedCreatorCount(supabase: any): Promise<number> {
  const { count } = await supabase
    .from("creator_profiles")
    .select("id", { count: "exact", head: true })
    .eq("kind", "spotlight")
    .eq("published", true)
    .not("handle", "is", null);
  return count ?? 0;
}

export async function exploreIsOpen(supabase: any): Promise<boolean> {
  return (await publishedCreatorCount(supabase)) >= EXPLORE_MIN_CREATORS;
}
