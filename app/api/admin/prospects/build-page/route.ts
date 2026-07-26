import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { createConciergeCreator, normalizeHandle } from "@/lib/concierge-create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Build a prepared creator page for a prospect.
 *
 * This is the escalation point: up to now the prospect has been a private
 * record. From here they have a real (unclaimed, unpublished) creator page,
 * their handle is reserved, and the EXISTING page builder at
 * /admin/creators/{id}/build takes over unchanged.
 *
 * The prospect's real email is deliberately not passed through — the account
 * is created with the synthetic concierge address so nothing can email them
 * without going through the approval gate.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const prospectId = String(body?.prospect_id || "");
  if (!prospectId) return NextResponse.json({ error: "Missing prospect_id" }, { status: 400 });

  const admin = await createServiceClient();
  const { data: prospect } = await (admin as any)
    .from("creator_prospects")
    .select("id, display_name, handle_wanted, creator_profile_id, stage")
    .eq("id", prospectId)
    .maybeSingle();

  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  if (prospect.creator_profile_id) {
    return NextResponse.json(
      { error: "This prospect already has a page.", profileId: prospect.creator_profile_id },
      { status: 409 }
    );
  }

  const handle = normalizeHandle(String(body?.handle || prospect.handle_wanted || ""));
  if (!handle) {
    return NextResponse.json({ error: "Choose a Spotlightly handle for this page." }, { status: 400 });
  }

  const result = await createConciergeCreator({
    handle,
    displayName: String(body?.display_name || prospect.display_name || "").trim(),
    // No email: see the note in lib/concierge-create.ts.
  });

  if (!result.ok) {
    const messages: Record<string, string> = {
      missing_fields: "A name and handle are both required.",
      handle_taken: "That handle is already taken.",
      email_taken: "An account already exists for that handle.",
      auth_failed: "Could not create the account. Try again.",
      profile_failed: "Could not create the page. Try again.",
    };
    return NextResponse.json(
      { error: messages[result.error ?? ""] ?? "Could not create the page.", detail: result.detail },
      { status: 400 }
    );
  }

  // Link the prospect to its page and advance the pipeline. If this fails the
  // page still exists, so report it rather than pretending it worked — an
  // orphaned page is recoverable, a silent mislink is not.
  const { error: linkErr } = await (admin as any)
    .from("creator_prospects")
    .update({
      creator_profile_id: result.profileId,
      stage: "page_built",
      updated_at: new Date().toISOString(),
    })
    .eq("id", prospectId);

  if (linkErr) {
    return NextResponse.json(
      {
        error: "The page was created but could not be linked to this prospect. Link it manually.",
        profileId: result.profileId,
        handle: result.handle,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    profileId: result.profileId,
    handle: result.handle,
    buildUrl: `/admin/creators/${result.profileId}/build`,
  });
}
