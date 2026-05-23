import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/onboarding", "/account", "/api/"] },
    ],
    sitemap: "https://spotlightly.app/sitemap.xml",
  };
}
