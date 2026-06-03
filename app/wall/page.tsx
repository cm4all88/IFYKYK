import "@/app/design.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const serif = "var(--font-display, 'Cormorant Garamond', serif)";
const mono = "var(--font-mono, monospace)";

const monthName = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

const RANK_COLOR: Record<number, string> = {
  1: "#F2B84B",
  2: "#C0C0C0",
  3: "#CD7F32",
};

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
    <main style={{ minHeight: "100vh", background: "var(--bg, #09090C)", color: "var(--text, #f2f2f0)", position: "relative", overflow: "hidden" }}>
      {/* Spotlight beam */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 700, height: 520,
        background: "radial-gradient(ellipse 55% 60% at 50% 0%, rgba(242,184,75,0.14), transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "72px 24px 100px", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
            {monthName}
          </p>
          <h1 style={{ fontFamily: serif, fontSize: "clamp(40px, 7vw, 64px)", fontWeight: 300, lineHeight: 1, margin: 0, color: "#fff" }}>
            The <span style={{ color: "#F2B84B" }}>Wall</span>
          </h1>
          <p style={{ fontFamily: serif, fontSize: 18, fontStyle: "italic", color: "rgba(242,242,240,0.55)", marginTop: 12 }}>
            This month&rsquo;s most-decorated creators.
          </p>
        </div>

        {leaders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏅</div>
            <p style={{ fontFamily: serif, fontSize: 22, fontStyle: "italic", fontWeight: 300, color: "rgba(242,242,240,0.7)", margin: 0 }}>
              No medals yet this month.
            </p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
              Be the first to crown a great post — the standings start the moment medals do.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leaders.map((c, i) => {
              const rank = i + 1;
              const accent = RANK_COLOR[rank] ?? "rgba(255,255,255,0.25)";
              return (
                <Link
                  key={c.creator_profile_id}
                  href={`/${c.handle}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 16, textDecoration: "none",
                    padding: "16px 20px", borderRadius: 10,
                    background: rank <= 3 ? "rgba(242,184,75,0.04)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${rank <= 3 ? "rgba(242,184,75,0.18)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <span style={{ fontFamily: serif, fontSize: 30, fontWeight: 300, color: accent, width: 40, textAlign: "center", flexShrink: 0 }}>
                    {rank}
                  </span>
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(242,184,75,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F2B84B", fontFamily: serif, fontSize: 20, flexShrink: 0 }}>
                      {(c.display_name || c.handle || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: serif, fontSize: 20, fontWeight: 400, color: "#fff", margin: 0, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.display_name || `@${c.handle}`}
                    </p>
                    <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", margin: "3px 0 0" }}>
                      @{c.handle}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontFamily: serif, fontSize: 24, fontWeight: 400, color: accent, margin: 0, lineHeight: 1 }}>
                      {Number(c.points).toLocaleString()}
                    </p>
                    <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "4px 0 0" }}>
                      {Number(c.medals).toLocaleString()} 🏅
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 40, lineHeight: 1.7 }}>
          Fans award medals to standout posts. The more a creator earns, the higher they climb —
          resets the first of every month.
        </p>
      </div>
    </main>
  );
}
