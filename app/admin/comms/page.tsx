import { createClient, createServiceClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { sendReferralInviteEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export const maxDuration = 60;

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
    created_by: (await (await createClient()).auth.getUser()).data.user?.id ?? "",
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

// Email every signed-up account that hasn't become a creator yet (and hasn't
// already been invited), asking them to send their personal invite link.
// Idempotent: tracks who's been sent in referral_invite_sends, sends in capped,
// throttled batches so a large list doesn't trip Resend's rate limit.
const INVITE_PER_RUN_CAP = 100;
const INVITE_SEND_DELAY_MS = 450;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendReferralInvites() {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const db: any = await createServiceClient();

  // Already a creator?
  const { data: creators } = await db.from("creator_profiles").select("user_id");
  const creatorUserIds = new Set((creators ?? []).map((c: any) => c.user_id).filter(Boolean));

  // Already invited?
  const { data: sentRows } = await db.from("referral_invite_sends").select("user_id");
  const alreadySent = new Set((sentRows ?? []).map((r: any) => r.user_id));

  // All auth users → non-creators who haven't been invited yet.
  const recipients: { id: string; email: string; firstName: string }[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const users = data?.users ?? [];
    for (const u of users) {
      if (!u.email || creatorUserIds.has(u.id) || alreadySent.has(u.id)) continue;
      const meta = u.user_metadata ?? {};
      const name = String(meta.display_name || meta.full_name || meta.name || "").trim();
      recipients.push({ id: u.id, email: u.email, firstName: name.split(/\s+/)[0] || "" });
    }
    if (users.length < 1000) break;
  }

  const pending = recipients.length;
  const batch = recipients.slice(0, INVITE_PER_RUN_CAP);

  let sent = 0;
  for (const r of batch) {
    try {
      const { data: code } = await db.rpc("ensure_referral_code", { p_user: r.id });
      const link = code ? `${SITE_URL}/signup?ref=${code}` : `${SITE_URL}/signup`;
      await sendReferralInviteEmail(r.email, r.firstName, link);
      // Record only on success, so a failed send is retried on the next run.
      await db.from("referral_invite_sends").upsert(
        { user_id: r.id, sent_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      sent++;
    } catch {
      /* skip individual failures, keep going */
    }
    await sleep(INVITE_SEND_DELAY_MS);
  }

  const remaining = pending - sent;
  redirect(`/admin/comms?saved=invites&sent=${sent}&remaining=${remaining}`);
}

export default async function CommsPage(props: {
  searchParams: Promise<{ saved?: string; sent?: string; remaining?: string }>;
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
      {sp.saved === "invites" && (
        <div className="adm-banner adm-banner--ok">
          ✓ Sent {sp.sent} referral invite{sp.sent === "1" ? "" : "s"}.{" "}
          {Number(sp.remaining) > 0
            ? `${sp.remaining} more not yet invited — click again to send the next batch.`
            : "Everyone who hasn't become a creator has now been invited."}
        </div>
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

      {/* Referral invite to non-creators */}
      <div className="card">
        <div className="card-title">Invite non-creators to bring a creator</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Emails everyone who signed up but hasn&apos;t become a creator yet, asking them to send their personal invite link to people they&apos;d like to see become Spotlightly creators. Each link points to the creator signup. Anyone already invited is skipped automatically, so it&apos;s safe to click more than once. Sends in batches of up to {INVITE_PER_RUN_CAP} per click &mdash; if more remain, you&apos;ll be told to click again.
        </p>
        <form action={sendReferralInvites}>
          <button type="submit" className="adm-btn adm-btn--primary">Send referral invite to all non-creators</button>
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
