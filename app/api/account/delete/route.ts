import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// Deletes the signed-in user's account. Runs with the service role so writes
// can't be silently blocked by RLS (the old browser-side update could be).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const admin = await createServiceClient();

  const { data: profiles, error: readErr } = await (admin as any)
    .from("creator_profiles")
    .select("id, handle")
    .eq("user_id", user.id);

  if (readErr) {
    return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  }

  const results: any[] = [];
  let handleOk = true;

  for (const p of (profiles ?? []) as { id: string; handle: string }[]) {
    const tomb = `deleted-${String(p.id).slice(0, 8)}`;

    // 1) Free the handle FIRST and on its own. The public page is looked up by
    //    handle, so this single write is what actually makes the page 404 —
    //    it must not be bundled with columns that might fail.
    const r1 = await (admin as any).from("creator_profiles").update({ handle: tomb }).eq("id", p.id);
    if (r1.error) handleOk = false;

    // 2) Mark inactive (same column the admin ban system uses) — independent write.
    const r2 = await (admin as any).from("creator_profiles").update({ is_active: false }).eq("id", p.id);

    // 3) Mark deleted (enforced on the public page) — independent write.
    const r3 = await (admin as any).from("creator_profiles").update({ deleted_at: new Date().toISOString() }).eq("id", p.id);

    results.push({
      id: p.id,
      handleErr: r1.error?.message ?? null,
      activeErr: r2.error?.message ?? null,
      deletedErr: r3.error?.message ?? null,
    });
  }

  // Best-effort hard removal of the auth user so the email frees up and they
  // can't log back in. If foreign-key constraints block it, the soft-delete
  // above still stands and is enforced on the public page + dashboard.
  let authDeleted = false;
  try {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    authDeleted = !error;
  } catch {
    authDeleted = false;
  }

  // ok is true as long as the page-killing handle rename succeeded everywhere.
  return NextResponse.json({ ok: handleOk, authDeleted, results });
}
