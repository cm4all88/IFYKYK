import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Runs daily. For creators whose card was declined (status 'past_due'):
//  • within the 7-day grace window → send one warning email per day
//  • grace expired → lock the account (status 'cancelled') + stop future fan charges
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
  const now = Date.now();

  let stripeKey: string | null = null;
  try {
    const { getSecrets } = await import("@/lib/settings");
    const r = await getSecrets(["STRIPE_SECRET_KEY"]);
    stripeKey = r.STRIPE_SECRET_KEY;
  } catch { /* fan-pause will be skipped if unavailable */ }

  const { data: rows } = await supabase
    .from("creator_billing")
    .select("user_id, grace_ends_at, last_dunning_warned_at")
    .eq("status", "past_due");

  let warned = 0, locked = 0;

  async function emailUser(userId: string, subject: string, body: string) {
    const { data: au } = await supabase.auth.admin.getUserById(userId);
    if (!au?.user?.email) return;
    await fetch(`${appUrl}/api/email/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: au.user.email, subject, preview: subject, body }),
    }).catch(() => {});
  }

  for (const r of rows ?? []) {
    const graceEnds = r.grace_ends_at ? new Date(r.grace_ends_at).getTime() : null;

    // Grace expired → lock + be fair to the fans.
    if (graceEnds !== null && graceEnds <= now) {
      await supabase.from("creator_billing")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("user_id", r.user_id);
      if (stripeKey) {
        try {
          const { pauseFanSubscriptionsForCreator } = await import("@/lib/billing");
          await pauseFanSubscriptionsForCreator(supabase, stripeKey, r.user_id);
        } catch { /* non-fatal */ }
      }
      await emailUser(
        r.user_id,
        "Your Spotlightly account has been paused",
        `We weren't able to charge your card, so your creator account is paused.<br><br>Your posts and subscribers are safe — add a working card to reactivate at any time.<br><br>` +
        `<a href="${appUrl}/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Reactivate →</a>`
      );
      locked++;
      continue;
    }

    // Inside grace → warn once per day.
    if (graceEnds !== null) {
      const lastWarned = r.last_dunning_warned_at ? new Date(r.last_dunning_warned_at).getTime() : 0;
      if (now - lastWarned >= 20 * 3600 * 1000) {
        const daysLeft = Math.max(0, Math.ceil((graceEnds - now) / 86400000));
        await emailUser(
          r.user_id,
          `Action needed — ${daysLeft} day${daysLeft === 1 ? "" : "s"} to update your card`,
          `We still couldn't process your Spotlightly payment. You have <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong> left to update your card before your account is paused.<br><br>` +
          `<a href="${appUrl}/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Update payment method →</a>`
        );
        await supabase.from("creator_billing")
          .update({ last_dunning_warned_at: new Date().toISOString() })
          .eq("user_id", r.user_id);
        warned++;
      }
    }
  }

  return NextResponse.json({ ok: true, warned, locked });
}
