import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeOrLog } from "@/lib/db";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ interests: [] });

  const { data } = await (supabase as any)
    .from("fan_interests")
    .select("category")
    .eq("fan_user_id", user.id);

  return NextResponse.json({ interests: (data ?? []).map((i: any) => i.category) });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { categories } = await req.json();
  if (!Array.isArray(categories)) {
    return NextResponse.json({ error: "categories must be an array" }, { status: 400 });
  }

  // Delete existing and insert new
  await writeOrLog("fan/interests delete fan_interests", (supabase as any).from("fan_interests").delete().eq("fan_user_id", user.id));

  if (categories.length > 0) {
    await writeOrLog("fan/interests insert fan_interests", (supabase as any).from("fan_interests").insert(
      categories.map((cat: string) => ({ fan_user_id: user.id, category: cat }))
    ));
  }

  return NextResponse.json({ ok: true });
}
