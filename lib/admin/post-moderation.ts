// ──────────────────────────────────────────────────────────────────────────────
// lib/admin/post-moderation.ts
//
// Admin actions on any post. Pure planner plus a small executor.
//
//   approve  moderation_status approved (reviewed, fine)
//   flag     moderation_status flagged (keep an eye on it; stays visible)
//   remove   moderation_status blocked, status archive, remembers the prior
//            status. Off the public page; the creator cannot republish it
//            (trigger in migration 069)
//   restore  undoes a removal back to the remembered status
//
// Nothing deletes a post. Every action writes admin_post_actions.
// ──────────────────────────────────────────────────────────────────────────────

export const POST_ACTIONS = ["approve", "flag", "remove", "restore"] as const;
export type PostAction = (typeof POST_ACTIONS)[number];

export type PostModState = {
  status: string;
  moderation_status: string | null;
  removed_by_admin_at: string | null;
  removed_reason: string | null;
  status_before_removal: string | null;
};

export function isPostAction(a: unknown): a is PostAction {
  return typeof a === "string" && (POST_ACTIONS as readonly string[]).includes(a);
}

export function planPostAction(cur: PostModState, action: PostAction, reasonRaw: string, now: Date):
  { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const reason = String(reasonRaw ?? "").trim().slice(0, 1000);
  const at = now.toISOString();
  const removed = !!cur.removed_by_admin_at;
  switch (action) {
    case "approve":
      if (removed) return { ok: false, error: "This post is removed. Restore it instead." };
      return { ok: true, patch: { moderation_status: "approved", moderation_reviewed_at: at } };
    case "flag":
      if (removed) return { ok: false, error: "This post is already removed." };
      if (reason.length < 3) return { ok: false, error: "Say why it is flagged." };
      return { ok: true, patch: { moderation_status: "flagged", moderation_note: reason, moderation_reviewed_at: at } };
    case "remove":
      if (removed) return { ok: false, error: "This post is already removed." };
      if (reason.length < 3) return { ok: false, error: "A reason is required to remove a post." };
      return { ok: true, patch: {
        moderation_status: "blocked", moderation_note: reason, moderation_reviewed_at: at,
        status: "archive", status_before_removal: cur.status, removed_by_admin_at: at, removed_reason: reason,
      } };
    case "restore": {
      if (!removed) return { ok: false, error: "This post is not removed." };
      const back = cur.status_before_removal === "scheduled" ? "scheduled" : cur.status_before_removal === "live" ? "live" : "archive";
      return { ok: true, patch: {
        moderation_status: "approved", moderation_reviewed_at: at, status: back,
        removed_by_admin_at: null, removed_reason: null, status_before_removal: null,
      } };
    }
  }
}

export async function executePostAction(admin: any, args: { postId: string; action: PostAction; reason: string; adminEmail: string; now?: Date }):
  Promise<{ ok: true } | { ok: false; error: string }> {
  const now = args.now ?? new Date();
  const { data: post, error } = await admin.from("posts")
    .select("id, creator_profile_id, status, moderation_status, removed_by_admin_at, removed_reason, status_before_removal")
    .eq("id", args.postId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!post) return { ok: false, error: "Post not found." };

  const plan = planPostAction(post, args.action, args.reason, now);
  if (!plan.ok) return plan;

  const upd = await admin.from("posts").update(plan.patch).eq("id", post.id);
  if (upd.error) return { ok: false, error: upd.error.message };

  const audit = await admin.from("admin_post_actions").insert({
    post_id: post.id, creator_profile_id: post.creator_profile_id, action: args.action,
    reason: args.reason?.trim() || null, admin_email: args.adminEmail,
    before: { status: post.status, moderation_status: post.moderation_status }, after: plan.patch,
  });
  if (audit.error) console.error(JSON.stringify({ at: "lib/admin/post-moderation", event: "audit_write_failed", code: audit.error.code ?? null }));
  return { ok: true };
}
