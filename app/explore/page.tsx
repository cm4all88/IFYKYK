import { createClient } from "@/lib/supabase-server";
import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import ExploreClient from "./ExploreClient";
import { notFound } from "next/navigation";
import { exploreIsOpen } from "@/lib/discovery";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Creators · Spotlightly",
  description: "Discover creators on Spotlightly.",
};

export default async function ExplorePage() {
  const supabase = await createClient();

  // Closed until the roster is big enough to be worth browsing. Reopens by
  // itself once it is; see lib/discovery.ts.
  if (!(await exploreIsOpen(supabase))) notFound();

  // Load initial creators — newest first
  const { data: creators } = await (supabase as any)
    .from("creator_profiles")
    .select("id, handle, display_name, bio, avatar_url, subscription_price, tags, location_city, location_country")
    .eq("kind", "spotlight")
    .eq("published", true)
    .not("handle", "is", null)
    .order("created_at", { ascending: false })
    .limit(48);

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <SiteHeader />
      <ExploreClient initialCreators={creators ?? []} userId={user?.id ?? null} />
      <Footer />
    </>
  );
}
