import type { Metadata } from "next";
import GuideClient from "./GuideClient";

export const metadata: Metadata = {
  title: "Creator Guide · Spotlightly",
  description: "Set up your Spotlightly presence and start earning. Step by step.",
};

export default function GuidePage() {
  return <GuideClient />;
}
