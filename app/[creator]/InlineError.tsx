"use client";

// A quiet inline error message used in place of jarring browser alert() popups on the
// fan-facing action buttons (subscribe, tip, unlock, checkout, donate).
export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        marginTop: 8,
        fontSize: 12.5,
        lineHeight: 1.5,
        color: "#f87171",
        background: "rgba(248,113,113,0.08)",
        border: "1px solid rgba(248,113,113,0.2)",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      {message}
    </div>
  );
}
