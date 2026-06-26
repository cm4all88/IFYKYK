import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { recordPresence } from "@/lib/presence";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (user) await recordPresence(user.id, req.headers);
  return NextResponse.json({ ok: true });
}
