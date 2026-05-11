import { createClient } from "@/lib/supabase-server";
import { isAdmin, ADMIN_USER_ID } from "@/lib/admin";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function saveBanner(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const text = formData.get("banner") as string;
  const supabase = await createClient();
  await (supabase as any)
    .from("platform_settings")
    .update({ value: text ?? "", updated_at: new Date().toISOString() })
    .eq("key", "PLATFORM_ANNOUNCEMENT");
  revalidatePath("/admin/comms");
  redirect("/admin/comms?saved=banner");
}

async function createMessage(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;
  const target = formData.get("target") as string;
  const sendNow = formData.get("send_now") === "on";

  if (!body?.trim()) return;

  const supabase = await createClient();
  await (supabase as any).from("admin_messages").insert({
    kind: "email_blast",
    target: target || "all",
    subject: subject || "A message from Spotlightly",
    body,
    status: sendNow ? "sent" : "draft",
    sent_at: sendNow ? new Date().toISOString() : null,
    created_by: ADMIN_USER_ID,
  });

  revalidatePath("/admin/comms");
  redirect("/admin/comms?saved=message");
}

async function deleteMessage(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const supabase = await createClient();
  await (supabase as any).from("admin_messages").delete().eq("id", id);
  revalidatePath("/admin/comms");
}

export default async function CommsPage(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;

  const supabase = await createClient();
  const [{ data: bannerRow }, { data: messages }] = await Promise.all([
    (supabase as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "PLATFORM_ANNOUNCEMENT")
      .single(),
    (supabase as any)
      .from("admin_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const bannerText = bannerRow?.value ?? "";

  return (
    <div>
      <p className="kicker">Admin · Communications</p>
      <h1 className="adm-page-title">Platform <em>Comms.</em></h1>
      <p className="adm-page-lede">Announcement banners, email blasts, and creator notifications.</p>

      {sp.saved === "banner" && (
        <div className="adm-banner adm-banner--ok">✓ Banner updated. Shows to all visitors immediately.</div>
      )}
      {sp.saved === "message" && (
        <div className="adm-banner adm-banner--ok">✓ Message saved.</div>
      )}

      {/* Active banner preview */}
      {bannerText && (
        <div style={{ background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)", padding: "12px 18px", borderRadius: 4, marginBottom: 20, fontSize: 13, color: "var(--spot)" }}>
          <strong>Live banner:</strong> {bannerText}
        </div>
      )}

      {/* Banner editor */}
      <div className="card">
        <div className="card-title">Platform Announcement Banner</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Shown at the top of every page for all visitors. Leave blank to hide.
        </p>
        <form action={saveBanner} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <textarea
            name="banner"
            defaultValue={bannerText}
            placeholder="e.g. We're doing scheduled maintenance on May 15 at 2am UTC. Expect 30 minutes of downtime."
            className="adm-textarea"
            rows={3}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="adm-btn adm-btn--primary">Save Banner</button>
            {bannerText && (
              <button type="submit" name="banner" value="" className="adm-btn adm-btn--danger">Clear Banner</button>
            )}
          </div>
        </form>
      </div>

      {/* Email blast */}
      <div className="card">
        <div className="card-title">Email Blast</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Send a message to all creators or a specific segment. Emails are sent via Resend using your configured from address.
          Requires RESEND_API_KEY to be set in Credentials.
        </p>
        <form action={createMessage} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field-grid">
            <div className="adm-field">
              <label className="adm-label">Audience</label>
              <select name="target" className="adm-select">
                <option value="all">All creators</option>
                <option value="spotlight">Spotlight creators only</option>
                <option value="backstage">Backstage creators only</option>
                <option value="subscribers">Fan subscribers</option>
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Subject Line</label>
              <input name="subject" placeholder="A message from Spotlightly" className="adm-input" />
            </div>
          </div>

          <div className="adm-field">
            <label className="adm-label">Message Body</label>
            <textarea
              name="body"
              required
              placeholder="Write your message here. Plain text or basic HTML."
              className="adm-textarea"
              rows={6}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" name="send_now" style={{ accentColor: "var(--spot)" }} />
              Send immediately (uncheck to save as draft)
            </label>
            <button type="submit" className="adm-btn adm-btn--primary">Send / Save</button>
          </div>
        </form>
      </div>

      {/* Message history */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: "20px 24px 16px" }}>Message History</div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Target</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(messages ?? []).length === 0 ? (
              <tr><td colSpan={5} style={{ color: "var(--muted)", padding: 24 }}>No messages yet.</td></tr>
            ) : (
              (messages ?? []).map((m: any) => (
                <tr key={m.id}>
                  <td>{m.subject || "(no subject)"}</td>
                  <td><span className="badge badge--dim">{m.target}</span></td>
                  <td>
                    <span className={`badge ${m.status === "sent" ? "badge--green" : m.status === "draft" ? "badge--yellow" : "badge--dim"}`}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <form action={deleteMessage}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="adm-btn adm-btn--danger" style={{ padding: "4px 10px" }}>Delete</button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
