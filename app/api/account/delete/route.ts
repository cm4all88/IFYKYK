import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// Deletes the signed-in user's account. Runs with the service role so the
// write can't be silently blocked by RLS (the old browser-side update was).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = await createServiceClient();

  // Soft-delete every profile this user owns (spotlight + any backstage) and
  // free up their handle so the public URL 404s immediately.
  const { data: profiles } = await (admin as any)
    .from("creator_profiles")
    .select("id, handle")
    .eq("user_id", user.id);

  for (const p of (profiles ?? []) as { id: string; handle: string }[]) {
    await (admin as any)
      .from("creator_profiles")
      .update({
        deleted_at: new Date().toISOString(),
        handle: `deleted-${String(p.id).slice(0, 8)}`,
      })
      .eq("id", p.id);
  }

  // Best-effort hard removal of the auth user so the email frees up and they
  // can't log back in. If foreign-key constraints block it, the soft-delete
  // above still stands and is now enforced on the public page.
  let authDeleted = false;
  try {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    authDeleted = !error;
  } catch {
    authDeleted = false;
  }

  return NextResponse.json({ ok: true, authDeleted });
}
