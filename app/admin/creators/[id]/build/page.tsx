import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase-server";
import BuildClient from "./BuildClient";

export const dynamic = "force-dynamic";

export default async function BuildPage(props: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) notFound();
  const { id } = await props.params;
  const admin = await createServiceClient();

  const { data: creator } = await (admin as any)
    .from("creator_profiles")
    .select("id, handle, display_name, bio, avatar_url, cover_url, subscription_price, published, social_links, wishlist_url, claim_code, claimed_at, free_tier_name, free_tier_blurb, free_tier_perks")
    .eq("id", id)
    .maybeSingle();
  if (!creator) notFound();

  const { data: posts } = await (admin as any)
    .from("posts")
    .select("id, caption, media_url, media_type, created_at")
    .eq("creator_profile_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: picks } = await (admin as any)
    .from("affiliate_picks")
    .select("id, label, url, image_url, note")
    .eq("creator_profile_id", id)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });

  const { data: socialPosts } = await (admin as any)
    .from("social_posts")
    .select("id, url, platform")
    .eq("creator_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: tiers } = await (admin as any)
    .from("subscription_tiers")
    .select("id, name, description, price_monthly, price_yearly, perks")
    .eq("creator_profile_id", id)
    .order("sort_order", { ascending: true });

  return (
    <BuildClient
      creator={creator}
      initialPosts={posts || []}
      initialPicks={picks || []}
      initialSocialPosts={socialPosts || []}
      initialTiers={tiers || []}
    />
  );
}
