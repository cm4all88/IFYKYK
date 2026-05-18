"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const initial = saved ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(initial);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      style={{
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-2)",
        padding: "7px 10px",
        cursor: "pointer",
        color: "var(--muted)",
        fontSize: "14px",
        lineHeight: 1,
        transition: "border-color 0.15s, color 0.15s",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
      }}
    >
      {theme === "dark" ? "☀" : "◑"}
    </button>
  );
}
