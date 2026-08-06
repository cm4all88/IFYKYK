"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A real Instagram post, rendered inline.
 *
 * Why an iframe and not embed.js: embed.js builds this exact same iframe, it just
 * adds a script download and a race we do not control. Going direct lets us listen
 * for Instagram's own MEASURE message and size the frame to the post.
 *
 * This runs in the visitor's browser, so Instagram's datacenter IP blocking never
 * applies. Public post on a public account renders.
 *
 * Three things that were wrong the first time and are worth not repeating:
 *
 *  1. loading="lazy" inside a horizontally scrolling lane meant the frame often
 *     did not start loading for a long time, or at all. It loads eagerly now.
 *  2. The failure timer started on mount, so it could expire before the frame had
 *     even begun loading and permanently swap in the fallback. It starts on load.
 *  3. The container reserved height while waiting, which drew an empty box. It
 *     now occupies zero height until Instagram reports the real one.
 */

const REAL_POST_MIN_HEIGHT = 380; // IG's "unavailable" stub measures well under this
const LOAD_TIMEOUT_MS = 8000;
// Backstop from mount. onLoad does not fire at all when the frame is blocked
// outright (extension, CSP, network), and without this the card sits at zero
// height forever with no fallback and no way to recover.
const HARD_TIMEOUT_MS = 12000;
// How long to wait after the last MEASURE before deciding the post is done
// growing and judging whether it is real.
const SETTLE_MS = 2500;
const MAX_FRAME_HEIGHT = 640; // keeps one tall reel from dwarfing the lane
const PROBE_HEIGHT = 900; // generous working height; the frame reports its own

export function igShortcode(url: string): { code: string; kind: "p" | "reel" } | null {
  const m = (url || "").match(/instagram\.com\/(?:[a-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/i);
  if (!m) return null;
  const seg = m[1].toLowerCase();
  return { code: m[2], kind: seg === "reel" || seg === "reels" ? "reel" : "p" };
}

export default function IgPostEmbed({ url, onFail }: { url: string; onFail: () => void }) {
  const parsed = igShortcode(url);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const settled = useRef(false);
  const timerRef = useRef<number | null>(null);
  const settleRef = useRef<number | null>(null);
  const maxHeight = useRef(0);

  const fail = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onFail();
  }, [onFail]);

  // Only start counting once the frame has actually begun loading. A lane card
  // scrolled out of view can sit unloaded for a long time and that is not a failure.
  const onFrameLoad = useCallback(() => {
    if (settled.current || timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      if (maxHeight.current === 0) fail();
    }, LOAD_TIMEOUT_MS);
  }, [fail]);

  useEffect(() => {
    if (!parsed) {
      onFail();
      return;
    }

    const onMessage = (e: MessageEvent) => {
      if (settled.current) return;

      // Some senders post with an opaque or malformed origin. Never let parsing
      // one unrelated message throw inside the listener.
      let host = "";
      try {
        host = new URL(e.origin).hostname;
      } catch {
        return;
      }
      if (!/(^|\.)instagram\.com$/.test(host)) return;
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

      // Instagram sends several MEASURE messages as the post lays out, and the
      // first is small because the image and caption have not landed yet.
      // Treating that first small number as the unavailable stub is what killed
      // working posts. Take every measurement, keep the largest, and only judge
      // whether it is a real post after it stops growing.
      maxHeight.current = Math.max(maxHeight.current, h);
      setHeight(maxHeight.current);

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (settleRef.current !== null) window.clearTimeout(settleRef.current);
      settleRef.current = window.setTimeout(() => {
        if (settled.current) return;
        if (maxHeight.current < REAL_POST_MIN_HEIGHT) {
          // Still tiny after it stopped changing. This really is IG's stub.
          fail();
        } else {
          settled.current = true;
        }
      }, SETTLE_MS);
    };

    window.addEventListener("message", onMessage);
    const hardTimer = window.setTimeout(() => {
      // Only a frame that never measured anything at all is a failure.
      if (maxHeight.current === 0) fail();
    }, HARD_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(hardTimer);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    };
  }, [url, parsed, onFail, fail]);

  if (!parsed) return null;

  const src = `https://www.instagram.com/${parsed.kind}/${parsed.code}/embed/captioned/`;
  const shown = height != null;
  const boxHeight = shown ? Math.min(height as number, MAX_FRAME_HEIGHT) : 0;
  const clipped = shown && (height as number) > MAX_FRAME_HEIGHT;

  return (
    <div
      style={{
        position: "relative",
        // Zero height until Instagram reports the real one, so a frame that never
        // arrives leaves no empty box behind it.
        height: boxHeight,
        overflow: "hidden",
        background: shown ? "#fff" : "transparent",
        transition: "height 0.2s ease",
      }}
    >
      <iframe
        ref={frameRef}
        src={src}
        title="Instagram post"
        onLoad={onFrameLoad}
        scrolling="no"
        allow="encrypted-media; clipboard-write; picture-in-picture"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "block",
          width: "100%",
          height: shown ? Math.max(height as number, PROBE_HEIGHT) : PROBE_HEIGHT,
          border: 0,
          background: "#fff",
        }}
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
