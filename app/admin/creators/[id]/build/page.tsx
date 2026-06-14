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
    .select("id, handle, display_name, bio, avatar_url, cover_url, subscription_price, published")
    .eq("id", id)
    .maybeSingle();
  if (!creator) notFound();

  const { data: posts } = await (admin as any)
    .from("posts")
    .select("id, caption, media_url, media_type, created_at")
    .eq("creator_profile_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return <BuildClient creator={creator} initialPosts={posts || []} />;
}
