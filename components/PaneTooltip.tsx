"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TIPS: Record<string, { title: string; body: string; cta?: string; ctaHref?: string }> = {
  overview: {
    title: "Welcome to your dashboard",
    body: "This is your home base. Your subscriber count, earnings, and quick actions all live here. Start by connecting Stripe so fans can pay you.",
    cta: "Connect Stripe →",
    ctaHref: "/dashboard?pane=payments",
  },
  profile: {
    title: "Your profile is your stage",
    body: "Add an avatar, cover image, and bio. Tell fans exactly what they get when they subscribe. Your public page URL is spotlightly.app/c/your-handle.",
  },
  posts: {
    title: "Free posts build audience. Paid posts build income.",
    body: "Start with 2–3 free posts so new visitors see real content. Then add premium posts for subscribers. Mix both consistently.",
    cta: "Read posting guide →",
    ctaHref: "/guide#posts",
  },
  channels: {
    title: "Channels = your subscription tiers",
    body: "Create a free channel for public content and a paid channel for subscribers. Name paid tiers by what fans get, not the price — 'Behind the Scenes' beats 'Premium'.",
  },
  payments: {
    title: "Connect Stripe before anything else",
    body: "Fans can't subscribe or tip until Stripe is connected. It takes 3–5 minutes. You'll need your bank details and SSN (last 4 digits).",
    cta: "Setup guide →",
    ctaHref: "/guide",
  },
  marketplace: {
    title: "Sell personal items directly to fans",
    body: "Upload photos and a short video of each item. Add a personal note — the story behind it is what makes fans want to buy. You keep 95%.",
  },
  store: {
    title: "Sell digital products — 0% cut",
    body: "Upload any file: presets, PDFs, guides, sample packs, templates. Fans pay once and get a secure download link. Spotlightly takes nothing.",
  },
  analytics: {
    title: "Track what's working",
    body: "Subscriber growth and earnings over 7, 30, or 90 days. Check this weekly — it shows you which posts drive subscriptions.",
  },
  advisor: {
    title: "Your AI monetization advisor",
    body: "Ask it anything about pricing, posting strategy, or which features to use for your specific niche. It knows your subscriber count and content type.",
  },
  live: {
    title: "Go live to your subscribers",
    body: "Stream from your browser instantly, or use OBS for a professional setup. Live streams are saved as VODs automatically.",
    cta: "OBS setup guide →",
    ctaHref: "/guide",
  },
  refer: {
    title: "Earn credits by referring creators",
    body: "Every 5 creators who sign up through your link = $29 credit toward your monthly fee. Share your referral link in your creator communities.",
  },
  billing: {
    title: "Your platform subscription",
    body: "You're on a 30-day free trial. After that, your fee is based on subscriber count — Starter $29/mo up to 100 subscribers. No percentage of your earnings, ever.",
  },
  settings: {
    title: "Account settings",
    body: "Update your email, password, and account preferences here. Notification preferences let you control what emails Spotlightly sends you.",
  },
};

export default function PaneTooltip({ pane }: { pane: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `tip_dismissed_${pane}`;
    const dismissed = localStorage.getItem(key);
    if (!dismissed) setVisible(true);
  }, [pane]);

  function dismiss() {
    localStorage.setItem(`tip_dismissed_${pane}`, "1");
    setVisible(false);
  }

  const tip = TIPS[pane];
  if (!visible || !tip) return null;

  const mono = "var(--font-mono, DM Mono, monospace)";
  const serif = "var(--font-serif, Cormorant Garamond, Georgia, serif)";

  return (
    <div style={{
      background: "rgba(240,180,41,0.05)",
      border: "1px solid rgba(240,180,41,0.2)",
      borderLeft: "3px solid var(--accent, #F0B429)",
      borderRadius: "var(--r-3, 6px)",
      padding: "20px 24px",
      marginBottom: "var(--s-6, 24px)",
      display: "flex",
      gap: 16,
      alignItems: "flex-start",
    }}>
      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>✦</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--accent, #F0B429)", marginBottom: 6 }}>
          {tip.title}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-soft, #a1a1aa)", lineHeight: 1.65, margin: 0 }}>
          {tip.body}
        </p>
        {tip.cta && tip.ctaHref && (
          <Link href={tip.ctaHref} style={{ display: "inline-block", marginTop: 10, fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent, #F0B429)", textDecoration: "none" }}>
            {tip.cta}
          </Link>
        )}
      </div>
      <button
        onClick={dismiss}
        style={{ background: "none", border: "none", color: "var(--muted, #71717a)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
