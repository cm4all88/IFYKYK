"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    instgrm?: { Embeds?: { process: () => void } };
  }
}

// Renders a real Instagram post inline using Instagram's official embed.js. This runs
// in the visitor's browser (not on the server), so it shows the actual image and
// caption for public posts. Instagram itself renders an "unavailable" state only if the
// post is private, removed, or the url is a profile rather than a single post.
export function InstagramEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    const process = () => {
      try {
        window.instgrm?.Embeds?.process();
      } catch {
        /* noop */
      }
    };
    if (window.instgrm?.Embeds) {
      process();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-ig-embed="1"]');
    if (existing) {
      existing.addEventListener("load", process);
      return () => existing.removeEventListener("load", process);
    }
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    s.dataset.igEmbed = "1";
    s.addEventListener("load", process);
    document.body.appendChild(s);
  }, [url]);

  return (
    <div style={{ background: "#fff" }}>
      <blockquote
        ref={ref}
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ background: "#fff", border: 0, margin: 0, padding: 0, width: "100%", minWidth: 260 }}
      />
    </div>
  );
}
