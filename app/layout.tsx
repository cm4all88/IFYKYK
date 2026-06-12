import "./design.css";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Spotlightly", template: "%s · Spotlightly" },
  description: "Your work. Your moment. Your money.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app"),
  openGraph: {
    type: "website",
    siteName: "Spotlightly",
    images: [{ url: "/hero-bg.jpg", width: 1920, height: 1080 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
