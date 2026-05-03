import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ParentalDashboardPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const supabase = await createClient();

  // Look up the token (the URL itself is the auth)
  const { data: tokenRow } = await supabase
    .from("parental_tokens")
    .select("*")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();

  if (!tokenRow) notFound();

  // Find the child's profile + recent activity
  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", tokenRow.child_user_id)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (!profile) notFound();

  // Fetch recent posts (read-only view)
  const { data: posts } = await supabase
    .from("posts")
    .select("id, caption, status, created_at, content_rating")
    .eq("creator_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Compute days until 18
  const dob = profile.date_of_birth ? new Date(profile.date_of_birth) : null;
  let daysUntil18: number | null = null;
  let graduatedAlready = false;
  if (dob) {
    const eighteenth = new Date(dob);
    eighteenth.setFullYear(dob.getFullYear() + 18);
    const ms = eighteenth.getTime() - Date.now();
    if (ms < 0) graduatedAlready = true;
    else daysUntil18 = Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  return (
    <main className="pd">
      <div className="pd-shell">
        <header className="pd-head">
          <p className="kicker">Parental Dashboard</p>
          <h1 className="pd-title">
            {profile.display_name ?? profile.handle}&apos;s <em>Opening Act.</em>
          </h1>
          <p className="pd-lede">
            You&apos;re viewing this account because you provided parental consent for an Opening Act creator.
            This dashboard auto-revokes when they turn 18.
          </p>
        </header>

        <section className="pd-info">
          <div className="pd-stat">
            <p className="label">Handle</p>
            <p className="pd-stat-val">@{profile.handle}</p>
          </div>
          <div className="pd-stat">
            <p className="label">Public URL</p>
            <p className="pd-stat-val">
              <Link href={`/c/${profile.handle}`} className="pd-link" target="_blank">
                spotlightly.app/c/{profile.handle}
              </Link>
            </p>
          </div>
          <div className="pd-stat">
            <p className="label">Date of birth</p>
            <p className="pd-stat-val">
              {profile.date_of_birth
                ? new Date(profile.date_of_birth).toLocaleDateString()
                : "—"}
            </p>
          </div>
          <div className="pd-stat">
            <p className="label">Status</p>
            <p className="pd-stat-val">
              {graduatedAlready
                ? "Graduated to Spotlight"
                : daysUntil18 != null
                ? `${daysUntil18} days until 18`
                : "Active"}
            </p>
          </div>
        </section>

        <section className="pd-section">
          <p className="kicker">Recent Posts</p>
          {posts && posts.length > 0 ? (
            <ul className="pd-posts">
              {posts.map((p) => (
                <li key={p.id} className="pd-post">
                  <div className="pd-post-meta">
                    <span>{new Date(p.created_at).toLocaleString()}</span>
                    <span className="badge badge--open">{p.content_rating}</span>
                    <span className="pd-post-status">{p.status}</span>
                  </div>
                  {p.caption && <p className="pd-post-caption">{p.caption}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="pd-empty">No posts yet.</p>
          )}
        </section>

        <footer className="pd-footer">
          <p>
            Concerns? Reply to the email this dashboard came from, or contact{" "}
            <a href="mailto:safety@spotlightly.app" className="pd-link">safety@spotlightly.app</a>.
          </p>
          <p className="pd-meta">
            Opening Act enforces COPPA, blocks adult contact, and restricts content to G/PG ratings.
            Read more in our <Link href="/safety" className="pd-link">Safety overview</Link>.
          </p>
        </footer>
      </div>

      <style>{`
        .pd { min-height: 100vh; padding: var(--s-10) var(--s-6); }
        .pd-shell { max-width: 800px; margin: 0 auto; }
        .pd-head { margin-bottom: var(--s-10); }
        .pd-title {
          font-family: var(--font-serif);
          font-size: clamp(36px, 5vw, 48px);
          font-weight: 300;
          color: #fff;
          margin: var(--s-3) 0 var(--s-4);
          line-height: 1.1;
        }
        .pd-title em { font-style: italic; color: var(--accent-open); }
        .pd-lede {
          font-size: 15px;
          color: var(--text-soft);
          line-height: 1.7;
          max-width: 600px;
          margin: 0;
        }
        .pd-info {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2px;
          margin-bottom: var(--s-10);
        }
        .pd-stat {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: var(--s-5);
        }
        .pd-stat-val {
          font-size: 16px;
          color: var(--text);
          margin: var(--s-2) 0 0;
        }
        .pd-link { color: var(--accent); }
        .pd-section { margin-bottom: var(--s-10); }
        .pd-posts {
          list-style: none;
          padding: 0;
          margin: var(--s-4) 0 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .pd-post {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: var(--s-5);
        }
        .pd-post-meta {
          display: flex;
          gap: var(--s-3);
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: var(--s-3);
          align-items: center;
          flex-wrap: wrap;
        }
        .pd-post-status { color: var(--accent); }
        .pd-post-caption {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-soft);
          margin: 0;
        }
        .pd-empty {
          font-size: 14px;
          color: var(--muted);
          padding: var(--s-8);
          text-align: center;
          background: var(--surface);
          border: 1px solid var(--border);
          margin-top: var(--s-4);
        }
        .pd-footer {
          padding-top: var(--s-8);
          border-top: 1px solid var(--border);
          font-size: 13px;
          color: var(--text-soft);
          line-height: 1.7;
        }
        .pd-meta {
          font-size: 11px;
          color: var(--muted);
          margin-top: var(--s-3);
        }

        @media (max-width: 600px) {
          .pd-info { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
