import "./design.css";
import type { Metadata } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: "Spotlightly — Keep what you earn", template: "%s · Spotlightly" },
  description:
    "The creator platform where you keep what you earn — subscriptions, exclusive posts, and tips, paid to you directly. Spotlightly doesn't take a cut of your subscriptions.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Spotlightly",
    title: "Spotlightly — Keep what you earn",
    description:
      "Build a subscription, post what you make, take tips, and get paid directly. Spotlightly doesn't take a cut of your subscriptions.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Spotlightly" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spotlightly — Keep what you earn",
    description: "The creator platform where you keep what you earn.",
    images: ["/og.png"],
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Spotlightly",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
    },
    {
      "@type": "WebSite",
      name: "Spotlightly",
      url: SITE_URL,
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
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
