import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#f2f0ec" }}>
      {/* Platform shell — nav sidebar + main content */}
      <div style={{ display: "flex" }}>
        <aside style={{
          width: 240, minHeight: "100vh", background: "#111110",
          borderRight: "1px solid #242422", padding: "20px 12px",
          position: "fixed", top: 0, left: 0, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px", marginBottom: 28 }}>
            <div style={{ width: 26, height: 26, background: "#d4680a", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff" }}>S</div>
            <span style={{ color: "#f2f0ec", fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>Spotlightly</span>
          </div>
          {/* Nav links — wire these up */}
          {[
            { href: "/dashboard", label: "Dashboard",    icon: "⊞" },
            { href: "/post/new",  label: "New Post",     icon: "+" },
            { href: "/analytics", label: "Analytics",    icon: "↗" },
            { href: "/earnings",  label: "Earnings",     icon: "$" },
            { href: "/channels",  label: "Channels",     icon: "⇋" },
            { href: "/messages",  label: "Messages",     icon: "✉" },
            { href: "/settings",  label: "Settings",     icon: "⚙" },
          ].map(item => (
            <a key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 9, marginBottom: 2,
              color: "#888078", textDecoration: "none", fontSize: 14,
              transition: "all 0.15s",
            }}>
              <span style={{ width: 18, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </aside>
        <main style={{ marginLeft: 240, flex: 1, padding: "32px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
