import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendAdminAlert } from "@/lib/email";

// Fired by the signup flow right after a creator's profile row is created, so
// the platform owner gets an instant heads-up. Guarded: only the just-signed-in
// user can trigger their own alert, and only if they actually have a profile.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false });

  const { data: profiles } = await (supabase as any)
    .from("creator_profiles")
    .select("handle, display_name, kind, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const profile = profiles?.[0];

  // Replay guard: this endpoint is called once, right after signup. Only fire the
  // alert for a genuinely fresh profile (created in the last 10 minutes) so a
  // logged-in user can't POST it repeatedly to spam the admin inbox.
  const createdAt = profile?.created_at ? new Date(profile.created_at).getTime() : 0;
  const isFresh = createdAt > 0 && Date.now() - createdAt < 10 * 60 * 1000;

  if (profile?.handle && isFresh) {
    await sendAdminAlert(
      `New creator: @${profile.handle}`,
      "New creator signed up. 🎬",
      [
        `Handle: <strong>@${profile.handle}</strong>`,
        profile.display_name ? `Name: ${profile.display_name}` : "",
        `Tier: ${profile.kind === "backstage" ? "Backstage" : "Spotlight"}`,
        user.email ? `Email: ${user.email}` : "",
      ]
    );
  }
  return NextResponse.json({ ok: true });
}
