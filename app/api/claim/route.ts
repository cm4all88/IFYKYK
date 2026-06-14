import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const code = String(body?.code || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!code) return NextResponse.json({ error: "Missing claim code." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const admin = await createServiceClient();

  const { data: profile } = await (admin as any)
    .from("creator_profiles")
    .select("id, user_id, handle, claimed_at")
    .eq("claim_code", code)
    .maybeSingle();

  if (!profile || profile.claimed_at) {
    return NextResponse.json({ error: "This link is invalid or has already been used." }, { status: 400 });
  }

  const { error: uErr } = await (admin as any).auth.admin.updateUserById(profile.user_id, {
    email, password, email_confirm: true,
  });
  if (uErr) {
    const m = (uErr.message || "").toLowerCase();
    const taken = m.includes("already") || m.includes("registered") || m.includes("exists");
    return NextResponse.json({ error: taken ? "That email is already in use." : "Could not set up your account. Try again." }, { status: 400 });
  }

  await (admin as any)
    .from("creator_profiles")
    .update({ claimed_at: new Date().toISOString(), claim_code: null })
    .eq("id", profile.id);

  return NextResponse.json({ ok: true, handle: profile.handle });
}
