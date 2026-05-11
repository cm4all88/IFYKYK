import { NextRequest, NextResponse } from "next/server";
import { getSecret } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const secret = await getSecret("CRON_SECRET");
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const eighteenYearsAgo = new Date(today);
  eighteenYearsAgo.setFullYear(today.getFullYear() - 18);
  const cutoff = eighteenYearsAgo.toISOString().slice(0, 10);

  // Find Opening Act creators whose 18th birthday has passed
  const candidates = await sb(
    `creator_profiles?select=id,user_id,handle,display_name,date_of_birth&creator_type=eq.opening_act&graduated_at=is.null&date_of_birth=lte.${cutoff}`
  );

  const results: Array<{ handle: string; status: string }> = [];
  const nowIso = new Date().toISOString();

  for (const c of candidates ?? []) {
    try {
      // 1. Graduate them
      await sb(`creator_profiles?id=eq.${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          creator_type: "spotlight",
          graduated_at: nowIso,
        }),
      });

      // 2. Revoke any parental tokens
      await sb(
        `parental_tokens?child_user_id=eq.${c.user_id}&revoked_at=is.null`,
        {
          method: "PATCH",
          body: JSON.stringify({ revoked_at: nowIso }),
        }
      );

      results.push({ handle: c.handle, status: "graduated" });
    } catch (err: any) {
      console.error(`Graduation failed for ${c.handle}:`, err);
      results.push({ handle: c.handle, status: `error: ${err.message}` });
    }
  }

  return NextResponse.json({
    checked: candidates?.length ?? 0,
    graduated: results.filter((r) => r.status === "graduated").length,
    results,
  });
}