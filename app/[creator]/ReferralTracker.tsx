"use client";
import { useEffect } from "react";

export default function ReferralTracker({ creatorHandle }: { creatorHandle: string }) {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref || ref !== creatorHandle) return;
    // Store in cookie for 30 days
    document.cookie = `spotlightly_sub_ref=${encodeURIComponent(creatorHandle)}; path=/; max-age=${60*60*24*30}; SameSite=Lax`;
    // Fire referral record
    fetch("/api/referrals/subscriber", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrerHandle: creatorHandle }),
    }).catch(() => {});
  }, [creatorHandle]);
  return null;
}
