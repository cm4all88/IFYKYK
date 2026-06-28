/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@remotion/player", "remotion", "@remotion/google-fonts"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "Spotlightly.b-cdn.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.b-cdn.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.bunnycdn.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
