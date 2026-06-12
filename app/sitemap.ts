import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase-server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data: creators } = await (supabase as any)
    .from("creator_profiles")
    .select("handle, updated_at")
    .eq("kind", "spotlight")
    .not("onboarding_completed_at", "is", null)
    .limit(1000);

  const creatorUrls = (creators ?? []).map((c: any) => ({
    url: `https://spotlightly.app/${c.handle}`,
    lastModified: new Date(c.updated_at ?? Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    { url: "https://spotlightly.app", lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: "https://spotlightly.app/explore", lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: "https://spotlightly.app/gear", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://spotlightly.app/tools", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://spotlightly.app/music", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://spotlightly.app/about", lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: "https://spotlightly.app/pricing", lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: "https://spotlightly.app/terms", lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: "https://spotlightly.app/privacy", lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    ...creatorUrls,
  ];
}
