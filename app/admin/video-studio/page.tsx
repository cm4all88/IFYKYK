import VideoStudio from "@/components/admin/VideoStudio";

// Admin auth is enforced by app/admin/layout.tsx (isAdmin guard).
export const metadata = { title: "Video Studio . Spotlightly Admin" };

export default function VideoStudioPage() {
  return <VideoStudio />;
}
