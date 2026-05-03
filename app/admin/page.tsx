import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// ──────────────────────────────────────────────────────────────────
// Settings layout — defines the form structure
// ──────────────────────────────────────────────────────────────────

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
    description:
      "Stripe Connect for Spotlight subscriptions, tips, and merch. Use restricted/live keys from dashboard.stripe.com.",
    fields: [
      { key: "STRIPE_SECRET_KEY", label: "Secret Key", hint: "sk_live_... or sk_test_...", type: "password" },
      { key: "STRIPE_PUBLISHABLE_KEY", label: "Publishable Key", hint: "pk_live_... or pk_test_..." },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook Secret", hint: "whsec_...", type: "password" },
      { key: "STRIPE_CONNECT_CLIENT_ID", label: "Connect Client ID", hint: "ca_..." },
    ],
  },
  {
    title: "CCBill (Adult Payments)",
    description:
      "CCBill account for Backstage. Get these from your CCBill admin under FlexForms and your account settings.",
    fields: [
      { key: "CCBILL_ACCOUNT_NUMBER", label: "Account Number" },
      { key: "CCBILL_SUBACCOUNT", label: "Sub-Account" },
      { key: "CCBILL_FLEXFORM_ID", label: "FlexForm ID" },
      { key: "CCBILL_SALT", label: "Salt (HMAC secret)", type: "password" },
    ],
  },
  {
    title: "BunnyCDN (Media Storage + Streaming)",
    description:
      "Storage zone for images and files. Stream library for video. Get from bunny.net.",
    fields: [
      { key: "BUNNY_STORAGE_ZONE", label: "Storage Zone Name" },
      { key: "BUNNY_STORAGE_KEY", label: "Storage Access Key", type: "password" },
      { key: "BUNNY_CDN_HOST", label: "CDN Hostname", hint: "e.g. spotlightly.b-cdn.net" },
      { key: "BUNNY_STREAM_LIBRARY_ID", label: "Stream Library ID" },
      { key: "BUNNY_STREAM_KEY", label: "Stream API Key", type: "password" },
    ],
  },
  {
    title: "Veriff (Age Verification)",
    description: "Required before any Backstage creator can publish. Get from station.veriff.com.",
    fields: [
      { key: "VERIFF_API_KEY", label: "API Key", type: "password" },
      { key: "VERIFF_SECRET", label: "Shared Secret", type: "password" },
    ],
  },
  {
    title: "Resend (Transactional Email)",
    description:
      "For parental consent emails, email verification, graduation notifications. Get from resend.com.",
    fields: [
      { key: "RESEND_API_KEY", label: "API Key", hint: "re_...", type: "password" },
      {
        key: "RESEND_FROM_EMAIL",
        label: "From Address",
        hint: "Must be on a verified domain at Resend",
      },
    ],
  },
  {
    title: "Cron",
    description:
      "Shared secret used by /api/cron/graduate to validate it's being called by Vercel cron and not a random visitor. Generate with: openssl rand -hex 32",
    fields: [
      { key: "CRON_SECRET", label: "Cron Secret", type: "password" },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────
// Server action — save form
// ──────────────────────────────────────────────────────────────────

async function saveSettings(formData: FormData) {
  "use server";

  if (!(await isAdmin())) {
    throw new Error("Not authorized");
  }

  const supabase = await createClient();
  const updates: Array<{ key: string; value: string }> = [];

  for (const section of SECTIONS) {
    for (const field of section.fields) {
      const v = formData.get(field.key);
      if (typeof v === "string") {
        updates.push({ key: field.key, value: v });
      }
    }
  }

  // Upsert each one. Could be batched but row count is small enough that clarity wins.
  for (const { key, value } of updates) {
    await supabase
      .from("platform_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
  }

  revalidatePath("/admin");
  redirect("/admin?saved=1");
}

// ──────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────

export default async function AdminPage(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await props.searchParams;
  const justSaved = sp.saved === "1";

  if (!(await isAdmin())) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value, updated_at");

  const values: Record<string, string> = {};
  const updatedAt: Record<string, string | null> = {};
  for (const row of data ?? []) {
    values[row.key] = row.value ?? "";
    updatedAt[row.key] = row.updated_at;
  }

  // Compute integration status badges
  const integrationStatus: Record<string, "ready" | "partial" | "empty"> = {};
  for (const section of SECTIONS) {
    const filled = section.fields.filter((f) => (values[f.key] ?? "").trim().length > 0).length;
    const total = section.fields.length;
    integrationStatus[section.title] =
      filled === 0 ? "empty" : filled === total ? "ready" : "partial";
  }

  return (
    <main className="adm">
      <div className="adm-shell">
        <header className="adm-head">
          <p className="kicker">GODMODE · Platform Administration</p>
          <h1 className="adm-title">
            Platform <em>credentials.</em>
          </h1>
          <p className="adm-lede">
            Paste keys here, hit save. Integrations go live immediately. Cache refreshes within 60 seconds.
            All values stored in <code>platform_settings</code>, RLS-locked to this account.
          </p>
        </header>

        {justSaved && (
          <div className="adm-banner adm-banner--ok">
            ✓ Saved. Integration cache will refresh within 60 seconds.
          </div>
        )}

        <form action={saveSettings} className="adm-form">
          {SECTIONS.map((section) => {
            const status = integrationStatus[section.title];
            return (
              <section className="adm-section" key={section.title}>
                <header className="adm-section-head">
                  <div>
                    <h2 className="adm-section-title">{section.title}</h2>
                    <p className="adm-section-desc">{section.description}</p>
                  </div>
                  <span className={`adm-status adm-status--${status}`}>
                    {status === "ready" ? "Configured" : status === "partial" ? "Partial" : "Not set"}
                  </span>
                </header>

                <div className="adm-fields">
                  {section.fields.map((field) => (
                    <label className="adm-field" key={field.key}>
                      <div className="adm-field-head">
                        <span className="adm-field-label">{field.label}</span>
                        <code className="adm-field-key">{field.key}</code>
                      </div>
                      {field.type === "textarea" ? (
                        <textarea
                          name={field.key}
                          defaultValue={values[field.key]}
                          className="textarea adm-input"
                          rows={4}
                        />
                      ) : (
                        <input
                          name={field.key}
                          type={field.type === "password" ? "password" : "text"}
                          defaultValue={values[field.key]}
                          className="input adm-input"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      )}
                      {field.hint && <span className="adm-field-hint">{field.hint}</span>}
                    </label>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="adm-actions">
            <button type="submit" className="btn btn--primary">
              Save all credentials
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .adm { min-height: 100vh; padding: var(--s-10) var(--s-6); }
        .adm-shell { max-width: 920px; margin: 0 auto; }
        .adm-head { margin-bottom: var(--s-10); }
        .adm-title {
          font-family: var(--font-serif);
          font-size: clamp(36px, 5vw, 52px);
          font-weight: 300;
          color: #fff;
          margin: var(--s-3) 0 var(--s-4);
          line-height: 1.05;
          letter-spacing: -0.01em;
        }
        .adm-title em { font-style: italic; color: var(--accent); }
        .adm-lede {
          font-size: 15px;
          color: var(--text-soft);
          line-height: 1.7;
          max-width: 640px;
          margin: 0;
        }
        .adm-lede code {
          font-family: var(--font-mono);
          font-size: 12px;
          background: var(--surface-2);
          padding: 2px 6px;
          border-radius: 2px;
          color: var(--accent);
        }

        .adm-banner {
          padding: var(--s-3) var(--s-5);
          border-radius: var(--r-2);
          margin-bottom: var(--s-6);
          font-size: 13px;
        }
        .adm-banner--ok {
          background: rgba(110, 231, 183, 0.08);
          border: 1px solid rgba(110, 231, 183, 0.25);
          color: var(--accent-open);
        }

        .adm-form { display: flex; flex-direction: column; gap: var(--s-8); }

        .adm-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-3);
          padding: var(--s-8);
        }
        .adm-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--s-4);
          margin-bottom: var(--s-6);
          padding-bottom: var(--s-5);
          border-bottom: 1px solid var(--border);
        }
        .adm-section-title {
          font-family: var(--font-serif);
          font-size: 26px;
          font-weight: 400;
          color: #fff;
          margin: 0 0 var(--s-2);
        }
        .adm-section-desc {
          font-size: 13px;
          color: var(--text-soft);
          line-height: 1.6;
          max-width: 560px;
          margin: 0;
        }

        .adm-status {
          flex-shrink: 0;
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: var(--r-1);
          border: 1px solid;
          white-space: nowrap;
        }
        .adm-status--ready {
          color: var(--accent-open);
          background: rgba(110, 231, 183, 0.08);
          border-color: rgba(110, 231, 183, 0.25);
        }
        .adm-status--partial {
          color: var(--accent);
          background: rgba(245, 200, 66, 0.08);
          border-color: rgba(245, 200, 66, 0.25);
        }
        .adm-status--empty {
          color: var(--muted);
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--border);
        }

        .adm-fields { display: flex; flex-direction: column; gap: var(--s-4); }
        .adm-field { display: flex; flex-direction: column; gap: var(--s-2); }
        .adm-field-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: var(--s-3);
        }
        .adm-field-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-soft);
        }
        .adm-field-key {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--muted);
        }
        .adm-input { font-family: var(--font-mono); }
        .adm-field-hint {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--muted);
          margin-top: 2px;
        }

        .adm-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: var(--s-3);
        }

        @media (max-width: 700px) {
          .adm-section { padding: var(--s-5); }
          .adm-section-head { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}
