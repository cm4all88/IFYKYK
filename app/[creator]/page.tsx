import { createClient } from "@/lib/supabase-server";
import type { Metadata } from "next";
import CreatorWorld from "./CreatorWorld";

export const dynamic = "force-dynamic";

// ONE creator page for everyone. The whole render lives in CreatorWorld:
// creator first, feed as the spine, support (campaign + community as peers)
// only after the work. There is no second route and no campaign-takeover mode.

async function lightProfile(handle: string) {
  const supabase = await createClient();
  // `creator_public` is the safe projection (lib/creator-public.ts). It excludes
  // claim_code, claim state, date_of_birth, IP tracking, shipping fields and
  // Stripe identifiers, and filters soft-deleted rows itself — so the old
  // `deleted_at` guard now lives in SQL.
  const { data } = await (supabase as any)
    .from("creator_public")
    .select("display_name, handle, bio, cover_url, published")
    .eq("kind", "spotlight").eq("handle", handle).maybeSingle();
  return (data as any) ?? null;
}


export async function generateMetadata(props: {
  params: Promise<{ creator: string }>;
}): Promise<Metadata> {
  const { creator } = await props.params;
  const p = await lightProfile(creator);
  if (!p) return { title: "Not found · Spotlightly" };
  const name = p.display_name ?? p.handle;
  // Previously `isUnclaimedPreview({ published, claimed_at })`, which needed
  // claim state — deliberately not public any more. `published !== true` is a
  // strict superset: unclaimed pages are never published, so everything the old
  // check noindexed is still noindexed, plus claimed-but-unpublished pages,
  // which should not be indexed either. No page loses indexing it used to have.
  const preview = p.published !== true;
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
