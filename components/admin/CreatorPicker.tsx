"use client";

import React, { useEffect, useRef, useState } from "react";

type Creator = { id: string; display_name: string; handle: string; avatar_url?: string };

function Thumb({ c }: { c: { display_name: string; avatar_url?: string } }) {
  if (c.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={c.avatar_url}
        alt=""
        style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  const initial = (c.display_name || "?").trim().charAt(0).toUpperCase();
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "rgba(245,200,66,0.18)",
        color: "#f5c842",
        display: "grid",
        placeItems: "center",
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
}

// Custom dropdown so each creator can show a thumbnail (native <select> cannot).
export default function CreatorPicker({
  creators,
  value,
  onChange,
  loading,
}: {
  creators: Creator[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = creators.find((c) => c.id === value);
  const filtered = q
    ? creators.filter((c) => (c.display_name + " " + c.handle).toLowerCase().includes(q.toLowerCase()))
    : creators;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="adm-input"
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}
      >
        {selected ? (
          <Thumb c={selected} />
        ) : (
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {loading ? "Loading..." : selected ? `${selected.display_name} (${selected.handle})` : "Select a creator..."}
        </span>
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            maxHeight: 360,
            overflow: "auto",
          }}
        >
          <div style={{ padding: 8, position: "sticky", top: 0, background: "#111118", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <input
              autoFocus
              className="adm-input"
              placeholder="Search creators..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: "12px 14px", color: "#9a9aa2", fontSize: 13 }}>No matches</div>
          ) : null}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setOpen(false);
                setQ("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 12px",
                background: c.id === value ? "rgba(245,200,66,0.10)" : "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                color: "#e8e8f0",
              }}
            >
              <Thumb c={c} />
              <span style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.display_name}</span>
                <span style={{ fontSize: 11, color: "#9a9aa2" }}>{c.handle}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
