import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ profile: null });

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, handle, display_name, kind")
    .eq("user_id", user.id)
    .eq("kind", "spotlight")
    .maybeSingle();

  return NextResponse.json({ profile: profile ?? null });
}
