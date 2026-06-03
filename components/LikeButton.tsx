"use client";

import { useState } from "react";

export default function LikeButton({
  postId,
  initialCount,
  initialLiked = false,
  size = "md",
}: {
  postId: string;
  initialCount: number;
  initialLiked?: boolean;
  size?: "sm" | "md";
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount || 0);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);

    const next = !liked;
    // optimistic
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));

    try {
      const res = await fetch("/api/posts/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(!!data.liked);
      setCount(data.count ?? 0);
    } catch {
      // revert on failure
      setLiked(liked);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  const px = size === "sm" ? 13 : 15;

  return (
    <button
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: size === "sm" ? "4px 6px" : "6px 8px",
        color: liked ? "var(--accent, #F2B84B)" : "rgba(255,255,255,0.45)",
        transition: "color 0.15s, transform 0.1s",
        fontFamily: "inherit",
      }}
      onMouseDown={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)")}
      onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
    >
      <span style={{ fontSize: px + 3, lineHeight: 1 }}>{liked ? "♥" : "♡"}</span>
      <span style={{ fontSize: px, fontWeight: 500, minWidth: 8 }}>{count > 0 ? count : ""}</span>
    </button>
  );
}
