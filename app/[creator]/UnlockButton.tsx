"use client";
import { useState } from "react";

interface Props {
  postId: string;
  price: number | null;
  viewerUserId: string | null;
}

export default function UnlockButton({ postId, price, viewerUserId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleUnlock() {
    if (!viewerUserId) {
      window.location.href = `/login?return=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setLoading(true);
    const res = await fetch("/api/posts/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  const label = price
    ? `Unlock for $${Number(price).toFixed(2)}`
    : "Unlock";

  return (
    <button
      onClick={handleUnlock}
      disabled={loading}
      className="btn btn--primary cp-gate-btn"
    >
      {loading ? "Loading…" : label}
    </button>
  );
}
