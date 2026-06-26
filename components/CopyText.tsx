"use client";

import { useState } from "react";

// Small "copy to clipboard" button for admin link lists.
export default function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="adm-btn adm-btn--ghost"
      style={{ padding: "3px 9px", fontSize: 11 }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); } catch {}
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
