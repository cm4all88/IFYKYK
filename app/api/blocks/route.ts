import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createHash } from "crypto";

function hashContact(value: string) {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

function makeHint(value: string, type: "email" | "phone"): string {
  if (type === "email") {
    const [local, domain] = value.split("@");
    if (!domain) return "•••";
    const masked = local.charAt(0) + "•".repeat(Math.min(local.length - 1, 4));
    return `${masked}@${domain}`;
  }
  // Phone: keep last 4 digits
  const digits = value.replace(/\D/g, "");
  return "•••-" + digits.slice(-4);
}

// POST — add a contact to the block list
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { creatorProfileId, contactType, contactValue, note } = await req.json();

  if (!creatorProfileId || !contactType || !contactValue) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!["email", "phone"].includes(contactType)) {
    return NextResponse.json({ error: "contactType must be email or phone" }, { status: 400 });
  }

  // Verify this creator profile belongs to the user
  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id")
    .eq("id", creatorProfileId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const hash = hashContact(contactValue);
  const hint = makeHint(contactValue, contactType as "email" | "phone");

  const { data, error } = await (supabase as any)
    .from("creator_contact_blocks")
    .upsert({
      creator_profile_id: creatorProfileId,
      contact_type: contactType,
      contact_hash: hash,
      display_hint: hint,
      note: note?.trim() || null,
    }, { onConflict: "creator_profile_id,contact_hash" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ block: data });
}

// DELETE — remove a contact block by id
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await req.json();
  if (!blockId) return NextResponse.json({ error: "Missing blockId" }, { status: 400 });

  await (supabase as any)
    .from("creator_contact_blocks")
    .delete()
    .eq("id", blockId);

  return NextResponse.json({ ok: true });
}
