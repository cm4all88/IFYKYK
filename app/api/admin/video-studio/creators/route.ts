import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Lists creators for the Video Studio selector.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const supabase = (await createServiceClient()) as any;
  const { data, error } = await supabase
    .from("creator_profiles")
    .select("id, display_name, handle, avatar_url")
    .is("deleted_at", null)
    .order("display_name", { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ creators: [] });
  return NextResponse.json({ creators: data ?? [] });
}
