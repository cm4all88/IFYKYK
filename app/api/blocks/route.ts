import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createHash } from "crypto";
import { writeOrLog } from "@/lib/db";

function hashContact(value: string) {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

function makeHint(value: string, type: string): string {
  if (type === "email") {
    const [local, domain] = value.split("@");
    if (!domain) return value;
    const masked = local.charAt(0) + "•".repeat(Math.min(local.length - 1, 4));
    return `${masked}@${domain}`;
  }
  if (type === "phone") {
    const digits = value.replace(/\D/g, "");
    return "•••-" + digits.slice(-4);
  }
  // name, handle, region — store as-is, no hashing needed
  return value.trim();
}

const VALID_TYPES = ["email", "phone", "name", "handle", "region"];

async function getProfile(supabase: any, userId: string, creatorProfileId: string) {
  const { data } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("id", creatorProfileId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

// GET — list all blocks for a creator profile
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creatorProfileId = req.nextUrl.searchParams.get("creatorProfileId");
  if (!creatorProfileId) return NextResponse.json({ error: "Missing creatorProfileId" }, { status: 400 });

  const profile = await getProfile(supabase as any, user.id, creatorProfileId);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data, error } = await (supabase as any)
    .from("creator_contact_blocks")
    .select("*")
    .eq("creator_profile_id", creatorProfileId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blocks: data ?? [] });
}

// POST — add a block
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { creatorProfileId, contactType, contactValue, note } = await req.json();

  if (!creatorProfileId || !contactType || !contactValue?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(contactType)) {
    return NextResponse.json({ error: `contactType must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  const profile = await getProfile(supabase as any, user.id, creatorProfileId);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Hash sensitive types, store plain for others
  const shouldHash = ["email", "phone"].includes(contactType);
  const hash = shouldHash
    ? hashContact(contactValue)
    : hashContact(contactValue); // still hash for dedup
  const hint = makeHint(contactValue, contactType);

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

// DELETE — remove a block by id
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await req.json();
  if (!blockId) return NextResponse.json({ error: "Missing blockId" }, { status: 400 });

  await writeOrLog("blocks delete creator_contact_blocks", (supabase as any)
    .from("creator_contact_blocks")
    .delete()
    .eq("id", blockId));

  return NextResponse.json({ ok: true });
}
