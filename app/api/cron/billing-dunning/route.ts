import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendNotifyEmail } from "@/lib/email";
import { STARTER_CONVERSION_MIN_SUBS } from "@/lib/billing";
import { writeOrLog } from "@/lib/db";

// Runs daily.
//
// Pass 1 — expired trials (status 'trial', trial_ends_at in the past):
//  • under the Starter threshold → move to the free plan, stay live, no card needed
//  • at or above the threshold   → move to 'past_due' with the normal 7 day grace
//
// Pass 2 — declined cards (status 'past_due'):
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

  // ── Pass 1: resolve expired trials ────────────────────────────────────────
  const { data: expiredTrials } = await supabase
    .from("creator_billing")
    .select("user_id, trial_ends_at")
    .eq("status", "trial")
    .lt("trial_ends_at", new Date(now).toISOString());

  const { data: rows } = await supabase
    .from("creator_billing")
    .select("user_id, grace_ends_at, last_dunning_warned_at")
    .eq("status", "past_due");

  let warned = 0, locked = 0, freed = 0, converted = 0;

  async function emailUser(userId: string, subject: string, body: string) {
    const { data: au } = await supabase.auth.admin.getUserById(userId);
    if (!au?.user?.email) return;
    await sendNotifyEmail({ to: au.user.email, subject, preview: subject, body }).catch(() => false);
  }

  // Active paying subscribers across every profile this user owns.
  async function payingSubscriberCount(userId: string): Promise<number> {
    const { data: profiles } = await supabase
      .from("creator_profiles").select("id").eq("user_id", userId);
    const ids = (profiles ?? []).map((p: any) => p.id);
    if (ids.length === 0) return 0;
    const { count } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("creator_profile_id", ids)
      .eq("status", "active");
    return count ?? 0;
  }

  for (const t of expiredTrials ?? []) {
    const subs = await payingSubscriberCount(t.user_id);

    if (subs < STARTER_CONVERSION_MIN_SUBS) {
      // Not earning yet. Never take the page down over a clock we started.
      await writeOrLog("cron/billing-dunning update creator_billing", supabase.from("creator_billing")
        .update({ status: "free", tier: "starter", updated_at: new Date().toISOString() })
        .eq("user_id", t.user_id));
      await emailUser(
        t.user_id,
        "Your Spotlightly trial ended, your page is still live",
        `Your 30 day trial is up, so we moved you to the free plan. Nothing was charged and nothing came down.<br><br>` +
        `Your page, your posts, and your supporters stay exactly where they are. We will ask you about Starter once you pass ${STARTER_CONVERSION_MIN_SUBS} paying supporters, which is the point where it clearly pays for itself.<br><br>` +
        `<a href="${appUrl}/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Open your dashboard →</a>`
      );
      freed++;
      continue;
    }

    // Already earning. Ask for the card, with the same 7 day grace as a decline.
    await writeOrLog("cron/billing-dunning update creator_billing", supabase.from("creator_billing")
      .update({
        status: "past_due",
        grace_ends_at: new Date(now + 7 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", t.user_id));
    await emailUser(
      t.user_id,
      "Your Spotlightly trial ended, add a card to keep going",
      `Your 30 day trial is up and you have <strong>${subs}</strong> paying supporters, so it is time to move to a plan.<br><br>` +
      `You have 7 days to add a card. Your page stays live the whole time.<br><br>` +
      `<a href="${appUrl}/dashboard?pane=billing" style="display:inline-block;background:#F0B429;color:#09090C;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Add a payment method →</a>`
    );
    converted++;
  }

  // ── Pass 2: declined cards ────────────────────────────────────────────────
  for (const r of rows ?? []) {
    const graceEnds = r.grace_ends_at ? new Date(r.grace_ends_at).getTime() : null;

    // Grace expired → lock + be fair to the fans.
    if (graceEnds !== null && graceEnds <= now) {
      await writeOrLog("cron/billing-dunning update creator_billing", supabase.from("creator_billing")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("user_id", r.user_id));
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
        await writeOrLog("cron/billing-dunning update creator_billing", supabase.from("creator_billing")
          .update({ last_dunning_warned_at: new Date().toISOString() })
          .eq("user_id", r.user_id));
        warned++;
      }
    }
  }

  return NextResponse.json({ ok: true, warned, locked, freed, converted });
}
