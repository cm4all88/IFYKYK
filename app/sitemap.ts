import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/site";
import NICHES from "@/lib/niches";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data: creators } = await (supabase as any)
    .from("creator_profiles")
    .select("handle, updated_at")
    .eq("kind", "spotlight")
    .not("onboarding_completed_at", "is", null)
    .limit(1000);

  const now = new Date();

  const creatorUrls = (creators ?? []).map((c: any) => ({
    url: `${SITE_URL}/${c.handle}`,
    lastModified: new Date(c.updated_at ?? Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Niche landing pages — the long-tail SEO surface ("/for/fitness-coaches", etc.)
  const nicheUrls = (NICHES as { slug: string }[]).map((n) => ({
    url: `${SITE_URL}/for/${n.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/for-creators`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/gear`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/music`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  return [...staticUrls, ...nicheUrls, ...creatorUrls];
}
