"use client";
import { useState } from "react";
import { InlineError } from "./InlineError";

interface Props {
  postId: string;
  price: number | null;
  viewerUserId: string | null;
}

export default function UnlockButton({ postId, price, viewerUserId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    if (!viewerUserId) {
      window.location.href = `/login?return=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setError(null);
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
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  const label = price
    ? `Unlock for $${Number(price).toFixed(2)}`
    : "Unlock";

  return (
    <>
      <button
        onClick={handleUnlock}
        disabled={loading}
        className="btn btn--primary cp-gate-btn"
      >
        {loading ? "Loading…" : label}
      </button>
      <InlineError message={error} />
    </>
  );
}
