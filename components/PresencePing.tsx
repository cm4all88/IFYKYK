"use client";

import { useEffect } from "react";

// Fires once on mount so the server can record the current IP / location / device
// from the request headers. Non-blocking; failures are ignored.
export default function PresencePing() {
  useEffect(() => { fetch("/api/track/presence", { method: "POST" }).catch(() => {}); }, []);
  return null;
}
