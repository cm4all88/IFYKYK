import { createClient } from "@/lib/supabase-server";
import type { Metadata } from "next";
import CreatorWorld from "./CreatorWorld";
import { isUnclaimedPreview } from "@/lib/claim";

export const dynamic = "force-dynamic";

// ONE creator page for everyone. The whole render lives in CreatorWorld:
// creator first, feed as the spine, support (campaign + community as peers)
// only after the work. There is no second route and no campaign-takeover mode.

async function lightProfile(handle: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_profiles")
    .select("display_name, handle, bio, cover_url, deleted_at, published, claimed_at")
    .eq("kind", "spotlight").eq("handle", handle).maybeSingle();
  if (!data || (data as any).deleted_at) return null;
  return data as any;
}


export async function generateMetadata(props: {
  params: Promise<{ creator: string }>;
}): Promise<Metadata> {
  const { creator } = await props.params;
  const p = await lightProfile(creator);
  if (!p) return { title: "Not found · Spotlightly" };
  const name = p.display_name ?? p.handle;
  const preview = isUnclaimedPreview(p);
  return {
    title: `${name} · Spotlightly`,
    description: p.bio ?? `Follow ${name} on Spotlightly`,
    // No indexing, no link equity, and no rich preview card for a page the
    // person it depicts has not claimed.
    robots: preview ? { index: false, follow: false } : undefined,
    openGraph: preview
      ? undefined
      : {
          title: name,
          description: p.bio ?? "",
          images: p.cover_url ? [p.cover_url] : [],
        },
  };
}

export default async function CreatorPage(props: {
  params: Promise<{ creator: string }>;
}) {
  const { creator } = await props.params;
  return <CreatorWorld handle={creator} />;
}
