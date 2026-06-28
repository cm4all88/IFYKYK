/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@remotion/player', 'remotion', '@remotion/google-fonts'],
  // The studio previews videos in the browser; no server rendering of video.
  reactStrictMode: true,
};

export default nextConfig;
