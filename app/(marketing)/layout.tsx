import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spotlightly — Your work. Your moment. Your money.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {children}
    </div>
  );
}
