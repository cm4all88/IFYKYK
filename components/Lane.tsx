"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

// The Spotlightly lane: a horizontal, center-snap row where the card in the
// middle sits in the light (lifted, full size) and its neighbors set back
// (smaller, dimmed) and peek in from the sides. Two motions only, both
// functional: the snap is navigation, the lift is focus. Honors reduced motion.
//
// Reused across surfaces via a render prop, so every lane on the site shares
// one behavior and feel.
export default function Lane<T>({
  items,
  renderItem,
  cardWidth = 340,
  cardHeight,
  gap = 16,
  title,
  ariaLabel,
  getKey,
  onActiveChange,
}: {
  items: T[];
  renderItem: (item: T, ctx: { isActive: boolean; index: number }) => React.ReactNode;
  cardWidth?: number;
  cardHeight?: number; // when set, cards are fixed-height with a fade, keeping rows uniform
  gap?: number;
  title?: React.ReactNode;
  ariaLabel?: string;
  getKey?: (item: T, index: number) => string | number;
  onActiveChange?: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(m.matches);
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, []);

  const setActive = useCallback(
    (i: number) => {
      setActiveIdx(i);
      onActiveChange?.(i);
    },
    [onActiveChange]
  );

  const step = cardWidth + gap;

  const scrollTo = useCallback(
    (idx: number) => {
      const c = Math.max(0, Math.min(idx, items.length - 1));
      setActive(c);
      trackRef.current?.scrollTo({ left: c * step, behavior: reduce ? "auto" : "smooth" });
    },
    [items.length, step, reduce, setActive]
  );

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const i = Math.round(e.currentTarget.scrollLeft / step);
    if (i !== activeIdx) setActive(i);
  };

  const mono = "var(--font-mono, 'DM Mono', monospace)";
  const sidePad = `calc(50% - ${cardWidth / 2}px)`;

  if (items.length === 0) return null;

  const arrow = (side: "left" | "right", disabled: boolean): React.CSSProperties => ({
    position: "absolute",
    top: "42%",
    transform: "translateY(-50%)",
    ...(side === "left" ? { left: 8 } : { right: 8 }),
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: disabled ? "rgba(255,255,255,0.2)" : "#fff",
    fontSize: 20,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    backdropFilter: "blur(4px)",
  });

  return (
    <section aria-label={ariaLabel} style={{ position: "relative" }}>
      {title != null && (
        <div
          style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--muted)",
            textAlign: "center",
            padding: "0 0 4px",
          }}
        >
          {title}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <div
          ref={trackRef}
          onScroll={onScroll}
          style={{
            display: "flex",
            alignItems: cardHeight ? "stretch" : "flex-start",
            gap,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            padding: "32px 0 40px",
            scrollBehavior: reduce ? "auto" : "smooth",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ flexShrink: 0, width: sidePad }} aria-hidden />

          {items.map((item, i) => {
            const isActive = activeIdx === i;
            return (
              <div
                key={getKey ? getKey(item, i) : i}
                onClick={() => { if (!isActive) scrollTo(i); }}
                style={{
                  flexShrink: 0,
                  width: cardWidth,
                  height: cardHeight,
                  scrollSnapAlign: "center",
                  position: "relative",
                  borderRadius: 16,
                  overflow: cardHeight ? "hidden" : "visible",
                  cursor: isActive ? "default" : "pointer",
                  transform: reduce ? "none" : isActive ? "translateY(-4px) scale(1.04)" : "scale(0.9)",
                  transition: reduce
                    ? "none"
                    : "transform 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease, box-shadow 0.45s ease",
                  opacity: isActive ? 1 : 0.5,
                  boxShadow: isActive
                    ? "0 30px 80px rgba(0,0,0,0.55)"
                    : "0 8px 24px rgba(0,0,0,0.3)",
                  willChange: "transform",
                }}
                onMouseEnter={
                  reduce
                    ? undefined
                    : (e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = "translateY(-8px) scale(1.05)";
                        el.style.opacity = "1";
                      }
                }
                onMouseLeave={
                  reduce
                    ? undefined
                    : (e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = isActive ? "translateY(-4px) scale(1.04)" : "scale(0.9)";
                        el.style.opacity = isActive ? "1" : "0.5";
                      }
                }
              >
                {/* Inactive cards are preview-only; the first click centers them. */}
                <div style={{ height: "100%", pointerEvents: isActive ? "auto" : "none" }}>
                  {renderItem(item, { isActive, index: i })}
                </div>

                {/* Bottom fade for fixed-height cards so clipped content reads as intentional. */}
                {cardHeight && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 64,
                      background: "linear-gradient(transparent, var(--bg, #0C0C10))",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            );
          })}

          <div style={{ flexShrink: 0, width: sidePad }} aria-hidden />
        </div>

        {items.length > 1 && (
          <>
            <button aria-label="Previous" onClick={() => scrollTo(activeIdx - 1)} disabled={activeIdx === 0} style={arrow("left", activeIdx === 0)}>
              ‹
            </button>
            <button aria-label="Next" onClick={() => scrollTo(activeIdx + 1)} disabled={activeIdx === items.length - 1} style={arrow("right", activeIdx === items.length - 1)}>
              ›
            </button>
          </>
        )}
      </div>

      {items.length > 1 && items.length <= 24 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 6 }}>
          {items.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to item ${i + 1}`}
              onClick={() => scrollTo(i)}
              style={{
                width: activeIdx === i ? 24 : 6,
                height: 6,
                borderRadius: 3,
                background: activeIdx === i ? "var(--accent)" : "rgba(255,255,255,0.2)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
