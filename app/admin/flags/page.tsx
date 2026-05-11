import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const DEFAULT_FLAGS = {
  new_signups: true,
  backstage: true,
  live_streaming: false,
  merch: false,
  super_tips: true,
  gift_subs: false,
  ai_advisor: true,
  maintenance_mode: false,
};

const FLAG_META: Record<string, { label: string; desc: string; danger?: boolean }> = {
  new_signups:      { label: "New Signups",       desc: "Allow new creators to register. Disable to freeze the platform without breaking existing accounts." },
  backstage:        { label: "Backstage",          desc: "Enable the adult content tier. Disabling hides Backstage pages and blocks new Backstage signups." },
  live_streaming:   { label: "Live Streaming",     desc: "Enable live stream feature for Spotlight creators. Requires BunnyCDN stream library configured." },
  merch:            { label: "Merch Store",        desc: "Enable creator merchandise storefronts via Printful/Printify integration." },
  super_tips:       { label: "Super Tips",         desc: "Enable the enhanced tip product with pinned display and top-supporter badge." },
  gift_subs:        { label: "Gift Subscriptions", desc: "Allow fans to gift creator subscriptions to other users." },
  ai_advisor:       { label: "AI Monetization Advisor", desc: "Enable the Claude-powered advisor in the signup flow and dashboard. Requires ANTHROPIC_API_KEY." },
  maintenance_mode: { label: "Maintenance Mode",   desc: "Show a maintenance page to all non-admin visitors. Use during migrations.", danger: true },
};

async function saveFlags(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");

  const flags: Record<string, boolean> = {};
  for (const key of Object.keys(DEFAULT_FLAGS)) {
    flags[key] = formData.get(key) === "on";
  }

  const supabase = await createClient();
  await (supabase as any)
    .from("platform_settings")
    .update({ value: JSON.stringify(flags), updated_at: new Date().toISOString() })
    .eq("key", "FEATURE_FLAGS");

  revalidatePath("/admin/flags");
  redirect("/admin/flags?saved=1");
}

export default async function FlagsPage(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await props.searchParams;
  if (!(await isAdmin())) notFound();

  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "FEATURE_FLAGS")
    .single();

  let flags: Record<string, boolean> = { ...DEFAULT_FLAGS };
  try {
    if (data?.value) {
      flags = { ...DEFAULT_FLAGS, ...JSON.parse(data.value) };
    }
  } catch {}

  return (
    <div>
      <p className="kicker">Admin · Feature Flags</p>
      <h1 className="adm-page-title">Feature <em>Flags.</em></h1>
      <p className="adm-page-lede">Toggle platform features on or off instantly. Changes take effect within 60 seconds.</p>

      {sp.saved === "1" && (
        <div className="adm-banner adm-banner--ok">✓ Flags updated.</div>
      )}

      {flags.maintenance_mode && (
        <div className="adm-banner adm-banner--err">
          ⚠ Maintenance mode is ON — the platform is showing a maintenance page to all visitors.
        </div>
      )}

      <form action={saveFlags}>
        <div className="card">
          <div className="card-title">Platform Features</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(FLAG_META).map(([key, meta]) => (
              <label
                key={key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  padding: "16px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  cursor: "pointer",
                }}
              >
                <div style={{ paddingTop: 2 }}>
                  <input
                    type="checkbox"
                    name={key}
                    defaultChecked={flags[key] ?? false}
                    style={{ accentColor: meta.danger ? "var(--red)" : "var(--spot)", width: 15, height: 15 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: meta.danger ? "var(--red)" : "var(--text)",
                    marginBottom: 3,
                  }}>
                    {meta.label}
                    {meta.danger && (
                      <span className="badge badge--red" style={{ marginLeft: 8 }}>Danger</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{meta.desc}</div>
                </div>
                <div style={{ flexShrink: 0, paddingTop: 2 }}>
                  <span className={`badge ${flags[key] ? (meta.danger ? "badge--red" : "badge--green") : "badge--dim"}`}>
                    {flags[key] ? "On" : "Off"}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="submit" className="adm-btn adm-btn--primary">Save flags</button>
        </div>
      </form>
    </div>
  );
}
