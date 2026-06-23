import { normalizeCategory, normalizeCondition } from "@/lib/import-core";

// Shared by every import route so a draft row is written identically no matter
// the source. Drafts are status='draft' (never public) until the creator approves.

export async function resolveSpotlightProfile(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null as any, profile: null as any };
  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("kind", "spotlight")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, profile };
}

export type DraftInput = {
  title: string;
  description?: string | null;
  price: number;
  brand?: string | null;
  category?: string | null;
  size?: string | null;
  condition?: string | null;
  sourceUrl?: string | null;
};

export async function insertDraft(
  supabase: any,
  args: {
    creatorProfileId: string;
    importRunId: string;
    source: string;
    sourceUsername?: string | null;
    listing: DraftInput;
    images: string[];
    needsReview?: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const price = Math.max(Number(args.listing.price) || 0, 1); // column requires >= 1
  const { error } = await supabase.from("marketplace_listings").insert({
    creator_profile_id: args.creatorProfileId,
    title: (args.listing.title || "Untitled item").slice(0, 140),
    description: args.listing.description ?? null,
    price_usd: price,
    condition: normalizeCondition(args.listing.condition),
    category: normalizeCategory(args.listing.category),
    images: args.images,
    brand: args.listing.brand ?? null,
    size: args.listing.size ?? null,
    source_platform: args.source,
    source_username: args.sourceUsername ?? null,
    source_url: args.listing.sourceUrl ?? null,
    needs_photos: args.images.length === 0,
    needs_review: args.needsReview ?? false,
    status: "draft",
    import_run_id: args.importRunId,
    imported_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
