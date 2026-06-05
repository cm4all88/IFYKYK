"use client";

import { useState } from "react";
import SocialPostCard from "@/components/SocialPostCard";

export default function SocialPostsGrid({ posts, initial = 6 }: { posts: any[]; initial?: number }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? posts : posts.slice(0, initial);
  const extra = posts.length - initial;

  return (
    <>
      <div className="cp-social-grid">
        {visible.map((sp) => (
          <SocialPostCard key={sp.id} post={sp} />
        ))}
      </div>

      {extra > 0 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 12,
            padding: "12px 0",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border, rgba(255,255,255,0.12))",
            borderRadius: 10,
            color: "var(--accent, #F2B84B)",
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          {showAll ? "Show fewer" : `Show all ${posts.length} social posts`}
        </button>
      )}
    </>
  );
}
