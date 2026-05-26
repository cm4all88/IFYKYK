import { createClient } from "@/lib/supabase-server";

type NotifType = "new_subscriber" | "tip" | "super_tip" | "new_comment" | "campaign_donation" | "gift_sub" | "message" | "live_viewer";

export async function createNotification({
  userId, type, title, body, link,
}: {
  userId: string;
  type: NotifType;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    const supabase = await createClient();
    await (supabase as any).from("notifications").insert({
      user_id: userId,
      type,
      title,
      body: body ?? null,
      link: link ?? null,
    });
  } catch {
    // Non-critical — never throw
  }
}
