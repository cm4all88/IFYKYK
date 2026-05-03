import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!creator) redirect("/onboarding");

  const { count: subscriberCount } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact" })
    .eq("creator_profile_id", creator.id)
    .eq("status", "active");

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
        Welcome back, {creator.display_name}
      </h1>
      <p style={{ color: "#888078", marginBottom: 32 }}>Here&apos;s how your page is doing.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Subscribers", value: subscriberCount ?? 0 },
          { label: "Monthly revenue", value: `$${((subscriberCount ?? 0) * Number(creator.subscription_price ?? 9.99)).toFixed(0)}` },
          { label: "Posts this month", value: 0 },
          { label: "Profile views", value: 0 },
        ].map(k => (
          <div key={k.label} style={{ background: "#181816", border: "1px solid #242422", borderRadius: 14, padding: "20px" }}>
            <div style={{ color: "#484440", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ color: "#f2f0ec", fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <a href="/post/new" style={{ background: "#d4680a", color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}>+ New post</a>
        <a href="/analytics" style={{ background: "#181816", border: "1px solid #242422", color: "#888078", padding: "12px 24px", borderRadius: 10, textDecoration: "none" }}>View analytics</a>
      </div>
    </div>
  );
}