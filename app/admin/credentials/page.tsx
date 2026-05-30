import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

type Field = {
  key: string;
  label: string;
  hint?: string;
  type?: "text" | "password" | "textarea";
};

type Section = {
  title: string;
  description: string;
  fields: Field[];
};

const SECTIONS: Section[] = [
  {
    title: "Stripe (SFW Payments)",
    description: "Stripe Connect for Spotlight subscriptions, tips, and merch. Use live keys from dashboard.stripe.com.",
    fields: [
      { key: "STRIPE_SECRET_KEY",       label: "Secret Key",         hint: "sk_live_... or sk_test_...", type: "password" },
      { key: "STRIPE_PUBLISHABLE_KEY",  label: "Publishable Key",    hint: "pk_live_... or pk_test_..." },
      { key: "STRIPE_WEBHOOK_SECRET",   label: "Webhook Secret",     hint: "whsec_...",                  type: "password" },
      { key: "STRIPE_CONNECT_CLIENT_ID",label: "Connect Client ID",  hint: "ca_..." },
    ],
  },
  {
    title: "CCBill (Adult Payments)",
    description: "CCBill for Backstage subscriptions. Get these from your CCBill admin under FlexForms.",
    fields: [
      { key: "CCBILL_ACCOUNT_NUMBER", label: "Account Number" },
      { key: "CCBILL_SUBACCOUNT",     label: "Sub-Account" },
      { key: "CCBILL_FLEXFORM_ID",    label: "FlexForm ID" },
      { key: "CCBILL_SALT",           label: "Salt (HMAC secret)", type: "password" },
    ],
  },
  {
    title: "Loudcap Merch",
    description: "Merch fulfillment via Loudcap — powered by Printful. Get your API key from printful.com → Dashboard → API.",
    fields: [
      { key: "PRINTFUL_API_KEY", label: "Printful API Key", type: "password", hint: "developers.printful.com → Create token → access level: Store → copy the Private Token" },
    ],
  },
  {
    title: "BunnyCDN (Media Storage + Streaming)",
    description: "Storage zone for images and files. Stream library for video. Get from bunny.net.",
    fields: [
      { key: "BUNNY_STORAGE_ZONE",      label: "Storage Zone Name" },
      { key: "BUNNY_STORAGE_KEY",       label: "Storage Access Key", type: "password" },
      { key: "BUNNY_CDN_HOST",          label: "CDN Hostname",       hint: "e.g. spotlightly.b-cdn.net" },
      { key: "BUNNY_STREAM_LIBRARY_ID", label: "Stream Library ID" },
      { key: "BUNNY_STREAM_KEY",        label: "Stream API Key",     type: "password" },
    ],
  },
  {
    title: "Anthropic (AI Features)",
    description: "Claude API for the onboarding advisor, moderation, and monetization recommendations.",
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "API Key", hint: "sk-ant-...", type: "password" },
    ],
  },
  {
    title: "Veriff (Age Verification)",
    description: "Required before any Backstage creator can publish adult content.",
    fields: [
      { key: "VERIFF_API_KEY", label: "API Key",       type: "password" },
      { key: "VERIFF_SECRET",  label: "Shared Secret", type: "password" },
    ],
  },
  {
    title: "Resend (Transactional Email)",
    description: "For email verification, payout notifications, announcements. Get from resend.com.",
    fields: [
      { key: "RESEND_API_KEY",    label: "API Key",     hint: "re_...", type: "password" },
      { key: "RESEND_FROM_EMAIL", label: "From Address", hint: "Must be on a verified domain at Resend" },
    ],
  },
  {
    title: "Platform",
    description: "Internal platform configuration.",
    fields: [
      { key: "PLATFORM_FEE_PCT", label: "Platform Fee %", hint: "Default: 15 (applied to subscriptions and super tips)" },
    ],
  },
];

async function saveCredentials(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");

  const supabase = await createClient();
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      const v = formData.get(field.key);
      if (typeof v === "string") {
        await (supabase as any)
          .from("platform_settings")
          .update({ value: v, updated_at: new Date().toISOString() })
          .eq("key", field.key);
      }
    }
  }

  revalidatePath("/admin/credentials");
  redirect("/admin/credentials?saved=1");
}

export default async function CredentialsPage(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await props.searchParams;
  if (!(await isAdmin())) notFound();

  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("platform_settings")
    .select("key, value, updated_at");

  const values: Record<string, string> = {};
  const updatedAt: Record<string, string | null> = {};
  for (const row of data ?? []) {
    values[row.key] = row.value ?? "";
    updatedAt[row.key] = row.updated_at;
  }

  const statusFor = (section: Section) => {
    const filled = section.fields.filter((f) => (values[f.key] ?? "").trim().length > 0).length;
    const total = section.fields.length;
    return filled === 0 ? "empty" : filled === total ? "ready" : "partial";
  };

  return (
    <div>
      <p className="kicker">Admin · Credentials</p>
      <h1 className="adm-page-title">API <em>Keys.</em></h1>
      <p className="adm-page-lede">
        Stored in <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "2px 5px", borderRadius: 2 }}>platform_settings</code>,
        RLS-locked to your admin account. Cache refreshes within 60s after save.
      </p>

      {sp.saved === "1" && (
        <div className="adm-banner adm-banner--ok">✓ Saved. Integrations live within 60 seconds.</div>
      )}

      <form action={saveCredentials} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {SECTIONS.map((section) => {
          const status = statusFor(section);
          return (
            <div className="card" key={section.title}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 4, paddingBottom: 0, borderBottom: "none" }}>{section.title}</div>
                  <p style={{ fontSize: 12, color: "var(--muted)", maxWidth: 520 }}>{section.description}</p>
                </div>
                <span className={`badge ${status === "ready" ? "badge--green" : status === "partial" ? "badge--yellow" : "badge--dim"}`}>
                  {status === "ready" ? "Configured" : status === "partial" ? "Partial" : "Not set"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {section.fields.map((field) => (
                  <div key={field.key} className="adm-field">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <label className="adm-label">{field.label}</label>
                      <code style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted)" }}>{field.key}</code>
                    </div>
                    <input
                      name={field.key}
                      type={field.type === "password" ? "password" : "text"}
                      defaultValue={values[field.key] ?? ""}
                      className="adm-input"
                      style={{ fontFamily: "monospace" }}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {field.hint && <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>{field.hint}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
          <button type="submit" className="adm-btn adm-btn--primary">Save all credentials</button>
        </div>
      </form>
    </div>
  );
}
