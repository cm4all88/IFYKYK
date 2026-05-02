import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.bunnycdn.com" },
      { protocol: "https", hostname: "*.b-cdn.net" },
    ],
  },
  async rewrites() {
    // Rewrite jadecuts.spotlightly.app → spotlightly.app/c/jadecuts
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "(?<creator>[^.]+)\\.spotlightly\\.app" }],
        destination: "/c/:creator/:path*",
      },
    ];
  },
};

export default nextConfig;
