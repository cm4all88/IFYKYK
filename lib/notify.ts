import { createServiceClient } from "@/lib/supabase-server";

type NotifType =
  | "new_subscriber" | "tip" | "super_tip" | "new_comment"
  | "campaign_donation" | "gift_sub" | "message" | "live_viewer"
  | "merch_order" | "merch_shipped" | "merch_delivered"
  | "new_post" | "live_started" | "new_medal";

interface NotifInput {
  userId: string;
  type: NotifType;
  title: string;
  body?: string;
  link?: string;
}

// IMPORTANT: notifications are written with the SERVICE client so they bypass
// RLS. The `notifications` table has no INSERT policy, so the previous
// anon-client insert here was silently blocked — which is why tips, comments,
// etc. never actually produced a notification. Service role is also correct on
// principle: users should never be able to forge notifications to other users.
export async function createNotification({ userId, type, title, body, link }: NotifInput) {
  try {
    const supabase = await createServiceClient();
    await (supabase as any).from("notifications").insert({
      user_id: userId, type, title, body: body ?? null, link: link ?? null,
    });
  } catch {
    // Non-critical — never throw.
  }
}

export async function createNotificationsBulk(rows: NotifInput[]) {
  if (!rows.length) return;
  try {
    const supabase = await createServiceClient();
    await (supabase as any).from("notifications").insert(
      rows.map((r) => ({ user_id: r.userId, type: r.type, title: r.title, body: r.body ?? null, link: r.link ?? null }))
    );
  } catch { /* non-critical */ }
}

// Resolve a creator_profile -> owner user, then notify. `exceptUserId` skips the
// actor so a creator isn't pinged for their own comment/medal.
export async function notifyCreatorByProfile(args: {
  creatorProfileId: string;
  type: NotifType;
  title: string;
  body?: string;
  link?: string;
  exceptUserId?: string;
}) {
  try {
    const supabase = await createServiceClient();
    const { data: cp } = await (supabase as any)
      .from("creator_profiles").select("user_id").eq("id", args.creatorProfileId).maybeSingle();
    const uid = cp?.user_id;
    if (!uid || uid === args.exceptUserId) return;
    await (supabase as any).from("notifications").insert({
      user_id: uid, type: args.type, title: args.title, body: args.body ?? null, link: args.link ?? null,
    });
  } catch { /* non-critical */ }
}

// Notify every active subscriber of a creator (new post, went live). Mirrors the
// feed's subscription query: subscriptions.creator_id == creator_profile id.
export async function notifySubscribers(args: {
  creatorProfileId: string;
  type: NotifType;
  title: string;
  body?: string;
  link?: string;
  exceptUserId?: string;
}) {
  try {
    const supabase = await createServiceClient();
    const { data: subs } = await (supabase as any)
      .from("subscriptions")
      .select("fan_user_id")
      .eq("creator_id", args.creatorProfileId)
      .eq("status", "active");
    const rows = (subs ?? [])
      .map((s: any) => s.fan_user_id)
      .filter((u: string) => u && u !== args.exceptUserId)
      .map((u: string) => ({ user_id: u, type: args.type, title: args.title, body: args.body ?? null, link: args.link ?? null }));
    if (rows.length) await (supabase as any).from("notifications").insert(rows);
  } catch { /* non-critical */ }
}
