import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth", balance: 0 }, { status: 401 });

  const { data } = await (supabase as any)
    .from("medal_balances").select("balance").eq("fan_user_id", user.id).maybeSingle();
  return NextResponse.json({ balance: data?.balance ?? 0 });
}
