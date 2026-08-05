"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A real Instagram post, rendered inline.
 *
 * Why an iframe and not embed.js: embed.js builds this exact same iframe, it just
 * adds a script download and a race we do not control. Going direct lets us listen
 * for Instagram's own MEASURE message and size the frame to the post, which is the
 * thing that was missing before (the container sat at a fixed height and the post
 * floated in a void).
 *
 * This runs in the visitor's browser, so Instagram's datacenter IP blocking never
 * applies. Public post on a public account renders.
 *
 * Failure is honest, not silent. If no MEASURE arrives inside the timeout, the
 * frame never loaded (blocked by an extension, offline, IG down). If MEASURE comes
 * back short, Instagram rendered its own "unavailable" stub instead of the post
 * (private account, deleted post, profile url rather than a post url). Both call
 * onFail so the card can show a link instead of a broken white box.
 */

const REAL_POST_MIN_HEIGHT = 420; // IG's unavailable stub measures well under this
const LOAD_TIMEOUT_MS = 6500;
const MAX_FRAME_HEIGHT = 640; // keeps one tall reel from dwarfing the lane

export function igShortcode(url: string): { code: string; kind: "p" | "reel" } | null {
  const m = (url || "").match(/instagram\.com\/(?:([a-z0-9_.]+)\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/i);
  if (!m) return null;
  const seg = m[2].toLowerCase();
  return { code: m[3], kind: seg === "reel" || seg === "reels" ? "reel" : "p" };
}

export default function IgPostEmbed({
  url,
  onFail,
}: {
  url: string;
  onFail: () => void;
}) {
  const parsed = igShortcode(url);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const measured = useRef(false);

  useEffect(() => {
    if (!parsed) {
      onFail();
      return;
    }

    const onMessage = (e: MessageEvent) => {
      if (!/(^|\.)instagram\.com$/.test(new URL(e.origin).hostname)) return;
      if (frameRef.current && e.source !== frameRef.current.contentWindow) return;

      let payload: any = e.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (!payload || payload.type !== "MEASURE") return;

      const h = Number(payload?.details?.height);
      if (!Number.isFinite(h) || h <= 0) return;

      measured.current = true;
      // A short measurement means IG served its own unavailable card, not the post.
      if (h < REAL_POST_MIN_HEIGHT) {
        onFail();
        return;
      }
      setHeight(h);
    };

    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(() => {
      if (!measured.current) onFail();
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [url, parsed, onFail]);

  if (!parsed) return null;

  const src = `https://www.instagram.com/${parsed.kind}/${parsed.code}/embed/captioned/`;
  const frameHeight = height ?? 560;
  const clipped = height != null && height > MAX_FRAME_HEIGHT;

  return (
    <div
      style={{
        position: "relative",
        background: "#fff",
        // Hidden until measured so the visitor never sees a half drawn frame settle.
        opacity: height == null ? 0 : 1,
        transition: "opacity 0.25s ease",
        maxHeight: MAX_FRAME_HEIGHT,
        overflow: "hidden",
      }}
    >
      <iframe
        ref={frameRef}
        src={src}
        title="Instagram post"
        loading="lazy"
        scrolling="no"
        allow="encrypted-media; clipboard-write; picture-in-picture"
        allowTransparency
        style={{ display: "block", width: "100%", height: frameHeight, border: 0, background: "#fff" }}
      />

      {clipped && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 72,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 0 10px",
            background: "linear-gradient(rgba(255,255,255,0), #fff 62%)",
            textDecoration: "none",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#E1306C",
            fontWeight: 600,
          }}
        >
          Read on Instagram ↗
        </a>
      )}
    </div>
  );
}
