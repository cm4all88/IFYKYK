"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RailCreator {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Sub {
  id: string;
  status: string;
  creator: RailCreator | null;
}

interface FanMe {
  subscriptions: Sub[];
  creatorProfile: RailCreator | null;
}

const NAV = [
  { href: "/feed", label: "Your lineup", icon: "◎" },
  { href: "/messages", label: "Messages", icon: "✉" },
  { href: "/account", label: "Account", icon: "○" },
];

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  return (
    <span
      className="arail-avatar"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {url ? <img src={url} alt="" /> : (name?.[0] ?? "?").toUpperCase()}
    </span>
  );
}

export default function AudienceRail({ currentHandle }: { currentHandle: string }) {
  const [me, setMe] = useState<FanMe | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/fan/me");
        if (res.status === 401) {
          if (alive) { setAuthed(false); setLoaded(true); }
          return;
        }
        const data = await res.json();
        if (alive) { setMe(data); setAuthed(true); setLoaded(true); }
      } catch {
        if (alive) { setAuthed(false); setLoaded(true); }
      }
    })();
    return () => { alive = false; };
  }, []);

  // Subscribed creators = the lineup the fan switches between. Dedupe by handle.
  const lineup: RailCreator[] = (() => {
    const out: RailCreator[] = [];
    const seen = new Set<string>();
    for (const s of me?.subscriptions ?? []) {
      const c = s.creator;
      if (!c || s.status !== "active") continue;
      if (seen.has(c.handle)) continue;
      seen.add(c.handle);
      out.push(c);
    }
    return out;
  })();

  const isCreator = !!me?.creatorProfile;

  return (
    <nav className="arail" aria-label="Your Spotlightly">
      <Link href="/" className="brand-logo arail-logo">Spot<span>light</span>ly</Link>

      <div className="arail-nav">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="arail-nav-item">
            <span className="arail-nav-icon">{item.icon}</span>
            <span className="arail-nav-label">{item.label}</span>
          </Link>
        ))}
        {isCreator && (
          <Link href="/dashboard" className="arail-nav-item arail-nav-item--accent">
            <span className="arail-nav-icon">★</span>
            <span className="arail-nav-label">Dashboard</span>
          </Link>
        )}
      </div>

      {/* Lineup of subscribed creators */}
      {loaded && authed && lineup.length > 0 && (
        <div className="arail-lineup">
          <span className="arail-kicker">Following</span>
          <div className="arail-lineup-list">
            {lineup.map((c) => {
              const active = c.handle === currentHandle;
              return (
                <Link
                  key={c.handle}
                  href={`/${c.handle}`}
                  className={`arail-creator${active ? " arail-creator--active" : ""}`}
                  title={c.display_name ?? c.handle}
                >
                  <Avatar url={c.avatar_url} name={c.display_name ?? c.handle} size={32} />
                  <span className="arail-creator-name">{c.display_name ?? c.handle}</span>
                  {active && <span className="arail-here">Here</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Logged-out prompt */}
      {loaded && !authed && (
        <div className="arail-signedout">
          <p className="arail-signedout-text">
            Your lineup lives here — every creator you follow, one tap away.
          </p>
          <Link href={`/fan-signup?return=/${currentHandle}`} className="btn btn--primary btn--small arail-signedout-btn">
            Join free
          </Link>
          <Link href="/login" className="arail-signedout-signin">Sign in</Link>
        </div>
      )}

      <style>{`
        .arail {
          display: flex;
          flex-direction: column;
          gap: 28px;
          position: sticky;
          top: 24px;
          padding: 8px 4px;
        }
        .arail-logo { font-size: 26px; line-height: 1; padding: 0 8px; }

        .arail-nav { display: flex; flex-direction: column; gap: 2px; }
        .arail-nav-item {
          display: flex; align-items: center; gap: 14px;
          padding: 10px 12px; border-radius: var(--r-2);
          text-decoration: none; color: var(--text-faint);
          transition: background var(--t-fast), color var(--t-fast);
        }
        .arail-nav-item:hover { background: rgba(255,255,255,0.04); color: var(--text); }
        .arail-nav-item--accent { color: var(--accent); }
        .arail-nav-icon { font-size: 15px; width: 18px; text-align: center; opacity: 0.8; }
        .arail-nav-label {
          font-family: var(--font-display); font-size: 14px; font-weight: 600; letter-spacing: -0.01em;
        }

        .arail-kicker {
          font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.22em;
          text-transform: uppercase; color: var(--muted-faint);
          display: block; padding: 0 12px; margin-bottom: 12px;
        }
        .arail-lineup-list { display: flex; flex-direction: column; gap: 2px; }
        .arail-creator {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 12px; border-radius: var(--r-2);
          text-decoration: none; transition: background var(--t-fast);
        }
        .arail-creator:hover { background: rgba(255,255,255,0.04); }
        .arail-creator--active { background: var(--accent-soft); }
        .arail-creator-name {
          font-size: 13px; color: var(--text-faint);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
        }
        .arail-creator--active .arail-creator-name { color: var(--text); }
        .arail-here {
          font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--accent); flex-shrink: 0;
        }
        .arail-avatar {
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%; overflow: hidden; flex-shrink: 0;
          background: var(--accent-soft); color: var(--accent);
          font-family: var(--font-serif); border: 1px solid var(--accent-border);
        }
        .arail-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .arail-signedout { padding: 4px 12px; }
        .arail-signedout-text {
          font-size: 13px; color: var(--muted-faint); line-height: 1.6; margin: 0 0 16px;
        }
        .arail-signedout-btn { width: 100%; text-align: center; }
        .arail-signedout-signin {
          display: block; text-align: center; margin-top: 10px;
          font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em;
          color: var(--muted-faint); text-decoration: none;
        }
        .arail-signedout-signin:hover { color: var(--text-faint); }

        /* Mobile / tablet: rail becomes a horizontal lineup strip under the header */
        @media (max-width: 1100px) {
          .arail {
            position: sticky; top: 0; z-index: 20;
            flex-direction: row; align-items: center; gap: 12px;
            overflow-x: auto; padding: 10px 16px; gap: 14px;
            background: rgba(9,9,12,0.82); backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border);
            scrollbar-width: none;
          }
          .arail::-webkit-scrollbar { display: none; }
          .arail-logo, .arail-nav, .arail-kicker, .arail-signedout-text { display: none; }
          .arail-lineup, .arail-lineup-list { display: contents; }
          .arail-creator { padding: 6px 8px; flex-shrink: 0; }
          .arail-creator-name { display: none; }
          .arail-here { display: none; }
          .arail-signedout { display: flex; align-items: center; gap: 10px; padding: 0; }
          .arail-signedout-btn { width: auto; white-space: nowrap; }
        }
      `}</style>
    </nav>
  );
}
