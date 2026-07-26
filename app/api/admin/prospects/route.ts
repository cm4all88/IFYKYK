import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { createClient } from "@/lib/supabase-server";
import {
  canAdminSetStage,
  validateProspect,
  PROSPECT_STAGES,
  type ProspectStage,
} from "@/lib/prospects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  return isAdmin();
}

/** Create a prospect. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const result = validateProspect(body ?? {});
  if (!result.ok) return NextResponse.json({ error: result.errors.join(" "), errors: result.errors }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = await createServiceClient();
  const { data, error } = await (admin as any)
    .from("creator_prospects")
    .insert({ ...result.value, discovered_by: user?.id ?? null })
    .select("id")
    .single();

  if (error) {
    const msg = String((error as any).message || "");
    // Unique indexes on lower(email) and (platform, lower(platform_handle)).
    if (msg.includes("creator_prospects_email_key")) {
      return NextResponse.json({ error: "A prospect with that email already exists." }, { status: 409 });
    }
    if (msg.includes("creator_prospects_platform_key")) {
      return NextResponse.json({ error: "A prospect with that platform handle already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not save this prospect." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}

/** Update a prospect: fields, stage, or contact controls. */
export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = await createServiceClient();
  const { data: current } = await (admin as any)
    .from("creator_prospects").select("stage").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const fields: Record<string, unknown> = {};

  // Stage changes go through the transition rule so an admin cannot fake
  // progress the creator has not actually made (joined / invited / page_built).
  if (body.stage !== undefined) {
    const next = String(body.stage) as ProspectStage;
    if (!(PROSPECT_STAGES as readonly string[]).includes(next)) {
      return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
    }
    if (!canAdminSetStage(current.stage as ProspectStage, next)) {
      return NextResponse.json(
        { error: `Cannot move a prospect from ${current.stage} to ${next}.` },
        { status: 400 }
      );
    }
    fields.stage = next;
    if (next === "disqualified" && typeof body.disqualified_reason === "string") {
      fields.disqualified_reason = body.disqualified_reason.trim() || null;
    }
  }

  // Contact controls are independent of stage.
  if (body.do_not_contact !== undefined) fields.do_not_contact = body.do_not_contact === true;

  // Any full-field edit revalidates the whole record.
  if (body.fields && typeof body.fields === "object") {
    const result = validateProspect(body.fields);
    if (!result.ok) return NextResponse.json({ error: result.errors.join(" "), errors: result.errors }, { status: 400 });
    Object.assign(fields, result.value);
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  fields.updated_at = new Date().toISOString();

  const { error } = await (admin as any).from("creator_prospects").update(fields).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not update this prospect." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * Delete a prospect. The FK to creator_profiles is ON DELETE SET NULL, so a
 * built page and its creator are never removed by this — only the pipeline
 * record goes.
 */
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = await createServiceClient();
  const { error } = await (admin as any).from("creator_prospects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete this prospect." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
