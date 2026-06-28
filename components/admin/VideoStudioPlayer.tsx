"use client";

import React from "react";
import { Player } from "@remotion/player";
import { MarketingVideo } from "@/components/video/MarketingVideo";
import { buildScenes } from "@/components/video/scenes";
import type { VideoData } from "@/components/video/types";

// Runs the marketing video live in the browser. Client-only, no server render.
export default function VideoStudioPlayer({ data }: { data: VideoData }) {
  const duration = Math.max(
    1,
    buildScenes(data).reduce((a, s) => a + s.durationInFrames, 0)
  );
  return (
    <Player
      component={MarketingVideo as React.FC<Record<string, unknown>>}
      inputProps={data as unknown as Record<string, unknown>}
      durationInFrames={duration}
      fps={30}
      compositionWidth={1080}
      compositionHeight={1920}
      style={{
        width: "100%",
        aspectRatio: "1080 / 1920",
        borderRadius: 8,
        overflow: "hidden",
        background: "#FBFAF7",
      }}
      controls
      loop
    />
  );
}
