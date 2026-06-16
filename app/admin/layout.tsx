import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import AdminNav from "@/components/AdminNav";

export const metadata = { title: "Spotlightly Admin" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) notFound();

  return (
    <div className="adm-shell">
      <AdminNav />
      <main className="adm-main">{children}</main>

      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap");

        :root {
          --bg: #0a0a0f;
          --surface: #111118;
          --surface-2: #161620;
          --border: rgba(255,255,255,0.07);
          --border-strong: rgba(255,255,255,0.15);
          --text: #e8e8f0;
          --muted: #9a9ab2;
          --spot: #f5c842;
          --open: #6ee7b7;
          --back: #c084fc;
          --red: #f87171;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: var(--bg);
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-weight: 300;
          line-height: 1.6;
          font-size: 14px;
        }

        .adm-shell {
          display: flex;
          min-height: 100vh;
        }
        .adm-main {
          flex: 1;
          padding: 40px 48px;
          overflow-x: auto;
        }

        /* ── shared admin components ── */
        .adm-page-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 300;
          color: #fff;
          margin-bottom: 6px;
          line-height: 1.1;
        }
        .adm-page-title em { font-style: italic; color: var(--spot); }
        .adm-page-lede {
          color: var(--muted);
          font-size: 13px;
          margin-bottom: 36px;
        }
        .kicker {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }

        /* ── cards / panels ── */
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 28px 32px;
          margin-bottom: 16px;
        }
        .card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px;
          font-weight: 400;
          color: #fff;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }

        /* ── stat cards ── */
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 32px; }
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 20px 22px;
        }
        .stat-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
        .stat-value { font-family: 'Cormorant Garamond', serif; font-size: 36px; font-weight: 300; color: #fff; line-height: 1; }
        .stat-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }

        /* ── tables ── */
        .adm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .adm-table th {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--muted);
          text-align: left;
          padding: 10px 14px;
          border-bottom: 1px solid var(--border);
          font-weight: 400;
        }
        .adm-table td {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          color: rgba(232,232,240,0.75);
          vertical-align: middle;
        }
        .adm-table tr:hover td { background: rgba(255,255,255,0.02); }
        .adm-table td:first-child { color: var(--text); font-weight: 500; }

        /* ── badges ── */
        .badge {
          display: inline-block;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 2px;
          border: 1px solid;
        }
        .badge--green { color: var(--open); background: rgba(110,231,183,0.08); border-color: rgba(110,231,183,0.25); }
        .badge--yellow { color: var(--spot); background: rgba(245,200,66,0.08); border-color: rgba(245,200,66,0.25); }
        .badge--purple { color: var(--back); background: rgba(192,132,252,0.08); border-color: rgba(192,132,252,0.25); }
        .badge--red { color: var(--red); background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.25); }
        .badge--dim { color: var(--muted); background: rgba(255,255,255,0.03); border-color: var(--border); }

        /* ── forms ── */
        .adm-field { display: flex; flex-direction: column; gap: 6px; }
        .adm-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .adm-input, .adm-select, .adm-textarea {
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 3px;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
        }
        .adm-input:focus, .adm-select:focus, .adm-textarea:focus { border-color: var(--spot); }
        .adm-textarea { resize: vertical; min-height: 80px; }
        .adm-input::placeholder { color: var(--muted); }

        .adm-btn {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 9px 20px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          transition: opacity 0.15s;
          display: inline-block;
          text-decoration: none;
        }
        .adm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .adm-btn--primary { background: var(--spot); color: #0a0a0f; }
        .adm-btn--danger { background: rgba(248,113,113,0.15); color: var(--red); border: 1px solid rgba(248,113,113,0.3); }
        .adm-btn--ghost { background: rgba(255,255,255,0.05); color: var(--text); border: 1px solid var(--border); }

        .adm-banner { padding: 12px 18px; border-radius: 3px; margin-bottom: 20px; font-size: 13px; }
        .adm-banner--ok { background: rgba(110,231,183,0.08); border: 1px solid rgba(110,231,183,0.25); color: var(--open); }
        .adm-banner--err { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); color: var(--red); }

        .row-actions { display: flex; gap: 8px; align-items: center; }

        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

        .section-actions { display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid var(--border); margin-top: 16px; }

        @media (max-width: 900px) {
          .adm-main { padding: 24px 20px; }
          .field-grid, .field-grid-3 { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
