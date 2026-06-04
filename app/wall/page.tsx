import "@/app/design.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import StageBackground from "@/components/StageBackground";

export const dynamic = "force-dynamic";

const serif = "var(--font-serif, 'Cormorant Garamond', Georgia, serif)";
const mono = "var(--font-mono, monospace)";

const monthName = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

const RANK_COLOR: Record<number, string> = { 1: "#F2B84B", 2: "#D8D8DE", 3: "#E0915A" };

export default async function WallPage() {
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from("creator_medal_month")
    .select("*")
    .limit(10);

  const leaders = (rows ?? []) as Array<{
    creator_profile_id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    points: number;
    medals: number;
  }>;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 28px" }}>
      <StageBackground />

      <div style={{ maxWidth: 880, width: "100%", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <p style={{ fontFamily: mono, fontSize: 13, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 20 }}>
            {monthName}
          </p>
          <h1 style={{ fontFamily: serif, fontSize: "clamp(56px, 9vw, 92px)", fontWeight: 300, lineHeight: 0.95, margin: 0, color: "var(--text)", letterSpacing: "-0.01em" }}>
            The <span style={{ color: "var(--accent)" }}>Wall</span>
          </h1>
          <p style={{ fontFamily: serif, fontSize: "clamp(20px, 2.4vw, 26px)", fontStyle: "italic", color: "var(--text-soft)", marginTop: 18 }}>
            This month&rsquo;s most-decorated creators.
          </p>
        </div>

        {leaders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 28px", border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)" }}>
            <div style={{ fontSize: 52, marginBottom: 18 }}>🏅</div>
            <p style={{ fontFamily: serif, fontSize: 30, fontStyle: "italic", fontWeight: 300, color: "var(--text)", margin: 0 }}>
              No medals yet this month.
            </p>
            <p style={{ fontSize: 17, color: "var(--text-soft)", marginTop: 12, lineHeight: 1.6, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
              Be the first to crown a great post — the standings start the moment medals do.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {leaders.map((c, i) => {
              const rank = i + 1;
              const accent = RANK_COLOR[rank] ?? "var(--muted)";
              return (
                <Link
                  key={c.creator_profile_id}
                  href={`/${c.handle}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 20, textDecoration: "none",
                    padding: "22px 28px", borderRadius: 14,
                    background: rank <= 3 ? "var(--accent-soft)" : "var(--surface)",
                    border: `1px solid ${rank <= 3 ? "var(--accent-border)" : "var(--border)"}`,
                  }}
                >
                  <span style={{ fontFamily: serif, fontSize: 42, fontWeight: 300, color: accent, width: 52, textAlign: "center", flexShrink: 0, lineHeight: 1 }}>
                    {rank}
                  </span>
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontFamily: serif, fontSize: 26, flexShrink: 0 }}>
                      {(c.display_name || c.handle || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: serif, fontSize: 26, fontWeight: 400, color: "var(--text)", margin: 0, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.display_name || `@${c.handle}`}
                    </p>
                    <p style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.08em", color: "var(--muted)", margin: "5px 0 0" }}>
                      @{c.handle}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontFamily: serif, fontSize: 34, fontWeight: 400, color: accent, margin: 0, lineHeight: 1 }}>
                      {Number(c.points).toLocaleString()}
                    </p>
                    <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", margin: "6px 0 0" }}>
                      {Number(c.medals).toLocaleString()} medals
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 16, color: "var(--text-soft)", marginTop: 56, lineHeight: 1.8, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          Fans award medals to standout posts. The more a creator earns, the higher they climb — resets the first of every month.
        </p>
      </div>
    </main>
  );
}
