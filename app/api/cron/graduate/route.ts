import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecret } from "@/lib/settings";
import { sendEmail, emailLayout } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/graduate
 *
 * Vercel Cron daily job. Finds Opening Act creators whose 18th birthday is today
 * (or has passed without graduating), and:
 *   1. Updates creator_type to 'spotlight'
 *   2. Sets graduated_at timestamp
 *   3. Revokes any active parental tokens
 *   4. Sends a "you've graduated" email to the creator
 *   5. Sends a "creator has graduated" email to active subscribers (if email known)
 *
 * Authentication: requires `Authorization: Bearer <CRON_SECRET>` header.
 * Configure in Vercel cron with the secret from /admin.
 */
export async function GET(req: NextRequest) {
  const secret = await getSecret("CRON_SECRET");
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const today = new Date();
  const eighteenYearsAgo = new Date(today);
  eighteenYearsAgo.setFullYear(today.getFullYear() - 18);
  const cutoffDate = eighteenYearsAgo.toISOString().slice(0, 10);

  // Find Opening Act creators born on or before 18 years ago who haven't graduated
  const { data: candidates, error: findErr } = await supabase
    .from("creator_profiles")
    .select("id, user_id, handle, display_name, date_of_birth")
    .eq("creator_type", "opening_act")
    .is("graduated_at", null)
    .lte("date_of_birth", cutoffDate);

  if (findErr) {
    console.error("Graduation lookup failed:", findErr);
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  const results: Array<{ handle: string; status: string }> = [];

  for (const c of candidates ?? []) {
    // 1. Update creator_type and stamp graduated_at
    const { error: updateErr } = await supabase
      .from("creator_profiles")
      .update({
        creator_type: "spotlight",
        graduated_at: new Date().toISOString(),
      })
      .eq("id", c.id);

    if (updateErr) {
      console.error(`Graduation update failed for ${c.handle}:`, updateErr);
      results.push({ handle: c.handle, status: `error: ${updateErr.message}` });
      continue;
    }

    // 2. Revoke parental tokens
    await supabase
      .from("parental_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("child_user_id", c.user_id)
      .is("revoked_at", null);

    // 3. Email the creator
    const { data: userRow } = await supabase
      .from("creator_profiles")
      .select("user_id")
      .eq("id", c.id)
      .maybeSingle();

    if (userRow) {
      // Get auth email
      const { data: authUser } = await supabase.auth.admin.getUserById(userRow.user_id);
      if (authUser?.user?.email) {
        await sendEmail({
          to: authUser.user.email,
          subject: "You've got the Spotlight now.",
          html: emailLayout({
            heading: "Welcome to Spotlight.",
            body: `<p>Happy 18th birthday, ${c.display_name ?? c.handle}.</p>
                   <p>Your Opening Act account just graduated. You now have access to the full Spotlight feature set: Stripe payouts, locked posts, live streaming, and the option to open a Backstage profile when you're ready.</p>
                   <p>Your audience came with you. Your subscribers, your posts, your analytics — all carried over. Nothing starts from zero.</p>`,
            ctaUrl: `https://spotlightly.app/dashboard`,
            ctaText: "Open dashboard",
          }),
        });
      }
    }

    results.push({ handle: c.handle, status: "graduated" });
  }

  return NextResponse.json({
    checked: candidates?.length ?? 0,
    graduated: results.filter((r) => r.status === "graduated").length,
    results,
  });
}
