import { createClient } from "@/lib/supabase-server";
import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import ExploreClient from "./ExploreClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Creators · Spotlightly",
  description: "Discover creators on Spotlightly.",
};

export default async function ExplorePage() {
  const supabase = await createClient();

  // Load initial creators — newest first
  const { data: creators } = await (supabase as any)
    .from("creator_profiles")
    .select("id, handle, display_name, bio, avatar_url, subscription_price, tags, location_city, location_country")
    .eq("kind", "spotlight")
    .not("onboarding_completed_at", "is", null)
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
