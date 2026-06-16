"use client";
import { useState } from "react";

export default function ClaimLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `https://www.spotlightly.app/claim/${code}`;
  return (
    <button
      type="button"
      className="adm-btn adm-btn--ghost"
      style={{ padding: "5px 12px" }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
      }}
    >
      {copied ? "Copied" : "Copy claim link"}
    </button>
  );
}
