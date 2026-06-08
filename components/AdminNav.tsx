"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin",              label: "Overview",       icon: "◈" },
  { href: "/admin/roadmap",      label: "Roadmap",        icon: "◉" },
  { href: "/admin/credentials",  label: "Credentials",    icon: "⚿" },
  { href: "/admin/flags",        label: "Feature Flags",  icon: "⚑" },
  { href: "/admin/creators",     label: "Creators",       icon: "✦" },
  { href: "/admin/subscriptions",label: "Subscriptions",  icon: "↻" },
  { href: "/admin/subscribers",  label: "Subscribers",    icon: "☻" },
  { href: "/admin/coupons",      label: "Coupons",        icon: "◎" },
  { href: "/admin/comms",        label: "Comms",          icon: "✉" },
  { href: "/admin/moderation",   label: "Moderation",     icon: "⚐" },
  { href: "/admin/ads",          label: "Featured / Ads", icon: "★" },
];

export default function AdminNav() {
  const path = usePathname();

  return (
    <nav className="adm-nav">
      <div className="adm-nav-brand">
        Spot<span>light</span>ly
        <em>admin</em>
      </div>

      <ul className="adm-nav-list">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? path === "/admin"
              : path.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`adm-nav-link ${active ? "active" : ""}`}
              >
                <span className="adm-nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="adm-nav-footer">
        <Link href="/dashboard" className="adm-nav-exit">
          ← Back to dashboard
        </Link>
      </div>

      <style>{`
        .adm-nav {
          width: 220px;
          min-height: 100vh;
          background: #0d0d14;
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          padding: 0;
          flex-shrink: 0;
        }
        .adm-nav-brand {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px;
          font-weight: 300;
          color: #fff;
          padding: 28px 24px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          line-height: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .adm-nav-brand span { color: #f5c842; }
        .adm-nav-brand em {
          font-style: normal;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
        }
        .adm-nav-list {
          list-style: none;
          padding: 12px 0;
          flex: 1;
        }
        .adm-nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 24px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 300;
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          transition: all 0.15s;
          border-left: 2px solid transparent;
        }
        .adm-nav-link:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.03); }
        .adm-nav-link.active {
          color: #f5c842;
          border-left-color: #f5c842;
          background: rgba(245,200,66,0.05);
        }
        .adm-nav-icon {
          font-size: 12px;
          width: 16px;
          text-align: center;
          flex-shrink: 0;
        }
        .adm-nav-footer {
          padding: 16px 24px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .adm-nav-exit {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.25);
          text-decoration: none;
        }
        .adm-nav-exit:hover { color: rgba(255,255,255,0.5); }
      `}</style>
    </nav>
  );
}
